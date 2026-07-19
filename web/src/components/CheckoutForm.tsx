"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cartSubtotal, clearCart, isPhysicalItem, readCart, type CartItem } from "@/lib/cart";
import { formatTWD, PURCHASE_MODE_LABEL } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import type { CompanyProfile, ShippingConfig } from "@/lib/settings";

const TAIWAN_COUNTIES = [
  "台北市", "新北市", "基隆市", "桃園市", "新竹市", "新竹縣", "苗栗縣",
  "台中市", "彰化縣", "南投縣", "雲林縣", "嘉義市", "嘉義縣",
  "台南市", "高雄市", "屏東縣",
  "宜蘭縣", "花蓮縣", "台東縣", "澎湖縣", "金門縣", "連江縣",
];

const PHONE_RE = /^09\d{8}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CARRIER_RE = /^\/[0-9A-Z.+-]{7}$/;
const TAX_ID_RE = /^\d{8}$/;

export default function CheckoutForm({
  isLoggedIn,
  pointsBalance,
  company,
  shippingConfig,
  ecpayAvailable,
}: {
  isLoggedIn: boolean;
  pointsBalance: number;
  company: CompanyProfile;
  shippingConfig: ShippingConfig;
  ecpayAvailable: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pointsInput, setPointsInput] = useState("0");
  const idempotencyKeyRef = useRef<string | null>(null);

  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [note, setNote] = useState("");
  const [shippingMethod, setShippingMethod] = useState<"home" | "pickup">("home");
  const [address, setAddress] = useState({ county: "", district: "", postal: "", detail: "" });
  const [invoiceType, setInvoiceType] = useState<"personal" | "company">("personal");
  const [carrier, setCarrier] = useState("");
  const [taxId, setTaxId] = useState("");
  const [companyTitle, setCompanyTitle] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"bank_transfer" | "cod" | "card">(
    "bank_transfer"
  );

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
      setContact((f) => ({
        name: f.name || profile?.name || "",
        email: f.email || profile?.email || data.user?.email || "",
        phone: f.phone || profile?.phone || "",
      }));
    });
  }, []);

  const subtotal = cartSubtotal(items);
  const maxRedeemable = Math.max(0, Math.min(pointsBalance, subtotal));
  const pointsUsed = Math.max(0, Math.min(maxRedeemable, Number(pointsInput) || 0));

  // 購物車全為非實體(journey/membership)時不顯示收件區塊、不計運費
  const hasPhysical = useMemo(() => items.some(isPhysicalItem), [items]);
  const effectiveShippingMethod = hasPhysical ? shippingMethod : "none";
  const physicalSubtotal = useMemo(
    () => cartSubtotal(items.filter(isPhysicalItem)),
    [items]
  );
  const shippingFee =
    !hasPhysical || effectiveShippingMethod === "pickup"
      ? 0
      : physicalSubtotal >= shippingConfig.free_threshold_home
        ? 0
        : shippingConfig.fee_home;

  const total = Math.max(0, subtotal + shippingFee - pointsUsed);

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!contact.name.trim()) e.name = "請輸入姓名";
    if (!EMAIL_RE.test(contact.email.trim())) e.email = "請輸入正確的 email";
    if (!PHONE_RE.test(contact.phone.trim())) e.phone = "請輸入正確的手機號碼(09xxxxxxxx)";

    if (hasPhysical && effectiveShippingMethod === "home") {
      if (!address.county) e.county = "請選擇縣市";
      if (!address.district.trim()) e.district = "請輸入鄉鎮市區";
      if (!address.detail.trim()) e.detail = "請輸入詳細地址";
    }

    if (invoiceType === "personal" && carrier.trim() && !CARRIER_RE.test(carrier.trim())) {
      e.carrier = "手機條碼格式錯誤,例:/ABC1234";
    }
    if (invoiceType === "company") {
      if (!TAX_ID_RE.test(taxId.trim())) e.taxId = "統一編號須為 8 碼數字";
      if (!companyTitle.trim()) e.companyTitle = "請輸入公司抬頭";
    }
    return e;
  }

  function scrollToFirstError(errs: Record<string, string>) {
    const firstKey = Object.keys(errs)[0];
    if (!firstKey) return;
    const el = document.getElementById(firstKey);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.focus?.();
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      scrollToFirstError(errs);
      return;
    }
    setErrors({});
    setError("");
    setSubmitting(true);
    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKeyRef.current,
        },
        body: JSON.stringify({
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity, mode: i.mode })),
          contact: { name: contact.name, email: contact.email, phone: contact.phone, note },
          shipping: {
            method: effectiveShippingMethod,
            county: address.county,
            district: address.district,
            postal: address.postal,
            detail: address.detail,
          },
          invoice: {
            type: invoiceType,
            carrier: invoiceType === "personal" ? carrier.trim() : "",
            tax_id: invoiceType === "company" ? taxId.trim() : "",
            title: invoiceType === "company" ? companyTitle.trim() : "",
          },
          payment_method: paymentMethod,
          pointsUsed,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.orderToken) {
        throw new Error(data.error ?? "訂單建立失敗，請再試一次");
      }
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
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
                  className="iv-input"
                  value={contact.name}
                  onChange={(e) => setContact({ ...contact, name: e.target.value })}
                />
                {errors.name && <p className="mt-1 text-xs text-danger">{errors.name}</p>}
              </div>
              <div>
                <label className="iv-label" htmlFor="phone">電話 *</label>
                <input
                  id="phone"
                  type="tel"
                  className="iv-input"
                  placeholder="09xxxxxxxx"
                  value={contact.phone}
                  onChange={(e) => setContact({ ...contact, phone: e.target.value })}
                />
                {errors.phone && <p className="mt-1 text-xs text-danger">{errors.phone}</p>}
              </div>
              <div className="sm:col-span-2">
                <label className="iv-label" htmlFor="email">Email *</label>
                <input
                  id="email"
                  type="email"
                  className="iv-input"
                  value={contact.email}
                  onChange={(e) => setContact({ ...contact, email: e.target.value })}
                />
                {errors.email && <p className="mt-1 text-xs text-danger">{errors.email}</p>}
              </div>
            </div>
          </section>

          {hasPhysical && (
            <section className="iv-card">
              <h2 className="font-serif text-lg text-ink">收件方式</h2>
              <div className="mt-4 space-y-3">
                {[
                  { value: "home" as const, label: "宅配到府", desc: "運費依訂單金額計算" },
                  { value: "pickup" as const, label: "門市自取", desc: "免運費,可至門市取貨" },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex cursor-pointer items-center gap-3 border p-4 ${
                      shippingMethod === opt.value ? "border-gold bg-panel" : "border-line"
                    }`}
                  >
                    <input
                      type="radio"
                      name="shippingMethod"
                      value={opt.value}
                      checked={shippingMethod === opt.value}
                      onChange={() => setShippingMethod(opt.value)}
                      className="h-4 w-4 accent-[#9a7d47]"
                    />
                    <span>
                      <span className="block font-medium text-ink">{opt.label}</span>
                      <span className="block text-xs text-ink-soft">{opt.desc}</span>
                    </span>
                  </label>
                ))}
              </div>

              {shippingMethod === "home" ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="iv-label" htmlFor="county">縣市 *</label>
                    <select
                      id="county"
                      className="iv-input"
                      value={address.county}
                      onChange={(e) => setAddress({ ...address, county: e.target.value })}
                    >
                      <option value="">請選擇</option>
                      {TAIWAN_COUNTIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    {errors.county && <p className="mt-1 text-xs text-danger">{errors.county}</p>}
                  </div>
                  <div>
                    <label className="iv-label" htmlFor="district">鄉鎮市區 *</label>
                    <input
                      id="district"
                      className="iv-input"
                      value={address.district}
                      onChange={(e) => setAddress({ ...address, district: e.target.value })}
                    />
                    {errors.district && <p className="mt-1 text-xs text-danger">{errors.district}</p>}
                  </div>
                  <div>
                    <label className="iv-label" htmlFor="postal">郵遞區號</label>
                    <input
                      id="postal"
                      className="iv-input"
                      value={address.postal}
                      onChange={(e) => setAddress({ ...address, postal: e.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="iv-label" htmlFor="detail">詳細地址 *</label>
                    <input
                      id="detail"
                      className="iv-input"
                      value={address.detail}
                      onChange={(e) => setAddress({ ...address, detail: e.target.value })}
                    />
                    {errors.detail && <p className="mt-1 text-xs text-danger">{errors.detail}</p>}
                  </div>
                </div>
              ) : (
                <div className="mt-4 border border-line bg-panel p-4 text-sm">
                  <p className="font-medium text-ink">{company.name}</p>
                  <p className="mt-1 text-ink-soft">{company.address || "門市地址請洽客服"}</p>
                  <p className="mt-1 text-ink-soft">{company.hours || ""}</p>
                </div>
              )}
            </section>
          )}

          <section className="iv-card">
            <h2 className="font-serif text-lg text-ink">發票</h2>
            <div className="mt-4 space-y-3">
              {[
                { value: "personal" as const, label: "個人(雲端發票)" },
                { value: "company" as const, label: "公司(統編發票)" },
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-center gap-3 border p-4 ${
                    invoiceType === opt.value ? "border-gold bg-panel" : "border-line"
                  }`}
                >
                  <input
                    type="radio"
                    name="invoiceType"
                    value={opt.value}
                    checked={invoiceType === opt.value}
                    onChange={() => setInvoiceType(opt.value)}
                    className="h-4 w-4 accent-[#9a7d47]"
                  />
                  <span className="font-medium text-ink">{opt.label}</span>
                </label>
              ))}
            </div>

            {invoiceType === "personal" ? (
              <div className="mt-4">
                <label className="iv-label" htmlFor="carrier">手機條碼載具(選填)</label>
                <input
                  id="carrier"
                  className="iv-input"
                  placeholder="/ABC1234"
                  value={carrier}
                  onChange={(e) => setCarrier(e.target.value)}
                />
                {errors.carrier && <p className="mt-1 text-xs text-danger">{errors.carrier}</p>}
              </div>
            ) : (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="iv-label" htmlFor="taxId">統一編號 *</label>
                  <input
                    id="taxId"
                    className="iv-input"
                    maxLength={8}
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  />
                  {errors.taxId && <p className="mt-1 text-xs text-danger">{errors.taxId}</p>}
                </div>
                <div>
                  <label className="iv-label" htmlFor="companyTitle">公司抬頭 *</label>
                  <input
                    id="companyTitle"
                    className="iv-input"
                    value={companyTitle}
                    onChange={(e) => setCompanyTitle(e.target.value)}
                  />
                  {errors.companyTitle && (
                    <p className="mt-1 text-xs text-danger">{errors.companyTitle}</p>
                  )}
                </div>
              </div>
            )}
          </section>

          <section className="iv-card">
            <h2 className="font-serif text-lg text-ink">付款方式</h2>
            <div className="mt-4 space-y-3">
              {[
                { value: "bank_transfer" as const, label: "銀行轉帳", desc: "訂單成立後提供匯款帳號" },
                { value: "cod" as const, label: "貨到付款", desc: "收到商品時付款" },
                ...(ecpayAvailable
                  ? [{ value: "card" as const, label: "信用卡", desc: "線上刷卡付款" }]
                  : []),
              ].map((opt) => (
                <label
                  key={opt.value}
                  className={`flex cursor-pointer items-center gap-3 border p-4 ${
                    paymentMethod === opt.value ? "border-gold bg-panel" : "border-line"
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value={opt.value}
                    checked={paymentMethod === opt.value}
                    onChange={() => setPaymentMethod(opt.value)}
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
              value={note}
              onChange={(e) => setNote(e.target.value)}
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
            <div className="flex justify-between">
              <span className="text-ink-soft">運費</span>
              <span>
                {!hasPhysical
                  ? "無需配送"
                  : effectiveShippingMethod === "pickup"
                    ? "免運(門市自取)"
                    : shippingFee === 0
                      ? "免運"
                      : formatTWD(shippingFee)}
              </span>
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
