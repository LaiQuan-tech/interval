"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CART_EVENT,
  CART_OPEN_EVENT,
  cartSubtotal,
  isPhysicalItem,
  readCart,
  updateQuantity,
  type CartItem,
} from "@/lib/cart";
import { formatTWD, getPurchaseModeLabel, localizeText } from "@/lib/format";
import Placeholder, { gradientForId } from "@/components/Placeholder";
import { useTranslations } from "@/lib/i18n/context";
import { localeHref } from "@/lib/i18n/href";

// 右側滑出的購物車抽屜。自寫 fixed overlay + transform,不引入 shadcn,維持象牙沙龍視覺。
// 開啟時機:加入購物車後(CART_OPEN_EVENT)自動滑出;Header 的購物車圖示點擊也會觸發。
export default function CartFlyout({
  shippingConfig,
}: {
  shippingConfig: { fee_home: number; free_threshold_home: number };
}) {
  const { locale, messages } = useTranslations();
  const t = messages.cart;
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const update = () => setItems(readCart());
    update();
    const openHandler = () => setOpen(true);
    window.addEventListener(CART_EVENT, update);
    window.addEventListener(CART_OPEN_EVENT, openHandler);
    return () => {
      window.removeEventListener(CART_EVENT, update);
      window.removeEventListener(CART_OPEN_EVENT, openHandler);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const subtotal = cartSubtotal(items);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const physicalItems = items.filter(isPhysicalItem);
  const physicalSubtotal = cartSubtotal(physicalItems);
  const hasPhysical = physicalItems.length > 0;
  const threshold = shippingConfig.free_threshold_home;
  const remaining = Math.max(0, threshold - physicalSubtotal);
  const reached = threshold <= 0 || remaining <= 0;
  const progressPct = threshold > 0 ? Math.min(100, Math.round((physicalSubtotal / threshold) * 100)) : 100;

  return (
    <>
      <div
        aria-hidden={!open}
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-50 bg-ink-deep/40 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.ariaLabel}
        className={`fixed right-0 top-0 z-50 flex h-dvh w-full max-w-md flex-col bg-paper shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <h2 className="font-serif text-lg text-ink">
            {t.title}
            {itemCount > 0 && (
              <span className="ml-2 font-sans text-sm text-ink-soft">({itemCount})</span>
            )}
          </h2>
          <button
            type="button"
            aria-label={t.closeAriaLabel}
            onClick={() => setOpen(false)}
            className="flex h-9 w-9 items-center justify-center text-ink-soft hover:text-ink"
          >
            ✕
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
            <p className="text-ink-soft">{t.empty}</p>
            <Link href={localeHref("/gallery", locale)} onClick={() => setOpen(false)} className="iv-btn-primary">
              {t.browseCollection}
            </Link>
          </div>
        ) : (
          <>
            {hasPhysical && (
              <div className="border-b border-line bg-panel px-6 py-3 shrink-0">
                <p className="text-xs text-ink-soft">
                  {reached ? (
                    t.freeShippingReached
                  ) : (
                    <>
                      {t.freeShippingPrefix}
                      <span className="font-semibold text-accent">{formatTWD(remaining, locale)}</span>
                      {t.freeShippingSuffix}
                    </>
                  )}
                </p>
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full bg-gold transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={`${item.productId}-${item.mode}`} className="flex gap-3">
                    <Placeholder gradient={gradientForId(item.productId)} className="h-16 w-16 shrink-0" />
                    <div className="flex flex-1 flex-col justify-between">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="line-clamp-2 text-sm font-medium text-ink">
                            {localizeText(item.name, item.name_en, locale)}
                          </p>
                          <span className="mt-0.5 inline-block text-[11px] text-accent">
                            {getPurchaseModeLabel(item.mode, locale)}
                          </span>
                        </div>
                        <button
                          type="button"
                          aria-label={t.removeAriaLabel}
                          onClick={() => updateQuantity(item.productId, item.mode, 0)}
                          className="shrink-0 text-ink-soft hover:text-danger"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center border border-line-2">
                          <button
                            type="button"
                            aria-label={t.decreaseAriaLabel}
                            onClick={() => updateQuantity(item.productId, item.mode, item.quantity - 1)}
                            className="flex h-7 w-7 items-center justify-center text-sm text-ink-deep"
                          >
                            −
                          </button>
                          <span className="w-6 text-center text-xs font-semibold">{item.quantity}</span>
                          <button
                            type="button"
                            aria-label={t.increaseAriaLabel}
                            onClick={() => updateQuantity(item.productId, item.mode, item.quantity + 1)}
                            className="flex h-7 w-7 items-center justify-center text-sm text-ink-deep"
                          >
                            +
                          </button>
                        </div>
                        <span className="font-serif text-sm text-ink">
                          {formatTWD(item.price * item.quantity, locale)}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="shrink-0 space-y-3 border-t border-line px-6 py-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-soft">{t.subtotal}</span>
                <span className="font-serif text-[17px] text-ink">{formatTWD(subtotal, locale)}</span>
              </div>
              <p className="text-xs text-ink-soft">{t.shippingCalcNote}</p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setOpen(false)} className="iv-btn-ghost">
                  {t.continueShopping}
                </button>
                <Link href={localeHref("/checkout", locale)} onClick={() => setOpen(false)} className="iv-btn-primary">
                  {t.proceedToCheckout}
                </Link>
              </div>
              <Link
                href={localeHref("/cart", locale)}
                onClick={() => setOpen(false)}
                className="block text-center text-xs tracking-[0.04em] text-ink-soft underline underline-offset-2"
              >
                {t.viewFullCart}
              </Link>
            </div>
          </>
        )}
      </div>
    </>
  );
}
