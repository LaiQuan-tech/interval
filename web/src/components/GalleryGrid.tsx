"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatTWD } from "@/lib/format";
import Placeholder, { gradientForId } from "@/components/Placeholder";
import type { Product } from "@/lib/types";

const FILTERS = ["全部", "風景", "抽象", "靜物", "植物"];

export default function GalleryGrid({ works }: { works: Product[] }) {
  const [active, setActive] = useState("全部");

  const filtered = useMemo(
    () => (active === "全部" ? works : works.filter((w) => w.category === active)),
    [active, works]
  );

  return (
    <>
      <div className="mt-8 flex flex-wrap gap-3.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setActive(f)}
            className={`lm-chip ${active === f ? "!bg-ink-deep !text-panel !border-ink-deep" : ""}`}
            data-active={active === f}
          >
            {f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="iv-card mt-10 text-center text-ink-soft">此分類尚無作品。</div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-x-7 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((w) => {
            const metadata = w.metadata as { tag?: string; medium?: string; gradient?: [string, string] };
            return (
              <Link key={w.id} href={`/products/${w.slug}`} className="group block">
                <Placeholder
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
                  {w.price_rental_monthly != null && `租賃 ${formatTWD(w.price_rental_monthly)}/月 · `}
                  買斷 {formatTWD(w.price)}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
