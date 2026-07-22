"use server";

import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { emailShell, notifyAdmin } from "@/lib/resend";
import { getMessages } from "@/lib/i18n/server";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n/config";

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

// /booking 頁表單直接呼叫的 Server Action(client component 可直接 import 呼叫,無需另開 API route)。
// locale 預設 DEFAULT_LOCALE("zh"):維持既有呼叫端零改動、中文站行為與錯誤文案逐字不變。
export async function createBooking(
  input: CreateBookingInput,
  locale: Locale = DEFAULT_LOCALE
): Promise<{ ok: true } | { ok: false; error: string }> {
  const t = getMessages(locale).booking.errors;
  const name = (input.name ?? "").trim().slice(0, 100);
  const email = (input.email ?? "").trim().slice(0, 200);
  if (!name || !email) return { ok: false, error: t.missing };
  if (!/^[\w.+-]+@[\w-]+\.[\w.]+$/.test(email)) return { ok: false, error: t.emailFormat };

  const supabase = tryCreateAdminClient();
  if (!supabase) return { ok: false, error: t.notReady };

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
    return { ok: false, error: t.submitFailed };
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
