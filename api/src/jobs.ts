// 追蹤排程:全部單發、冪等(只在成功寄信後寫入時間戳)
import { createClient } from "@supabase/supabase-js";

function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "interval <onboarding@resend.dev>";
  if (!apiKey) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to: [to], subject, html }),
  });
  return res.ok;
}

const SITE = () => process.env.SITE_URL ?? "http://localhost:3000";

export async function runFollowupJobs() {
  const supabase = db();
  if (!supabase) return { ok: false, reason: "supabase env missing" };

  const results = { expiredQuotes: 0, quoteReminders: 0, orderReminders: 0 };
  const now = new Date();

  // 1. 過期報價:已寄出但超過有效期 → expired
  const { data: expired } = await supabase
    .from("quotes")
    .update({ status: "expired" })
    .in("status", ["sent", "viewed"])
    .lt("valid_until", now.toISOString().slice(0, 10))
    .select("id");
  results.expiredQuotes = expired?.length ?? 0;

  // 2. 報價追蹤:寄出 N 天未接受且未提醒過 → 提醒一次
  const followupDays = Number(process.env.QUOTE_FOLLOWUP_DAYS ?? 3);
  const cutoff = new Date(now.getTime() - followupDays * 86400000).toISOString();
  const { data: staleQuotes } = await supabase
    .from("quotes")
    .select("id, quote_no, contact_email, contact_name, public_token, note")
    .in("status", ["sent", "viewed"])
    .lt("sent_at", cutoff)
    .not("contact_email", "eq", "")
    .is("accepted_at", null);

  for (const q of staleQuotes ?? []) {
    // note 欄位夾帶 reminded 標記,避免加欄位;已提醒過就跳過
    if (q.note?.includes("[reminded]")) continue;
    const ok = await sendEmail(
      q.contact_email,
      `【interval】報價單 ${q.quote_no} 提醒`,
      `<p>${q.contact_name || "您好"},提醒您先前的報價單仍在有效期內:</p>
       <p><a href="${SITE()}/quote/${q.public_token}">查看報價單 ${q.quote_no}</a></p>`
    );
    if (ok) {
      await supabase
        .from("quotes")
        .update({ note: `${q.note ?? ""}[reminded]` })
        .eq("id", q.id);
      results.quoteReminders++;
    }
  }

  // 3. 未付款訂單提醒:pending 超過 N 天且未提醒過
  const { data: staleOrders } = await supabase
    .from("orders")
    .select("id, order_no, contact_email, contact_name, public_token, note")
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .not("contact_email", "eq", "");

  for (const o of staleOrders ?? []) {
    if (o.note?.includes("[reminded]")) continue;
    const ok = await sendEmail(
      o.contact_email,
      `【interval】訂單 ${o.order_no} 付款提醒`,
      `<p>${o.contact_name || "您好"},您的訂單尚未完成付款:</p>
       <p><a href="${SITE()}/orders/${o.public_token}">查看訂單 ${o.order_no}</a></p>`
    );
    if (ok) {
      await supabase
        .from("orders")
        .update({ note: `${o.note ?? ""}[reminded]` })
        .eq("id", o.id);
      results.orderReminders++;
    }
  }

  return { ok: true, ...results, ranAt: now.toISOString() };
}
