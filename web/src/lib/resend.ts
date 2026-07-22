// Resend email(raw fetch,不用 SDK)。env 未設定時靜默略過,核心流程不中斷。
import type { Locale } from "@/lib/i18n/config";

const RESEND_URL = "https://api.resend.com/emails";

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !opts.to) return false;
  const from = process.env.RESEND_FROM ?? "好日子 Good Days <onboarding@resend.dev>";
  try {
    const res = await fetch(RESEND_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      }),
    });
    if (!res.ok) {
      console.error("[resend] send failed:", res.status, await res.text());
    }
    return res.ok;
  } catch (err) {
    console.error("[resend] send error:", err);
    return false;
  }
}

export async function notifyAdmin(subject: string, html: string) {
  const to = process.env.CONTACT_NOTIFY_TO;
  if (!to) return false;
  return sendMail({ to, subject: `【好日子後台】${subject}`, html });
}

export function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

// locale 預設 "zh":維持既有呼叫端(notifyAdmin 與所有尚未傳 locale 的呼叫點)零改動、
// 輸出與現在逐字相同。只有 Phase F 客戶信的英文分支會明確傳 locale="en"。
export function emailShell(title: string, body: string, locale: Locale = "zh") {
  if (locale === "en") {
    return `
  <div style="font-family:'Noto Serif TC','Noto Sans TC','PingFang TC',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#2a2016;">
    <div style="font-size:20px;font-weight:700;letter-spacing:.2em;margin-bottom:4px;color:#2e2519;">Good Days</div>
    <div style="font-size:12px;color:#8a7259;margin-bottom:20px;">好日子 · Curated moments, for those who savor life</div>
    <div style="border:1px solid #e2d7c4;border-radius:4px;padding:24px;background:#faf6ee;">
      <h2 style="margin:0 0 16px;font-size:17px;color:#2a2016;">${title}</h2>
      ${body}
    </div>
    <div style="font-size:12px;color:#8a7259;margin-top:16px;">This is an automated message — please do not reply directly.</div>
  </div>`;
  }
  return `
  <div style="font-family:'Noto Serif TC','Noto Sans TC','PingFang TC',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#2a2016;">
    <div style="font-size:20px;font-weight:700;letter-spacing:.2em;margin-bottom:4px;color:#2e2519;">好日子</div>
    <div style="font-size:12px;color:#8a7259;margin-bottom:20px;">Good Days · 為懂得生活的人，典藏值得停留的時光</div>
    <div style="border:1px solid #e2d7c4;border-radius:4px;padding:24px;background:#faf6ee;">
      <h2 style="margin:0 0 16px;font-size:17px;color:#2a2016;">${title}</h2>
      ${body}
    </div>
    <div style="font-size:12px;color:#8a7259;margin-top:16px;">此信件由系統自動發送,請勿直接回覆。</div>
  </div>`;
}
