"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateOrderStatus } from "@/app/admin/actions";
import { ORDER_STATUS_LABEL } from "@/lib/format";

const NEXT_OPTIONS: Record<string, string[]> = {
  pending: ["paid", "cancelled"],
  paid: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["completed"],
  completed: [],
  cancelled: [],
};

export default function OrderStatusButtons({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const options = NEXT_OPTIONS[status] ?? [];

  if (options.length === 0) {
    return <p className="text-sm text-ink-soft">此訂單已結束,無可用操作。</p>;
  }

  async function change(next: string) {
    if (busy) return;
    if (!confirm(`確定將訂單標記為「${ORDER_STATUS_LABEL[next]}」?`)) return;
    setBusy(true);
    setError("");
    try {
      await updateOrderStatus(orderId, next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {options.map((next) => (
          <button
            key={next}
            disabled={busy}
            onClick={() => change(next)}
            className={next === "cancelled" ? "iv-btn-danger" : "iv-btn-primary"}
          >
            {ORDER_STATUS_LABEL[next]}
          </button>
        ))}
      </div>
      {error && (
        <p className="mt-3 rounded-lg bg-danger-soft p-3 text-sm text-danger">{error}</p>
      )}
    </div>
  );
}
