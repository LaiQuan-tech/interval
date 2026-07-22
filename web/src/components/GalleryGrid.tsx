"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatTWD } from "@/lib/format";
import Placeholder, { gradientForId } from "@/components/Placeholder";
import { useTranslations } from "@/lib/i18n/context";
import type { Product } from "@/lib/types";

// 篩選鍵永遠對應 DB 內的中文 category 值(D phase 前 category 尚未翻譯);
// 顯示文字才依 locale 走 messages,兩者分離以免英文站篩選失效。
const FILTER_KEYS = ["all", "landscape", "abstract", "stillLife", "botanical"] as const;
type FilterKey = (typeof FILTER_KEYS)[number];
const FILTER_CATEGORY: Record<FilterKey, string> = {
  all: "全部",
  landscape: "風景",
  abstract: "抽象",
  stillLife: "靜物",
  botanical: "植物",
};

export default function GalleryGrid({ works }: { works: Product[] }) {
  const { locale, messages } = useTranslations();
  const [active, setActive] = useState<FilterKey>("all");

  const FILTER_LABEL: Record<FilterKey, string> = {
    all: messages.gallery.filterAll,
    landscape: messages.gallery.filterLandscape,
    abstract: messages.gallery.filterAbstract,
    stillLife: messages.gallery.filterStillLife,
    botanical: messages.gallery.filterBotanical,
  };

  const filtered = useMemo(
    () =>
      active === "all" ? works : works.filter((w) => w.category === FILTER_CATEGORY[active]),
    [active, works]
  );

  return (
    <>
      <div className="mt-8 flex flex-wrap gap-3.5">
        {FILTER_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => setActive(key)}
            className={`lm-chip ${active === key ? "!bg-ink-deep !text-panel !border-ink-deep" : ""}`}
            data-active={active === key}
          >
            {FILTER_LABEL[key]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="iv-card mt-10 text-center text-ink-soft">{messages.gallery.emptyState}</div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-x-7 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((w) => {
            const metadata = w.metadata as { tag?: string; medium?: string; gradient?: [string, string] };
            return (
              <Link key={w.id} href={`/products/${w.slug}`} className="group block">
                <Placeholder
                  src={w.images?.[0]?.url}
                  alt={w.name}
                  gradient={metadata?.gradient ?? gradientForId(w.id)}
                  label={metadata?.tag}
                  className="h-70 sm:h-80"
                />
                <div className="mt-4 flex items-baseline justify-between gap-2">
                  <h4 className="font-serif text-[19px] text-ink">{w.name}</h4>
                  {metadata?.medium && (
                    <span className="font-cormorant text-[14px] text-accent whitespace-nowrap">
                      {metadata.medium}
                    </span>
                  )}
                </div>
                <div className="mt-1.5 text-[12.5px] text-muted-2">
                  {w.price_rental_monthly != null &&
                    `${messages.home.priceRentalPrefix} ${formatTWD(w.price_rental_monthly, locale)}${messages.home.priceRentalSuffix}`}
                  {messages.home.priceOutright} {formatTWD(w.price, locale)}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
