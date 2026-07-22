"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addToCart, openCart } from "@/lib/cart";
import { useTranslations } from "@/lib/i18n/context";
import type { PurchaseMode } from "@/lib/types";

type MinimalProduct = { id: string; slug: string; name: string };

// 通用加入購物車按鈕:作品(買斷/月租)、旅程、會員方案皆共用,由呼叫端決定 mode 與該模式下的單價
// 唯一呼叫端是 ArtworkPurchaseSection(作品詳情頁),admin 不引用此元件,故內部直接吃 i18n context;
// ctaLabel/buyLabel/disabledLabel 仍可由呼叫端覆寫,未覆寫則 fallback 到當前 locale 的預設文案。
export default function AddToCartButton({
  product,
  mode = "buyout",
  unitPrice,
  showQuantity = true,
  ctaLabel,
  buyLabel,
  disabled = false,
  disabledLabel,
}: {
  product: MinimalProduct;
  mode?: PurchaseMode;
  unitPrice: number;
  showQuantity?: boolean;
  ctaLabel?: string;
  buyLabel?: string;
  disabled?: boolean;
  disabledLabel?: string;
}) {
  const router = useRouter();
  const { messages } = useTranslations();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const resolvedCtaLabel = ctaLabel ?? messages.product.addToCart;
  const resolvedBuyLabel = buyLabel ?? messages.product.buyNow;
  const resolvedDisabledLabel = disabledLabel ?? messages.product.restocking;

  function handleAdd(goCheckout: boolean) {
    addToCart(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        price: unitPrice,
        mode,
      },
      quantity
    );
    if (goCheckout) {
      router.push("/cart");
    } else {
      openCart();
      setAdded(true);
      setTimeout(() => setAdded(false), 1600);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {showQuantity && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">{messages.product.quantityLabel}</span>
          <div className="flex items-center border border-line-2">
            <button
              aria-label={messages.product.decreaseQty}
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="flex h-11 w-11 items-center justify-center text-lg text-ink-deep"
            >
              −
            </button>
            <span className="w-8 text-center font-semibold">{quantity}</span>
            <button
              aria-label={messages.product.increaseQty}
              onClick={() => setQuantity(quantity + 1)}
              className="flex h-11 w-11 items-center justify-center text-lg text-ink-deep"
            >
              +
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button onClick={() => handleAdd(false)} disabled={disabled} className="iv-btn-ghost flex-1">
          {disabled ? resolvedDisabledLabel : added ? messages.product.addedToCart : resolvedCtaLabel}
        </button>
        <button onClick={() => handleAdd(true)} disabled={disabled} className="iv-btn-primary flex-1">
          {resolvedBuyLabel}
        </button>
      </div>
    </div>
  );
}
