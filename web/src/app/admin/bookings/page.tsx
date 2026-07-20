import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatDateTime, BOOKING_STATUS_LABEL } from "@/lib/format";
import BookingStatusButtons from "@/components/admin/BookingStatusButtons";
import type { Booking } from "@/lib/types";

export const dynamic = "force-dynamic";

const FILTERS = ["all", "new", "confirmed", "done", "cancelled"];

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const db = createAdminClient();

  let query = db.from("bookings").select("*").order("created_at", { ascending: false }).limit(200);
  if (status && status !== "all") query = query.eq("status", status);
  const { data } = await query;
  const bookings = (data ?? []) as Booking[];

  return (
    <div>
      <h2 className="mb-4 font-bold">預約參訪</h2>

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/admin/bookings" : `/admin/bookings?status=${f}`}
            className={`iv-chip whitespace-nowrap !px-4 !py-2 ${
              (status ?? "all") === f ? "bg-ink text-white" : "border border-line bg-card"
            }`}
          >
            {f === "all" ? "全部" : BOOKING_STATUS_LABEL[f]}
          </Link>
        ))}
      </div>

      <div className="flex flex-col gap-2.5 lg:hidden">
        {bookings.map((b) => (
          <div key={b.id} className="iv-card !p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="font-medium text-ink break-words">{b.name}</span>
              </div>
              <span className="iv-chip shrink-0 bg-accent-soft text-accent">
                {BOOKING_STATUS_LABEL[b.status] ?? b.status}
              </span>
            </div>
            <div className="mt-1.5 text-[13px] text-ink-soft break-words">{b.email}</div>
            {b.phone && (
              <div className="mt-1 text-[13px] text-ink-soft break-words">{b.phone}</div>
            )}
            <div className="mt-1 text-[13px] text-ink-soft">
              {b.purpose || "—"} · {b.visit_date ? formatDate(b.visit_date) : "—"}
            </div>
            {b.message && (
              <div className="mt-1 text-[13px] text-ink-soft break-words">{b.message}</div>
            )}
            <div className="mt-1 text-xs text-ink-soft">送出於 {formatDateTime(b.created_at)}</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <BookingStatusButtons bookingId={b.id} status={b.status} />
            </div>
          </div>
        ))}
        {bookings.length === 0 && (
          <div className="iv-card text-center text-ink-soft">沒有符合條件的預約</div>
        )}
      </div>

      <div className="iv-table-wrap hidden lg:block">
        <table className="w-full min-w-160 border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-soft">
              <th className="py-2.5 font-medium">聯絡人</th>
              <th className="py-2.5 font-medium">參訪目的</th>
              <th className="py-2.5 font-medium">期望日期</th>
              <th className="py-2.5 font-medium">備註</th>
              <th className="py-2.5 font-medium">送出時間</th>
              <th className="py-2.5 text-right font-medium">狀態</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => (
              <tr key={b.id} className="border-b border-line/60 align-top">
                <td className="py-3">
                  {b.name}
                  <span className="block text-xs text-ink-soft">{b.email}</span>
                  {b.phone && <span className="block text-xs text-ink-soft">{b.phone}</span>}
                </td>
                <td className="py-3">{b.purpose || "—"}</td>
                <td className="py-3 text-ink-soft">{b.visit_date ? formatDate(b.visit_date) : "—"}</td>
                <td className="py-3 max-w-60 text-ink-soft">{b.message || "—"}</td>
                <td className="py-3 text-ink-soft">{formatDateTime(b.created_at)}</td>
                <td className="py-3 text-right">
                  <div className="flex flex-col items-end gap-2">
                    <span className="iv-chip bg-accent-soft text-accent">
                      {BOOKING_STATUS_LABEL[b.status] ?? b.status}
                    </span>
                    <BookingStatusButtons bookingId={b.id} status={b.status} />
                  </div>
                </td>
              </tr>
            ))}
            {bookings.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-ink-soft">
                  沒有符合條件的預約
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
