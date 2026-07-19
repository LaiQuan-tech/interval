"use client";

import { useState } from "react";
import { createBooking } from "@/lib/bookings";

// 注意:BOOKING_PURPOSES 在 lib/bookings.ts 內與 server action 同檔("use server"),
// 該檔案的匯出僅能是 async function,無法把純常數陣列匯出給 client component 使用
// (會在 next build 造成 prerender 錯誤),因此在此複製一份同值常數,不變動 lib/。
const BOOKING_PURPOSES = ["鑑賞畫作", "租賃 · 買斷", "規劃旅程", "入會諮詢"] as const;

const TIME_SLOTS = ["上午 11:00 – 13:00", "下午 14:00 – 16:00", "傍晚 17:00 – 19:00"];

export default function BookingForm() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    partySize: "",
    purpose: BOOKING_PURPOSES[0] as string,
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
      form.partySize && `預約人數：${form.partySize}`,
      form.timeSlot && `期望時段：${form.timeSlot}`,
      form.message,
    ].filter(Boolean);

    const result = await createBooking({
      name: form.name,
      email: form.email,
      phone: form.phone,
      visit_date: form.visitDate,
      purpose: form.purpose,
      message: noteLines.join("\n"),
    });

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
        <label className="iv-label" htmlFor="b-name">稱謂 · 姓名</label>
        <input
          id="b-name"
          required
          placeholder="王夫人"
          className="iv-input"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>

      <div>
        <label className="iv-label" htmlFor="b-email">Email</label>
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
          <label className="iv-label" htmlFor="b-phone">聯絡電話</label>
          <input
            id="b-phone"
            placeholder="0900 000 000"
            className="iv-input"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div>
          <label className="iv-label" htmlFor="b-party">預約人數</label>
          <input
            id="b-party"
            placeholder="2"
            className="iv-input"
            value={form.partySize}
            onChange={(e) => setForm({ ...form, partySize: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="iv-label">參訪目的</label>
        <div className="flex flex-wrap gap-2.5">
          {BOOKING_PURPOSES.map((p) => (
            <button
              type="button"
              key={p}
              onClick={() => setForm({ ...form, purpose: p })}
              data-active={form.purpose === p}
              className="lm-chip"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="iv-label" htmlFor="b-date">期望日期</label>
          <input
            id="b-date"
            type="date"
            className="iv-input"
            value={form.visitDate}
            onChange={(e) => setForm({ ...form, visitDate: e.target.value })}
          />
        </div>
        <div>
          <label className="iv-label" htmlFor="b-slot">期望時段</label>
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
        <label className="iv-label" htmlFor="b-message">備註</label>
        <textarea
          id="b-message"
          rows={3}
          placeholder="想鑑賞的作品風格、旅程偏好或其他需求"
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
        {submitted ? "已收到您的預約，我們將盡快聯繫 ✓" : submitting ? "送出中…" : "送出預約"}
      </button>
    </form>
  );
}
