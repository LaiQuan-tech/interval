"use server";

import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { emailShell, notifyAdmin } from "@/lib/resend";

// 注意:"use server" 檔案只能 export async function——
// 參訪目的 chip 清單維護在 components/BookingForm.tsx(非 async export 放這裡會使 action 在部署環境 500)
export type CreateBookingInput = {
  name: string;
  email: string;
  phone?: string;
  visit_date?: string; // YYYY-MM-DD
  purpose?: string;
  message?: string;
};

// /booking 頁表單直接呼叫的 Server Action(client component 可直接 import 呼叫,無需另開 API route)
export async function createBooking(
  input: CreateBookingInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  const name = (input.name ?? "").trim().slice(0, 100);
  const email = (input.email ?? "").trim().slice(0, 200);
  if (!name || !email) return { ok: false, error: "請填寫姓名與 Email" };
  if (!/^[\w.+-]+@[\w-]+\.[\w.]+$/.test(email)) return { ok: false, error: "Email 格式不正確" };

  const supabase = tryCreateAdminClient();
  if (!supabase) return { ok: false, error: "系統尚未完成設定,請稍後再試" };

  const visitDate = input.visit_date?.trim() || null;
  const payload = {
    name,
    email,
    phone: (input.phone ?? "").trim().slice(0, 50) || null,
    visit_date: visitDate && /^\d{4}-\d{2}-\d{2}$/.test(visitDate) ? visitDate : null,
    purpose: (input.purpose ?? "").trim().slice(0, 50) || null,
    message: (input.message ?? "").trim().slice(0, 2000) || null,
  };

  const { error } = await supabase.from("bookings").insert(payload);
  if (error) {
    console.error("[bookings] insert failed:", error);
    return { ok: false, error: "預約送出失敗,請稍後再試" };
  }

  await notifyAdmin(
    `新的預約參訪:${name}`,
    emailShell(
      "收到新的預約參訪",
      `<p>姓名:${name}</p>
       <p>Email:${email}</p>
       <p>電話:${payload.phone ?? "—"}</p>
       <p>期望日期:${payload.visit_date ?? "—"}</p>
       <p>參訪目的:${payload.purpose ?? "—"}</p>
       <p>備註:${payload.message ?? "—"}</p>
       <p style="margin-top:16px;"><a href="${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/admin/bookings">前往後台查看</a></p>`
    )
  );

  return { ok: true };
}
