"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CART_EVENT,
  cartSubtotal,
  readCart,
  updateQuantity,
  type CartItem,
} from "@/lib/cart";
import { formatTWD, getPurchaseModeLabel } from "@/lib/format";
import Placeholder, { gradientForId } from "@/components/Placeholder";
import { useTranslations } from "@/lib/i18n/context";

export default function CartPage() {
  const { locale, messages } = useTranslations();
  const t = messages.cart;
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const update = () => setItems(readCart());
    update();
    setReady(true);
    window.addEventListener(CART_EVENT, update);
    return () => window.removeEventListener(CART_EVENT, update);
  }, []);

  const subtotal = cartSubtotal(items);

  return (
    <div className="lm-container py-10 sm:py-16">
      <h1 className="font-serif text-[26px] font-normal text-ink sm:text-[32px]">{t.title}</h1>

      {!ready ? null : items.length === 0 ? (
        <div className="iv-card mt-8 flex flex-col items-center gap-4 py-14 text-center">
          <p className="text-ink-soft">{t.empty}</p>
          <Link href="/gallery" className="iv-btn-primary">
            {t.browseCollection}
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px]">
          <div className="space-y-3">
            {items.map((item) => (
              <div key={`${item.productId}-${item.mode}`} className="iv-card flex gap-4 !p-4">
                <Placeholder
                  gradient={gradientForId(item.productId)}
                  className="h-20 w-20 shrink-0"
                />
                <div className="flex flex-1 flex-col justify-between">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <Link
                        href={`/products/${item.slug}`}
                        className="line-clamp-2 text-sm font-medium text-ink sm:text-base"
                      >
                        {item.name}
                      </Link>
                      <span className="mt-1 inline-block text-[11px] tracking-[0.04em] text-accent">
                        {getPurchaseModeLabel(item.mode, locale)}
                      </span>
                    </div>
                    <button
                      aria-label={t.removeAriaLabel}
                      onClick={() => updateQuantity(item.productId, item.mode, 0)}
                      className="text-ink-soft hover:text-danger"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center border border-line-2">
                      <button
                        aria-label={t.decreaseAriaLabel}
                        onClick={() => updateQuantity(item.productId, item.mode, item.quantity - 1)}
                        className="flex h-9 w-9 items-center justify-center text-ink-deep"
                      >
                        −
                      </button>
                      <span className="w-7 text-center text-sm font-semibold">{item.quantity}</span>
                      <button
                        aria-label={t.increaseAriaLabel}
                        onClick={() => updateQuantity(item.productId, item.mode, item.quantity + 1)}
                        className="flex h-9 w-9 items-center justify-center text-ink-deep"
                      >
                        +
                      </button>
                    </div>
                    <span className="font-serif text-ink">{formatTWD(item.price * item.quantity, locale)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="iv-card h-fit lg:sticky lg:top-24">
            <h2 className="font-serif text-lg text-ink">{t.summaryTitle}</h2>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-soft">{t.subtotal}</span>
                <span>{formatTWD(subtotal, locale)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">{t.shipping}</span>
                <span>{t.shippingCalcAtCheckout}</span>
              </div>
            </div>
            <div className="mt-4 flex justify-between border-t border-line pt-4 font-medium">
              <span>{t.total}</span>
              <span className="font-serif text-[18px] text-ink">{formatTWD(subtotal, locale)}</span>
            </div>
            <Link href="/checkout" className="iv-btn-primary mt-5 w-full">
              {t.proceedToCheckout}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
