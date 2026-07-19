"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addToCart } from "@/lib/cart";
import type { PurchaseMode } from "@/lib/types";

type MinimalProduct = { id: string; slug: string; name: string };

// 通用加入購物車按鈕:作品(買斷/月租)、旅程、會員方案皆共用,由呼叫端決定 mode 與該模式下的單價
export default function AddToCartButton({
  product,
  mode = "buyout",
  unitPrice,
  showQuantity = true,
  ctaLabel = "加入購物車",
  buyLabel = "立即結帳",
  disabled = false,
  disabledLabel = "補貨中",
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
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

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
      setAdded(true);
      setTimeout(() => setAdded(false), 1600);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {showQuantity && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">數量</span>
          <div className="flex items-center border border-line-2">
            <button
              aria-label="減少數量"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="flex h-11 w-11 items-center justify-center text-lg text-ink-deep"
            >
              −
            </button>
            <span className="w-8 text-center font-semibold">{quantity}</span>
            <button
              aria-label="增加數量"
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
          {disabled ? disabledLabel : added ? "已加入 ✓" : ctaLabel}
        </button>
        <button onClick={() => handleAdd(true)} disabled={disabled} className="iv-btn-primary flex-1">
          {buyLabel}
        </button>
      </div>
    </div>
  );
}
