"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addToCart } from "@/lib/cart";
import type { Product } from "@/lib/types";

export default function AddToCartButton({ product }: { product: Product }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const outOfStock = product.stock <= 0;

  function handleAdd(goCheckout: boolean) {
    addToCart(
      {
        productId: product.id,
        slug: product.slug,
        name: product.name,
        price: product.price,
        image: product.images?.[0]?.url,
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
      <div className="flex items-center gap-3">
        <span className="text-sm text-ink-soft">數量</span>
        <div className="flex items-center rounded-full border border-line">
          <button
            aria-label="減少數量"
            onClick={() => setQuantity(Math.max(1, quantity - 1))}
            className="flex h-11 w-11 items-center justify-center text-lg"
          >
            −
          </button>
          <span className="w-8 text-center font-semibold">{quantity}</span>
          <button
            aria-label="增加數量"
            onClick={() => setQuantity(quantity + 1)}
            className="flex h-11 w-11 items-center justify-center text-lg"
          >
            +
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          onClick={() => handleAdd(false)}
          disabled={outOfStock}
          className="iv-btn-ghost flex-1"
        >
          {outOfStock ? "補貨中" : added ? "已加入 ✓" : "加入購物車"}
        </button>
        <button
          onClick={() => handleAdd(true)}
          disabled={outOfStock}
          className="iv-btn-primary flex-1"
        >
          立即購買
        </button>
      </div>
    </div>
  );
}
