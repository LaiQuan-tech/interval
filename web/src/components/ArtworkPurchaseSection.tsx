"use client";

import { useState } from "react";
import { formatTWD, getPurchaseModeLabel } from "@/lib/format";
import AddToCartButton from "@/components/AddToCartButton";
import RoomMockupFlyout from "@/components/RoomMockupFlyout";
import { useTranslations } from "@/lib/i18n/context";
import type { Product } from "@/lib/types";

// 作品詳情頁的購買模式切換(月租 / 買斷):價格連動,加入購物車時帶對應 mode 與單價
export default function ArtworkPurchaseSection({ product }: { product: Product }) {
  const { locale, messages } = useTranslations();
  const hasRental = product.price_rental_monthly != null;
  const [mode, setMode] = useState<"buyout" | "rental">("buyout");
  const [mockupOpen, setMockupOpen] = useState(false);
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
            {getPurchaseModeLabel("buyout", locale)}
          </button>
          <button
            type="button"
            onClick={() => setMode("rental")}
            className={`px-7 py-3 text-sm tracking-[0.06em] ${
              mode === "rental" ? "bg-ink-deep text-panel" : "text-ink-soft"
            }`}
          >
            {getPurchaseModeLabel("rental", locale)}
          </button>
        </div>
      )}

      <div className="mb-7 flex items-baseline gap-2">
        <span className="font-serif text-[30px] text-ink">{formatTWD(unitPrice, locale)}</span>
        {mode === "rental" && <span className="text-[15px] text-muted-2">{messages.product.perMonth}</span>}
      </div>

      <AddToCartButton
        product={product}
        mode={mode}
        unitPrice={unitPrice}
        disabled={product.stock <= 0}
        disabledLabel={messages.product.restocking}
      />

      <button
        type="button"
        onClick={() => setMockupOpen(true)}
        className="iv-btn-ghost w-full mt-3"
      >
        {messages.product.seeOnWall}
      </button>
      <p className="lm-caption mt-2 text-[11px]">{messages.product.mockupCaption}</p>

      <RoomMockupFlyout
        open={mockupOpen}
        onClose={() => setMockupOpen(false)}
        product={product}
      />
    </div>
  );
}
