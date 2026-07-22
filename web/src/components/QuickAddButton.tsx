"use client";

import { useState } from "react";
import { addToCart, openCart } from "@/lib/cart";
import type { PurchaseMode } from "@/lib/types";

// 精簡版加入購物車(旅程列 / 會員方案卡用):固定數量 1,無數量選擇器
export default function QuickAddButton({
  product,
  mode,
  unitPrice,
  label = "加入購物車 →",
  addedLabel = "已加入購物車 ✓",
  className = "",
  onAdded,
}: {
  product: { id: string; slug: string; name: string; name_en?: string | null };
  mode: PurchaseMode;
  unitPrice: number;
  label?: string;
  addedLabel?: string;
  className?: string;
  onAdded?: () => void;
}) {
  const [added, setAdded] = useState(false);

  return (
    <button
      onClick={() => {
        addToCart(
          {
            productId: product.id,
            slug: product.slug,
            name: product.name,
            name_en: product.name_en,
            price: unitPrice,
            mode,
          },
          1
        );
        openCart();
        setAdded(true);
        setTimeout(() => setAdded(false), 1800);
        onAdded?.();
      }}
      className={className}
    >
      {added ? addedLabel : label}
    </button>
  );
}
