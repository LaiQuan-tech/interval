"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { formatTWD, getPurchaseModeLabel, localizeText } from "@/lib/format";
import { resizeToJpeg, type PendingImage } from "@/lib/image";
import Placeholder, { gradientForId } from "@/components/Placeholder";
import QuickAddButton from "@/components/QuickAddButton";
import { useTranslations } from "@/lib/i18n/context";
import type { Product } from "@/lib/types";

// 4 個示範空間(白名單與圖檔見 web/src/app/api/chat/mockup/route.ts、public/rooms/)。
// key 對應 messages.mockup.demoRooms 的 key。
const DEMO_ROOMS: { slug: string; key: "livingNordic" | "diningWarmWood" | "bedroomMinimal" | "studyQuiet" }[] = [
  { slug: "living-nordic", key: "livingNordic" },
  { slug: "dining-warm-wood", key: "diningWarmWood" },
  { slug: "bedroom-minimal", key: "bedroomMinimal" },
  { slug: "study-quiet", key: "studyQuiet" },
];

type Step = "pick" | "loading" | "result";

type MockupResult = {
  mockupUrl: string;
  productId: string;
  price: number;
  priceRentalMonthly: number | null;
};

// 作品詳情頁的「先看看掛在我家的樣子」flyout:選空間(或上傳自家照片)→ 生成模擬圖 → 直接加入購物車。
// 骨架抄自 CartFlyout(overlay + translate-x 滑出 + Esc 關閉 + body overflow lock),寬度改 max-w-2xl。
export default function RoomMockupFlyout({
  open,
  onClose,
  product,
}: {
  open: boolean;
  onClose: () => void;
  product: Product;
}) {
  const { locale, messages } = useTranslations();
  const [step, setStep] = useState<Step>("pick");
  const [selectedDemo, setSelectedDemo] = useState("");
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [result, setResult] = useState<MockupResult | null>(null);
  const [error, setError] = useState("");
  const [imgExpired, setImgExpired] = useState(false);
  const sessionIdRef = useRef<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!sessionIdRef.current) {
      sessionIdRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
  }, []);

  // 每次開啟都重新從選擇畫面開始,不沿用上次的殘留結果
  useEffect(() => {
    if (open) resetToPick();
  }, [open]);

  // Esc 關閉 + body scroll lock(與 CartFlyout 同款寫法)。
  // 必須確實還原 overflow,否則客戶關掉這個 flyout 後整頁會卡死不能捲動。
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  function resetToPick() {
    setStep("pick");
    setError("");
    setImgExpired(false);
    setSelectedDemo("");
    setPendingImage(null);
    setResult(null);
  }

  async function generateMockup(
    payload: { demoRoom: string } | { image: { mime: string; base64: string } }
  ) {
    setStep("loading");
    setError("");
    setImgExpired(false);
    try {
      const res = await fetch("/api/chat/mockup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          artworkSlug: product.slug,
          locale,
          ...payload,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || messages.mockup.failRetry);
      }
      setResult({
        mockupUrl: data.mockupUrl,
        productId: data.productId,
        price: data.price,
        priceRentalMonthly: data.priceRentalMonthly ?? null,
      });
      setStep("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : messages.mockup.failRetry);
      setStep("pick");
    }
  }

  function handleDemoSelect(slug: string) {
    if (step === "loading") return;
    setSelectedDemo(slug);
    generateMockup({ demoRoom: slug });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 允許重選同一張
    if (!file || step === "loading") return;
    setError("");
    try {
      const resized = await resizeToJpeg(file);
      setPendingImage(resized);
      setSelectedDemo("");
      generateMockup({ image: { mime: resized.mime, base64: resized.base64 } });
    } catch {
      setError(messages.mockup.imageUnreadable);
    }
  }

  // 用 data-chat-fab(與翻譯無關的穩定屬性)找 ChatWidget 的 FAB,不要用 aria-label——
  // aria-label 會依語言 i18n,/en 頁面上找不到會導致這顆按鈕靜默失效。
  function openChat() {
    const fab = document.querySelector<HTMLButtonElement>("[data-chat-fab]");
    fab?.click();
    fab?.scrollIntoView({ behavior: "smooth", block: "end" });
    onClose();
  }

  const hasRental = result?.priceRentalMonthly != null;
  const displayName = localizeText(product.name, product.name_en, locale);

  return (
    <>
      <div
        aria-hidden={!open}
        onClick={onClose}
        className={`fixed inset-0 z-50 bg-ink-deep/40 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={messages.mockup.dialogTitle}
        className={`fixed right-0 top-0 z-50 flex h-dvh w-full max-w-2xl flex-col bg-paper shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <h2 className="font-serif text-lg text-ink">{messages.mockup.dialogTitle}</h2>
          <button
            type="button"
            aria-label={messages.mockup.close}
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center text-ink-soft hover:text-ink"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {step !== "result" && (
            <div className="flex items-center gap-3 border-b border-line px-6 py-4">
              <Placeholder
                src={product.images?.[0]?.url}
                gradient={gradientForId(product.id)}
                className="h-14 w-14 shrink-0"
              />
              <p className="text-sm font-medium text-ink">{displayName}</p>
            </div>
          )}

          {step === "pick" && (
            <div className="px-6 py-5">
              <p className="mb-4 text-sm text-ink-soft">{messages.mockup.pickHint}</p>
              {error && <p className="mb-3 text-xs text-danger">{error}</p>}
              <div className="grid grid-cols-2 gap-3">
                {DEMO_ROOMS.map((room) => (
                  <button
                    key={room.slug}
                    type="button"
                    onClick={() => handleDemoSelect(room.slug)}
                    className={`overflow-hidden rounded-[2px] border text-left transition-colors ${
                      selectedDemo === room.slug
                        ? "border-ink-deep"
                        : "border-line-2 hover:border-gold"
                    }`}
                  >
                    <div className="relative aspect-[4/3] w-full">
                      <Image
                        src={`/rooms/${room.slug}.jpg`}
                        alt={messages.mockup.demoRooms[room.key]}
                        fill
                        sizes="(max-width: 640px) 50vw, 300px"
                        className="object-cover"
                      />
                    </div>
                    <div
                      className={`px-2 py-1.5 text-xs ${
                        selectedDemo === room.slug
                          ? "bg-ink-deep text-cream-text"
                          : "bg-card text-ink-soft"
                      }`}
                    >
                      {messages.mockup.demoRooms[room.key]}
                    </div>
                  </button>
                ))}
              </div>
              <div className="mt-5 border-t border-line pt-5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="iv-btn-ghost w-full"
                >
                  {messages.mockup.uploadMyPhoto}
                </button>
              </div>
            </div>
          )}

          {step === "loading" && (
            <div className="px-6 py-5">
              {pendingImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={pendingImage.dataUrl}
                  alt={messages.mockup.roomPreviewAlt}
                  className="aspect-[4/3] w-full animate-pulse rounded-[2px] object-cover opacity-70"
                />
              ) : (
                <div className="aspect-[4/3] w-full animate-pulse rounded-[2px] bg-panel" />
              )}
              <div className="mt-4 text-center text-xs text-ink-soft">
                <div className="animate-pulse font-medium text-accent">
                  {messages.mockup.hangingInProgress}
                </div>
                <div className="mt-1">{messages.mockup.hangingWait}</div>
              </div>
            </div>
          )}

          {step === "result" && result && (
            <div>
              <div className="w-full">
                {imgExpired ? (
                  <div className="flex aspect-[4/3] w-full items-center justify-center bg-panel px-6 text-center text-sm text-ink-soft">
                    {messages.mockup.imageExpired}
                  </div>
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={result.mockupUrl}
                    alt={`${displayName} ${messages.mockup.mockupAltSuffix}`}
                    className="w-full"
                    onError={() => setImgExpired(true)}
                  />
                )}
              </div>

              <div className="border-t border-line px-6 py-5">
                <div className="mb-5">
                  <span className="font-serif text-[30px] text-ink">
                    {formatTWD(result.price, locale)}
                  </span>
                  {hasRental && (
                    <div className="mt-1 text-[13px] text-muted-2">
                      {messages.mockup.orRentalFromPrefix}
                      {formatTWD(result.priceRentalMonthly!, locale)}
                      {messages.mockup.orRentalFromSuffix}
                    </div>
                  )}
                </div>

                {hasRental ? (
                  <div className="flex gap-2">
                    <QuickAddButton
                      product={{ id: result.productId, slug: product.slug, name: product.name, name_en: product.name_en }}
                      mode="buyout"
                      unitPrice={result.price}
                      label={getPurchaseModeLabel("buyout", locale)}
                      addedLabel={messages.product.addedToCart}
                      onAdded={onClose}
                      className="iv-btn-primary flex-1"
                    />
                    <QuickAddButton
                      product={{ id: result.productId, slug: product.slug, name: product.name, name_en: product.name_en }}
                      mode="rental"
                      unitPrice={result.priceRentalMonthly!}
                      label={getPurchaseModeLabel("rental", locale)}
                      addedLabel={messages.product.addedToCart}
                      onAdded={onClose}
                      className="iv-btn-ghost flex-1"
                    />
                  </div>
                ) : (
                  <QuickAddButton
                    product={{ id: result.productId, slug: product.slug, name: product.name, name_en: product.name_en }}
                    mode="buyout"
                    unitPrice={result.price}
                    label={getPurchaseModeLabel("buyout", locale)}
                    addedLabel={messages.product.addedToCart}
                    onAdded={onClose}
                    className="iv-btn-primary w-full"
                  />
                )}

                <button
                  type="button"
                  onClick={openChat}
                  className="mt-4 block w-full text-center text-xs text-ink-soft underline underline-offset-2 hover:text-accent"
                >
                  {messages.mockup.chatWithAdvisor}
                </button>
                <button
                  type="button"
                  onClick={resetToPick}
                  className="mt-2 block w-full text-center text-xs text-ink-soft underline underline-offset-2 hover:text-accent"
                >
                  {messages.mockup.tryDifferentPhoto}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
