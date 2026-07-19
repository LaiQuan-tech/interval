import { NextRequest, NextResponse } from "next/server";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { emailShell, notifyAdmin, siteUrl } from "@/lib/resend";
import type { PaymentReport } from "@/lib/types";

// 完成頁的「末五碼回報」表單:token 驗證訂單,寫入 payment_report,通知後台。
// 已回報過(存在 payment_report)則冪等回傳既有回報,不覆寫、不報錯。
export async function POST(req: NextRequest) {
  let body: { token?: string; last5?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "格式錯誤" }, { status: 400 });
  }

  const token = (body.token ?? "").trim();
  const last5 = (body.last5 ?? "").trim();
  if (!token || !/^\d{5}$/.test(last5)) {
    return NextResponse.json({ error: "請輸入正確的匯款帳號末 5 碼" }, { status: 400 });
  }

  const supabase = tryCreateAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "系統尚未完成設定,請稍後再試" }, { status: 503 });
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, order_no, payment_method, payment_report, contact_name")
    .eq("public_token", token)
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ error: "找不到訂單" }, { status: 404 });
  }
  if (order.payment_method !== "bank_transfer") {
    return NextResponse.json({ error: "此訂單不適用匯款回報" }, { status: 400 });
  }
  if (order.payment_report) {
    return NextResponse.json({ payment_report: order.payment_report as PaymentReport });
  }

  const paymentReport: PaymentReport = { last5, reported_at: new Date().toISOString() };
  const { error } = await supabase
    .from("orders")
    .update({ payment_report: paymentReport })
    .eq("id", order.id);
  if (error) {
    console.error("[orders/report-payment] update failed:", error);
    return NextResponse.json({ error: "回報失敗,請稍後再試" }, { status: 500 });
  }

  await notifyAdmin(
    `訂單 ${order.order_no} 客戶回報匯款`,
    emailShell(
      "客戶回報匯款",
      `<p>${order.contact_name} 回報訂單 ${order.order_no} 的匯款帳號末五碼:<strong>${last5}</strong></p>
       <p><a href="${siteUrl()}/admin/orders/${order.id}">前往後台確認</a></p>`
    )
  );

  return NextResponse.json({ payment_report: paymentReport });
}
