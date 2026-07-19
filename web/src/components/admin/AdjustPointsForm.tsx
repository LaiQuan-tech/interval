"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adjustMemberPoints } from "@/app/admin/actions";

export default function AdjustPointsForm({ userId }: { userId: string }) {
  const router = useRouter();
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  async function submit() {
    const value = parseInt(delta, 10);
    if (!Number.isInteger(value) || value === 0) {
      setError("請輸入非零整數(正數加點、負數扣點)");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await adjustMemberPoints(userId, value, note);
      setDelta("");
      setNote("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "調整失敗");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="iv-chip cursor-pointer border border-line bg-card">
        調整點數
      </button>
    );
  }

  return (
    <div className="flex min-w-56 flex-col gap-2 rounded-xl border border-line bg-card p-3">
      <div className="flex gap-2">
        <input
          type="number"
          value={delta}
          onChange={(e) => setDelta(e.target.value)}
          placeholder="+100 / -50"
          className="iv-input !min-h-8 w-24 !px-2 !py-1 text-xs"
        />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="調整原因"
          className="iv-input !min-h-8 flex-1 !px-2 !py-1 text-xs"
        />
      </div>
      <div className="flex gap-2">
        <button
          disabled={busy}
          onClick={submit}
          className="iv-btn-primary !min-h-8 !px-3 !py-1 text-xs"
        >
          {busy ? "送出中…" : "確認調整"}
        </button>
        <button
          disabled={busy}
          onClick={() => {
            setOpen(false);
            setError("");
          }}
          className="iv-btn-ghost !min-h-8 !px-3 !py-1 text-xs"
        >
          取消
        </button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
