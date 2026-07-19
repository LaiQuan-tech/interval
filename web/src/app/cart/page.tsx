"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
  CART_EVENT,
  cartSubtotal,
  readCart,
  updateQuantity,
  type CartItem,
} from "@/lib/cart";
import { formatTWD } from "@/lib/format";

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
    <div className="iv-container py-8 sm:py-12">
      <h1 className="text-2xl font-bold sm:text-3xl">購物車</h1>

      {!ready ? null : items.length === 0 ? (
        <div className="iv-card mt-8 flex flex-col items-center gap-4 py-12 text-center">
          <p className="text-ink-soft">購物車是空的</p>
          <Link href="/products" className="iv-btn-primary">
            去逛逛商品
          </Link>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.productId} className="iv-card flex gap-4 !p-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-paper">
                  {item.image ? (
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center font-bold text-line">
                      iv
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col justify-between">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/products/${item.slug}`}
                      className="line-clamp-2 text-sm font-medium sm:text-base"
                    >
                      {item.name}
                    </Link>
                    <button
                      aria-label="移除"
                      onClick={() => updateQuantity(item.productId, 0)}
                      className="text-ink-soft hover:text-danger"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center rounded-full border border-line">
                      <button
                        aria-label="減少"
                        onClick={() =>
                          updateQuantity(item.productId, item.quantity - 1)
                        }
                        className="flex h-9 w-9 items-center justify-center"
                      >
                        −
                      </button>
                      <span className="w-7 text-center text-sm font-semibold">
                        {item.quantity}
                      </span>
                      <button
                        aria-label="增加"
                        onClick={() =>
                          updateQuantity(item.productId, item.quantity + 1)
                        }
                        className="flex h-9 w-9 items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                    <span className="font-bold text-accent">
                      {formatTWD(item.price * item.quantity)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="iv-card h-fit lg:sticky lg:top-20">
            <h2 className="font-bold">訂單摘要</h2>
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
            <div className="mt-4 flex justify-between border-t border-line pt-4 font-bold">
              <span>合計</span>
              <span className="text-accent">{formatTWD(subtotal)}</span>
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
