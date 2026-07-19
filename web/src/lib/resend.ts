// Resend email(raw fetch,不用 SDK)。env 未設定時靜默略過,核心流程不中斷。
const RESEND_URL = "https://api.resend.com/emails";

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !opts.to) return false;
  const from = process.env.RESEND_FROM ?? "interval <onboarding@resend.dev>";
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
  return sendMail({ to, subject: `【interval 後台】${subject}`, html });
}

export function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export function emailShell(title: string, body: string) {
  return `
  <div style="font-family:'Noto Sans TC','PingFang TC',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#101828;">
    <div style="font-size:20px;font-weight:700;letter-spacing:.02em;margin-bottom:4px;">interval</div>
    <div style="font-size:12px;color:#667085;margin-bottom:20px;">賣到全世界</div>
    <div style="border:1px solid #e7e5df;border-radius:16px;padding:24px;background:#fff;">
      <h2 style="margin:0 0 16px;font-size:17px;">${title}</h2>
      ${body}
    </div>
    <div style="font-size:12px;color:#98a2b3;margin-top:16px;">此信件由系統自動發送,請勿直接回覆。</div>
  </div>`;
}
