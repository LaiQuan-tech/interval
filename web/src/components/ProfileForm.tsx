"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ProfileForm({
  initial,
}: {
  initial: { name: string; phone: string; line_id: string };
}) {
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage("");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ name: form.name, phone: form.phone, line_id: form.line_id })
      .eq("id", user.id);
    setMessage(error ? "儲存失敗,請再試一次" : "已儲存 ✓");
    setSaving(false);
  }

  return (
    <form onSubmit={save} className="iv-card space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="iv-label" htmlFor="p-name">姓名</label>
          <input
            id="p-name"
            className="iv-input"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label className="iv-label" htmlFor="p-phone">電話</label>
          <input
            id="p-phone"
            type="tel"
            className="iv-input"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="iv-label" htmlFor="p-line">LINE ID</label>
          <input
            id="p-line"
            className="iv-input"
            value={form.line_id}
            onChange={(e) => setForm({ ...form, line_id: e.target.value })}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="iv-btn-primary">
          {saving ? "儲存中…" : "儲存"}
        </button>
        {message && <span className="text-sm text-ink-soft">{message}</span>}
      </div>
    </form>
  );
}
