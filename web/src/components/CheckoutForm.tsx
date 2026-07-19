"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cartSubtotal, clearCart, readCart, type CartItem } from "@/lib/cart";
import { formatTWD, PURCHASE_MODE_LABEL } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

export default function CheckoutForm({
  isLoggedIn,
  pointsBalance,
}: {
  isLoggedIn: boolean;
  pointsBalance: number;
}) {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [pointsInput, setPointsInput] = useState("0");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    payment_method: "bank_transfer",
    note: "",
  });

  useEffect(() => {
    setItems(readCart());
    setReady(true);
    // 已登入會員自動帶入資料
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("name, email, phone")
        .eq("id", data.user.id)
        .maybeSingle();
      setForm((f) => ({
        ...f,
        name: f.name || profile?.name || "",
        email: f.email || profile?.email || data.user?.email || "",
        phone: f.phone || profile?.phone || "",
      }));
    });
  }, []);

  const subtotal = cartSubtotal(items);
  const maxRedeemable = Math.max(0, Math.min(pointsBalance, subtotal));
  const pointsUsed = Math.max(0, Math.min(maxRedeemable, Number(pointsInput) || 0));
  const total = Math.max(0, subtotal - pointsUsed);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, mode: i.mode })),
          contact: form,
          pointsUsed,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.orderToken) {
        throw new Error(data.error ?? "訂單建立失敗，請再試一次");
      }
      clearCart();
      router.push(`/orders/${data.orderToken}?created=1`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "訂單建立失敗，請再試一次");
      setSubmitting(false);
    }
  }

  const showPoints = useMemo(() => isLoggedIn && pointsBalance > 0, [isLoggedIn, pointsBalance]);

  if (ready && items.length === 0) {
    return (
      <div className="lm-container py-14">
        <div className="iv-card flex flex-col items-center gap-4 py-14 text-center">
          <p className="text-ink-soft">購物車是空的，先去逛逛吧！</p>
          <Link href="/gallery" className="iv-btn-primary">
            去逛逛典藏
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="lm-container py-10 sm:py-16">
      <h1 className="font-serif text-[26px] font-normal text-ink sm:text-[32px]">結帳</h1>

      <form onSubmit={submit} className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          <section className="iv-card">
            <h2 className="font-serif text-lg text-ink">聯絡資料</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="iv-label" htmlFor="name">姓名 *</label>
                <input
                  id="name"
                  required
                  className="iv-input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="iv-label" htmlFor="phone">電話 *</label>
                <input
                  id="phone"
                  required
                  type="tel"
                  className="iv-input"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="iv-label" htmlFor="email">Email *</label>
                <input
                  id="email"
                  required
                  type="email"
                  className="iv-input"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="iv-label" htmlFor="address">收件地址 *</label>
                <input
                  id="address"
                  required
                  className="iv-input"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
            </div>
          </section>

          <section className="iv-card">
            <h2 className="font-serif text-lg text-ink">付款方式</h2>
            <div className="mt-4 space-y-3">
              {[
                { value: "bank_transfer", label: "銀行轉帳", desc: "訂單成立後提供匯款帳號" },
                { value: "cod", label: "貨到付款", desc: "收到商品時付款" },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-center gap-3 border p-4 ${
                    form.payment_method === opt.value ? "border-gold bg-panel" : "border-line"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={opt.value}
                    checked={form.payment_method === opt.value}
                    onChange={() => setForm({ ...form, payment_method: opt.value })}
                    className="h-4 w-4 accent-[#9a7d47]"
                  />
                  <span>
                    <span className="block font-medium text-ink">{opt.label}</span>
                    <span className="block text-xs text-ink-soft">{opt.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>

          {showPoints && (
            <section className="iv-card">
              <h2 className="font-serif text-lg text-ink">點數折抵</h2>
              <p className="mt-1 text-sm text-ink-soft">
                目前可用 <span className="font-semibold text-accent">{pointsBalance.toLocaleString("zh-TW")}</span> 點，1 點折抵 NT$1，最多可折抵 {formatTWD(maxRedeemable)}。
              </p>
              <div className="mt-3 flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={maxRedeemable}
                  className="iv-input max-w-40"
                  value={pointsInput}
                  onChange={(e) => setPointsInput(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setPointsInput(String(maxRedeemable))}
                  className="text-sm tracking-[0.04em] text-accent border-b border-gold pb-0.5"
                >
                  全部折抵
                </button>
              </div>
            </section>
          )}

          <section className="iv-card">
            <h2 className="font-serif text-lg text-ink">備註</h2>
            <textarea
              rows={3}
              className="iv-input mt-4 min-h-24"
              placeholder="有什麼想告訴我們的嗎？(選填)"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </section>
        </div>

        <div className="iv-card h-fit lg:sticky lg:top-24">
          <h2 className="font-serif text-lg text-ink">訂單摘要</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {items.map((i) => (
              <li key={`${i.productId}-${i.mode}`} className="flex justify-between gap-2">
                <span className="line-clamp-1 text-ink-soft">
                  {i.name}
                  <span className="ml-1 text-[11px] text-accent">
                    ({PURCHASE_MODE_LABEL[i.mode] ?? i.mode})
                  </span>
                  {" "}× {i.quantity}
                </span>
                <span className="shrink-0">{formatTWD(i.price * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-soft">小計</span>
              <span>{formatTWD(subtotal)}</span>
            </div>
            {pointsUsed > 0 && (
              <div className="flex justify-between text-accent">
                <span>點數折抵</span>
                <span>-{formatTWD(pointsUsed)}</span>
              </div>
            )}
          </div>
          <div className="mt-3 flex justify-between border-t border-line pt-3 font-medium">
            <span>合計</span>
            <span className="font-serif text-[18px] text-ink">{formatTWD(total)}</span>
          </div>
          {error && (
            <p className="mt-3 rounded-[2px] bg-danger-soft p-3 text-sm text-danger">{error}</p>
          )}
          <button type="submit" disabled={submitting} className="iv-btn-primary mt-5 w-full">
            {submitting ? "建立訂單中…" : "送出訂單"}
          </button>
        </div>
      </form>
    </div>
  );
}
