import { createAdminClient } from "@/lib/supabase/admin";
import { generateQuoteLineItems } from "@/lib/ai";
import { getQuoteConfig, getRateCard } from "@/lib/settings";
import { emailShell, notifyAdmin, sendMail, siteUrl } from "@/lib/resend";
import type { ChatMessage, Quote, QuoteLineItem } from "@/lib/types";

export function computeTotals(items: QuoteLineItem[], taxRate: number) {
  const subtotal = items.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const tax = Math.round(subtotal * taxRate);
  return { subtotal, tax, total: subtotal + tax };
}

// AI 對話觸發:建立報價「草稿」並通知管理員(絕不直接寄給客戶)
export async function createQuoteDraftFromSession(
  sessionId: string,
  messages: ChatMessage[],
  contact: { email: string; name: string; phone: string },
  userId: string | null
) {
  const supabase = createAdminClient();

  // 同一 session 只建一份草稿
  const { data: existing } = await supabase
    .from("quotes")
    .select("id")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (existing) return null;

  const rateCard = await getRateCard();
  const config = await getQuoteConfig();
  const draft = await generateQuoteLineItems(messages, rateCard);
  const totals = computeTotals(draft.line_items, config.tax_rate);

  const { data: quote, error } = await supabase
    .from("quotes")
    .insert({
      session_id: sessionId,
      user_id: userId,
      contact_email: contact.email,
      contact_name: contact.name,
      contact_phone: contact.phone,
      status: "draft",
      line_items: draft.line_items,
      ...totals,
      note: draft.summary,
      created_by: "ai",
    })
    .select("*")
    .single();

  if (error || !quote) {
    console.error("[quote] draft insert failed:", error);
    return null;
  }

  await supabase
    .from("ai_chat_logs")
    .update({ quote_id: quote.id })
    .eq("session_id", sessionId);

  await notifyAdmin(
    `AI 報價草稿待審核 ${quote.quote_no}`,
    emailShell(
      "有一份 AI 報價草稿等你審核",
      `<p>客戶:${contact.name || "(未留姓名)"} / ${contact.email}</p>
       <p>需求摘要:${draft.summary}</p>
       <p><a href="${siteUrl()}/admin/quotes/${quote.id}">前往後台審核並寄出</a></p>`
    )
  );

  return quote as Quote;
}

// 管理員核准 → 寄出報價
export async function sendQuoteToCustomer(quoteId: string) {
  const supabase = createAdminClient();
  const config = await getQuoteConfig();
  const validUntil = new Date(Date.now() + config.valid_days * 86400000)
    .toISOString()
    .slice(0, 10);

  const { data: quote, error } = await supabase
    .from("quotes")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      valid_until: validUntil,
    })
    .eq("id", quoteId)
    .in("status", ["draft", "sent"])
    .select("*")
    .single();

  if (error || !quote) return { ok: false as const, error: "報價單狀態不允許寄出" };
  if (!quote.contact_email) return { ok: false as const, error: "缺少客戶 email" };

  const ok = await sendMail({
    to: quote.contact_email,
    subject: `【interval】您的報價單 ${quote.quote_no}`,
    html: emailShell(
      `報價單 ${quote.quote_no}`,
      `<p>${quote.contact_name || "您好"},您的報價單已準備好:</p>
       <p style="margin:20px 0;"><a href="${siteUrl()}/quote/${quote.public_token}"
          style="background:#2742f5;color:#fff;padding:12px 28px;border-radius:999px;text-decoration:none;font-weight:700;">查看報價單</a></p>
       <p>報價有效期限至 ${validUntil}。在報價單頁面按「接受報價」即可直接成立訂單。</p>`
    ),
  });

  return { ok, error: ok ? null : "email 寄送失敗(請確認 RESEND_API_KEY)" };
}

// 客戶接受報價 → 自動轉訂單(引導下單的最後一步)
export async function acceptQuoteByToken(token: string) {
  const supabase = createAdminClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("*")
    .eq("public_token", token)
    .maybeSingle();

  if (!quote) return { ok: false as const, error: "找不到報價單" };
  if (quote.status === "accepted" || quote.status === "converted") {
    // 冪等:已接受就直接回訂單連結
    if (quote.order_id) {
      const { data: order } = await supabase
        .from("orders")
        .select("public_token")
        .eq("id", quote.order_id)
        .maybeSingle();
      if (order) return { ok: true as const, orderToken: order.public_token };
    }
    return { ok: false as const, error: "報價單已處理" };
  }
  if (!["sent", "viewed"].includes(quote.status)) {
    return { ok: false as const, error: "報價單狀態不允許接受" };
  }

  // 條件更新防止併發重複接受
  const { data: updated } = await supabase
    .from("quotes")
    .update({ status: "accepted", accepted_at: new Date().toISOString() })
    .eq("id", quote.id)
    .in("status", ["sent", "viewed"])
    .select("id")
    .maybeSingle();
  if (!updated) return { ok: false as const, error: "報價單已被處理,請重新整理" };

  const items = (quote.line_items ?? []) as QuoteLineItem[];
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      user_id: quote.user_id,
      quote_id: quote.id,
      status: "pending",
      subtotal: quote.subtotal,
      shipping_fee: 0,
      total: quote.total,
      contact_name: quote.contact_name,
      contact_email: quote.contact_email,
      contact_phone: quote.contact_phone,
      payment_method: "bank_transfer",
      note: `由報價單 ${quote.quote_no} 轉入`,
    })
    .select("*")
    .single();

  if (orderErr || !order) {
    console.error("[quote] accept -> order failed:", orderErr);
    return { ok: false as const, error: "訂單建立失敗,請聯絡我們" };
  }

  if (items.length > 0) {
    await supabase.from("order_items").insert(
      items.map((i) => ({
        order_id: order.id,
        product_id: null,
        name: i.name,
        unit_price: i.unit_price,
        quantity: i.quantity,
      }))
    );
  }

  await supabase
    .from("quotes")
    .update({ status: "converted", order_id: order.id })
    .eq("id", quote.id);

  if (quote.contact_email) {
    await sendMail({
      to: quote.contact_email,
      subject: `【interval】訂單成立 ${order.order_no}`,
      html: emailShell(
        `訂單 ${order.order_no} 已成立`,
        `<p>感謝接受報價!您的訂單已成立,金額 NT$ ${order.total.toLocaleString()}。</p>
         <p><a href="${siteUrl()}/orders/${order.public_token}">查看訂單與付款資訊</a></p>`
      ),
    });
  }
  await notifyAdmin(
    `報價 ${quote.quote_no} 已接受並轉訂單 ${order.order_no}`,
    emailShell(
      "報價已接受",
      `<p>${quote.contact_name || quote.contact_email} 接受了報價 ${quote.quote_no}。</p>
       <p><a href="${siteUrl()}/admin/orders/${order.id}">查看訂單 ${order.order_no}</a></p>`
    )
  );

  return { ok: true as const, orderToken: order.public_token as string };
}

export async function markQuoteViewed(token: string) {
  const supabase = createAdminClient();
  await supabase
    .from("quotes")
    .update({ status: "viewed", viewed_at: new Date().toISOString() })
    .eq("public_token", token)
    .eq("status", "sent");
}
