"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateBookingStatus } from "@/app/admin/actions";
import { BOOKING_STATUS_LABEL } from "@/lib/format";

const NEXT_OPTIONS: Record<string, string[]> = {
  new: ["confirmed", "cancelled"],
  confirmed: ["done", "cancelled"],
  done: [],
  cancelled: [],
};

export default function BookingStatusButtons({
  bookingId,
  status,
}: {
  bookingId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const options = NEXT_OPTIONS[status] ?? [];

  if (options.length === 0) {
    return <span className="text-xs text-ink-soft">—</span>;
  }

  async function change(next: string) {
    if (busy) return;
    if (!confirm(`確定將此預約標記為「${BOOKING_STATUS_LABEL[next]}」?`)) return;
    setBusy(true);
    try {
      await updateBookingStatus(bookingId, next);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {options.map((next) => (
        <button
          key={next}
          disabled={busy}
          onClick={() => change(next)}
          className={`iv-chip cursor-pointer ${
            next === "cancelled"
              ? "border border-danger/30 bg-danger-soft text-danger"
              : "border border-line bg-card text-ink-soft hover:border-accent hover:text-accent"
          }`}
        >
          {BOOKING_STATUS_LABEL[next]}
        </button>
      ))}
    </div>
  );
}
