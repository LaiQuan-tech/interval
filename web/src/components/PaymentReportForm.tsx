"use client";

import { useState } from "react";
import type { PaymentReport } from "@/lib/types";
import { useTranslations } from "@/lib/i18n/context";

// 訂單完成頁的匯款末五碼回報表單。已回報過就顯示狀態,不再顯示表單。
export default function PaymentReportForm({
  token,
  initialReport,
}: {
  token: string;
  initialReport: PaymentReport | null;
}) {
  const { messages } = useTranslations();
  const t = messages.order.report;
  const [report, setReport] = useState(initialReport);
  const [last5, setLast5] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (report) {
    return (
      <p className="mt-3 text-sm text-ok">
        {t.alreadyPrefix}{report.last5}{t.alreadySuffix}
      </p>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!/^\d{5}$/.test(last5)) {
      setError(t.validationError);
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/orders/report-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, last5 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? t.submitError);
      setReport(data.payment_report as PaymentReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.submitError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-3 flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor="last5" className="iv-label">
          {t.label}
        </label>
        <input
          id="last5"
          inputMode="numeric"
          maxLength={5}
          className="iv-input w-32"
          value={last5}
          onChange={(e) => setLast5(e.target.value.replace(/\D/g, "").slice(0, 5))}
        />
      </div>
      <button type="submit" disabled={submitting} className="iv-btn-ghost !min-h-11">
        {submitting ? t.submitting : t.submit}
      </button>
      {error && <p className="w-full text-sm text-danger">{error}</p>}
    </form>
  );
}
