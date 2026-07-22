"use client";

import { useState } from "react";
import { createBooking } from "@/lib/bookings";
import { useTranslations } from "@/lib/i18n/context";

// 注意:BOOKING_PURPOSES 在 lib/bookings.ts 內與 server action 同檔("use server"),
// 該檔案的匯出僅能是 async function,無法把純常數陣列匯出給 client component 使用
// (會在 next build 造成 prerender 錯誤),因此在此複製一份同值常數,不變動 lib/。
// slug 只在本檔追蹤選取狀態與當 React key;送出 DB 的值一律用當前 locale 對應的
// messages.booking.purposes[slug] 文字本身(zh 時與改動前逐字相同)。
const BOOKING_PURPOSE_SLUGS = ["appreciate", "rental", "journey", "membership"] as const;
type BookingPurposeSlug = (typeof BOOKING_PURPOSE_SLUGS)[number];

export default function BookingForm() {
  const { locale, messages: t } = useTranslations();
  const TIME_SLOTS = [t.booking.timeSlots.morning, t.booking.timeSlots.afternoon, t.booking.timeSlots.evening];

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    partySize: "",
    purpose: BOOKING_PURPOSE_SLUGS[0] as BookingPurposeSlug,
    visitDate: "",
    timeSlot: TIME_SLOTS[0],
    message: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || submitted) return;
    setError("");
    setSubmitting(true);

    const noteLines = [
      form.partySize && `${t.booking.partyNotePrefix}${form.partySize}`,
      form.timeSlot && `${t.booking.slotNotePrefix}${form.timeSlot}`,
      form.message,
    ].filter(Boolean);

    const result = await createBooking(
      {
        name: form.name,
        email: form.email,
        phone: form.phone,
        visit_date: form.visitDate,
        purpose: t.booking.purposes[form.purpose],
        message: noteLines.join("\n"),
      },
      locale
    );

    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSubmitted(true);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5.5">
      <div>
        <label className="iv-label" htmlFor="b-name">{t.booking.nameLabel}</label>
        <input
          id="b-name"
          required
          placeholder={t.booking.namePlaceholder}
          className="iv-input"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>

      <div>
        <label className="iv-label" htmlFor="b-email">{t.booking.emailLabel}</label>
        <input
          id="b-email"
          type="email"
          required
          placeholder="you@example.com"
          className="iv-input"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="iv-label" htmlFor="b-phone">{t.booking.phoneLabel}</label>
          <input
            id="b-phone"
            placeholder={t.booking.phonePlaceholder}
            className="iv-input"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div>
          <label className="iv-label" htmlFor="b-party">{t.booking.partyLabel}</label>
          <input
            id="b-party"
            placeholder={t.booking.partyPlaceholder}
            className="iv-input"
            value={form.partySize}
            onChange={(e) => setForm({ ...form, partySize: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="iv-label">{t.booking.purposeLabel}</label>
        <div className="flex flex-wrap gap-2.5">
          {BOOKING_PURPOSE_SLUGS.map((slug) => (
            <button
              type="button"
              key={slug}
              onClick={() => setForm({ ...form, purpose: slug })}
              data-active={form.purpose === slug}
              className="lm-chip"
            >
              {t.booking.purposes[slug]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="iv-label" htmlFor="b-date">{t.booking.dateLabel}</label>
          <input
            id="b-date"
            type="date"
            className="iv-input"
            value={form.visitDate}
            onChange={(e) => setForm({ ...form, visitDate: e.target.value })}
          />
        </div>
        <div>
          <label className="iv-label" htmlFor="b-slot">{t.booking.slotLabel}</label>
          <select
            id="b-slot"
            className="iv-input"
            value={form.timeSlot}
            onChange={(e) => setForm({ ...form, timeSlot: e.target.value })}
          >
            {TIME_SLOTS.map((slot) => (
              <option key={slot}>{slot}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="iv-label" htmlFor="b-message">{t.booking.messageLabel}</label>
        <textarea
          id="b-message"
          rows={3}
          placeholder={t.booking.messagePlaceholder}
          className="iv-input resize-y"
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
        />
      </div>

      {error && (
        <p className="rounded-[2px] bg-danger-soft p-3 text-sm text-danger">{error}</p>
      )}

      <button
        type="submit"
        disabled={submitting || submitted}
        className="iv-btn-primary mt-2 w-full"
      >
        {submitted ? t.booking.submitted : submitting ? t.booking.submitting : t.booking.submit}
      </button>
    </form>
  );
}
