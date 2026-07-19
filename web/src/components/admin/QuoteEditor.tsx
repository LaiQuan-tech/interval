"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  approveAndSendQuote,
  deleteQuote,
  saveQuote,
} from "@/app/admin/actions";
import { formatTWD } from "@/lib/format";
import type { Quote, QuoteLineItem } from "@/lib/types";

export default function QuoteEditor({ quote }: { quote: Quote }) {
  const router = useRouter();
  const editable = ["draft", "sent", "viewed"].includes(quote.status);

  const [items, setItems] = useState<QuoteLineItem[]>(
    quote.line_items.length > 0
      ? quote.line_items
      : [{ name: "", unit_price: 0, quantity: 1, note: "" }]
  );
  const [contact, setContact] = useState({
    contact_name: quote.contact_name,
    contact_email: quote.contact_email,
    contact_phone: quote.contact_phone,
  });
  const [note, setNote] = useState(quote.note);
  const [taxEnabled, setTaxEnabled] = useState(quote.tax > 0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + (i.unit_price || 0) * (i.quantity || 0), 0),
    [items]
  );

  function setItem(index: number, patch: Partial<QuoteLineItem>) {
    setItems(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  async function handleSave(): Promise<boolean> {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const fd = new FormData();
      fd.set("id", quote.id);
      fd.set("line_items", JSON.stringify(items.filter((i) => i.name.trim())));
      fd.set("contact_name", contact.contact_name);
      fd.set("contact_email", contact.contact_email);
      fd.set("contact_phone", contact.contact_phone);
      fd.set("note", note);
      if (taxEnabled) fd.set("tax_enabled", "on");
      await saveQuote(fd);
      setMessage("已儲存 ✓");
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "儲存失敗");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove() {
    if (!contact.contact_email) {
      setError("請先填寫客戶 email");
      return;
    }
    if (!confirm("儲存並寄出報價單給客戶?")) return;
    const saved = await handleSave();
    if (!saved) return;
    setBusy(true);
    try {
      await approveAndSendQuote(quote.id);
      setMessage("報價單已寄出 ✓");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "寄送失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="iv-card">
        <h3 className="mb-3 font-bold">客戶資訊</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            className="iv-input"
            placeholder="姓名"
            disabled={!editable}
            value={contact.contact_name}
            onChange={(e) => setContact({ ...contact, contact_name: e.target.value })}
          />
          <input
            className="iv-input"
            placeholder="Email *"
            type="email"
            disabled={!editable}
            value={contact.contact_email}
            onChange={(e) => setContact({ ...contact, contact_email: e.target.value })}
          />
          <input
            className="iv-input"
            placeholder="電話"
            disabled={!editable}
            value={contact.contact_phone}
            onChange={(e) => setContact({ ...contact, contact_phone: e.target.value })}
          />
        </div>
      </section>

      <section className="iv-card">
        <h3 className="mb-3 font-bold">報價品項</h3>
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i} className="grid grid-cols-[1fr_88px_64px_36px] items-center gap-2 sm:grid-cols-[1fr_110px_80px_40px]">
              <div>
                <input
                  className="iv-input !min-h-10"
                  placeholder="品項名稱"
                  disabled={!editable}
                  value={item.name}
                  onChange={(e) => setItem(i, { name: e.target.value })}
                />
                <input
                  className="mt-1 w-full rounded-lg border border-line/60 px-3 py-1 text-xs text-ink-soft outline-none focus:border-accent"
                  placeholder="備註(選填)"
                  disabled={!editable}
                  value={item.note ?? ""}
                  onChange={(e) => setItem(i, { note: e.target.value })}
                />
              </div>
              <input
                className="iv-input !min-h-10 text-right"
                type="number"
                min={0}
                placeholder="單價"
                disabled={!editable}
                value={item.unit_price}
                onChange={(e) => setItem(i, { unit_price: parseInt(e.target.value, 10) || 0 })}
              />
              <input
                className="iv-input !min-h-10 text-right"
                type="number"
                min={1}
                placeholder="數量"
                disabled={!editable}
                value={item.quantity}
                onChange={(e) => setItem(i, { quantity: parseInt(e.target.value, 10) || 1 })}
              />
              <button
                aria-label="移除品項"
                disabled={!editable}
                onClick={() => setItems(items.filter((_, j) => j !== i))}
                className="text-ink-soft hover:text-danger disabled:opacity-30"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        {editable && (
          <button
            onClick={() => setItems([...items, { name: "", unit_price: 0, quantity: 1, note: "" }])}
            className="mt-3 text-sm font-medium text-accent"
          >
            + 新增品項
          </button>
        )}

        <div className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-ink-soft">小計</span>
            <span>{formatTWD(subtotal)}</span>
          </div>
          <label className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-ink-soft">
              <input
                type="checkbox"
                checked={taxEnabled}
                disabled={!editable}
                onChange={(e) => setTaxEnabled(e.target.checked)}
                className="h-4 w-4 accent-[#2742f5]"
              />
              加計 5% 稅金
            </span>
            <span>{taxEnabled ? formatTWD(Math.round(subtotal * 0.05)) : "—"}</span>
          </label>
          <div className="flex justify-between pt-1 font-bold">
            <span>合計</span>
            <span className="text-accent">
              {formatTWD(subtotal + (taxEnabled ? Math.round(subtotal * 0.05) : 0))}
            </span>
          </div>
        </div>
      </section>

      <section className="iv-card">
        <h3 className="mb-3 font-bold">內部備註 / 需求摘要</h3>
        <textarea
          rows={3}
          className="iv-input min-h-20"
          disabled={!editable}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </section>

      {(error || message) && (
        <p
          className={`rounded-lg p-3 text-sm ${
            error ? "bg-danger-soft text-danger" : "bg-ok-soft text-ok"
          }`}
        >
          {error || message}
        </p>
      )}

      {editable && (
        <div className="flex flex-wrap gap-3">
          <button onClick={handleSave} disabled={busy} className="iv-btn-ghost">
            儲存草稿
          </button>
          <button onClick={handleApprove} disabled={busy} className="iv-btn-primary">
            {quote.status === "draft" ? "核准並寄出" : "重新寄出"}
          </button>
          {quote.status === "draft" && (
            <button
              disabled={busy}
              className="iv-btn-danger"
              onClick={async () => {
                if (!confirm("確定刪除此草稿?")) return;
                await deleteQuote(quote.id);
                router.push("/admin/quotes");
              }}
            >
              刪除草稿
            </button>
          )}
        </div>
      )}
    </div>
  );
}
