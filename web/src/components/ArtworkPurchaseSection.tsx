"use client";

import { useState } from "react";
import { formatTWD } from "@/lib/format";
import AddToCartButton from "@/components/AddToCartButton";
import type { Product } from "@/lib/types";

// 作品詳情頁的購買模式切換(月租 / 買斷):價格連動,加入購物車時帶對應 mode 與單價
export default function ArtworkPurchaseSection({ product }: { product: Product }) {
  const hasRental = product.price_rental_monthly != null;
  const [mode, setMode] = useState<"buyout" | "rental">("buyout");
  const unitPrice =
    mode === "rental" && product.price_rental_monthly != null
      ? product.price_rental_monthly
      : product.price;

  return (
    <div>
      {hasRental && (
        <div className="mb-6 inline-flex border border-line-2">
          <button
            type="button"
            onClick={() => setMode("buyout")}
            className={`px-7 py-3 text-sm tracking-[0.06em] ${
              mode === "buyout" ? "bg-ink-deep text-panel" : "text-ink-soft"
            }`}
          >
            買斷
          </button>
          <button
            type="button"
            onClick={() => setMode("rental")}
            className={`px-7 py-3 text-sm tracking-[0.06em] ${
              mode === "rental" ? "bg-ink-deep text-panel" : "text-ink-soft"
            }`}
          >
            月租
          </button>
        </div>
      )}

      <div className="mb-7 flex items-baseline gap-2">
        <span className="font-serif text-[30px] text-ink">{formatTWD(unitPrice)}</span>
        {mode === "rental" && <span className="text-[15px] text-muted-2"> / 月</span>}
      </div>

      <AddToCartButton
        product={product}
        mode={mode}
        unitPrice={unitPrice}
        disabled={product.stock <= 0}
        disabledLabel="補貨中"
      />
    </div>
  );
}
