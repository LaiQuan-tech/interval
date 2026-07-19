"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AcceptQuoteButton({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function accept() {
    if (loading) return;
    if (!confirm("確定接受此報價並成立訂單嗎?")) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/quote/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok || !data.orderToken) {
        throw new Error(data.error ?? "處理失敗,請再試一次");
      }
      router.push(`/orders/${data.orderToken}?created=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "處理失敗,請再試一次");
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={accept} disabled={loading} className="iv-btn-primary w-full">
        {loading ? "訂單成立中…" : "接受報價,成立訂單"}
      </button>
      {error && (
        <p className="mt-3 rounded-lg bg-danger-soft p-3 text-center text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
