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
import { formatTWD, PURCHASE_MODE_LABEL } from "@/lib/format";
import Placeholder, { gradientForId } from "@/components/Placeholder";

export default function CartPage() {
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
      <h1 className="font-serif text-[26px] font-normal text-ink sm:text-[32px]">購物車</h1>

      {!ready ? null : items.length === 0 ? (
        <div className="iv-card mt-8 flex flex-col items-center gap-4 py-14 text-center">
          <p className="text-ink-soft">購物車是空的</p>
          <Link href="/gallery" className="iv-btn-primary">
            去逛逛典藏
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
                        {PURCHASE_MODE_LABEL[item.mode] ?? item.mode}
                      </span>
                    </div>
                    <button
                      aria-label="移除"
                      onClick={() => updateQuantity(item.productId, item.mode, 0)}
                      className="text-ink-soft hover:text-danger"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center border border-line-2">
                      <button
                        aria-label="減少"
                        onClick={() => updateQuantity(item.productId, item.mode, item.quantity - 1)}
                        className="flex h-9 w-9 items-center justify-center text-ink-deep"
                      >
                        −
                      </button>
                      <span className="w-7 text-center text-sm font-semibold">{item.quantity}</span>
                      <button
                        aria-label="增加"
                        onClick={() => updateQuantity(item.productId, item.mode, item.quantity + 1)}
                        className="flex h-9 w-9 items-center justify-center text-ink-deep"
                      >
                        +
                      </button>
                    </div>
                    <span className="font-serif text-ink">{formatTWD(item.price * item.quantity)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="iv-card h-fit lg:sticky lg:top-24">
            <h2 className="font-serif text-lg text-ink">訂單摘要</h2>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-soft">小計</span>
                <span>{formatTWD(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">運費</span>
                <span>結帳時計算</span>
              </div>
            </div>
            <div className="mt-4 flex justify-between border-t border-line pt-4 font-medium">
              <span>合計</span>
              <span className="font-serif text-[18px] text-ink">{formatTWD(subtotal)}</span>
            </div>
            <Link href="/checkout" className="iv-btn-primary mt-5 w-full">
              前往結帳
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
