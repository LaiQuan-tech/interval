"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "@/lib/i18n/context";
import { localeHref } from "@/lib/i18n/href";

export default function AcceptQuoteButton({ token }: { token: string }) {
  const router = useRouter();
  const { locale, messages } = useTranslations();
  const t = messages.quote;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function accept() {
    if (loading) return;
    if (!confirm(t.acceptConfirm)) return;
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
        throw new Error(data.error ?? t.acceptError);
      }
      router.push(localeHref(`/orders/${data.orderToken}?created=1`, locale));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.acceptError);
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={accept} disabled={loading} className="iv-btn-primary w-full">
        {loading ? t.acceptSubmitting : t.acceptSubmit}
      </button>
      {error && (
        <p className="mt-3 rounded-lg bg-danger-soft p-3 text-center text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
