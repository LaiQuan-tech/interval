"use client";

import { useEffect, useState } from "react";
import { CART_EVENT, cartCount, openCart, readCart } from "@/lib/cart";
import { useTranslations } from "@/lib/i18n/context";

// 點擊開啟購物車 flyout(取代直接導向 /cart;/cart 頁仍保留,可從 flyout 內連過去)
export default function CartLink() {
  const { messages } = useTranslations();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const update = () => setCount(cartCount(readCart()));
    update();
    window.addEventListener(CART_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(CART_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return (
    <button
      type="button"
      onClick={() => openCart()}
      aria-label={messages.cart.ariaLabel}
      className="relative flex h-11 w-11 items-center justify-center text-ink-deep hover:bg-panel"
    >
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="9" cy="20" r="1.5" />
        <circle cx="17" cy="20" r="1.5" />
        <path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 8H6" />
      </svg>
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-gold px-1 text-[10.5px] font-bold text-ink-deep">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
