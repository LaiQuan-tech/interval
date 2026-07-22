import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTWD } from "@/lib/format";
import Placeholder, { gradientForId } from "@/components/Placeholder";
import type { Product } from "@/lib/types";
import { getLocale, getMessages } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

async function getFeaturedArtworks(): Promise<Product[]> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("status", "active")
      .eq("product_type", "artwork")
      .order("featured", { ascending: false })
      .order("sort_order")
      .limit(3);
    return (data ?? []) as Product[];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const messages = getMessages(await getLocale());
  const artworks = await getFeaturedArtworks();

  return (
    <div>
      {/* ===== Hero ===== */}
      <section className="lm-container flex flex-col items-center py-16 text-center sm:py-24">
        <div className="lm-eyebrow text-[20px] sm:text-[22px]">
          {messages.home.heroEyebrow}
        </div>
        <div className="my-6 h-px w-11 bg-gold" />
        <h1 className="max-w-190 text-[27px] font-normal leading-[1.34] tracking-[0.05em] text-ink sm:text-[44px] lg:text-[64px]">
          {messages.home.heroTitleLine1}
          <br />
          {messages.home.heroTitleLine2}
        </h1>
        <p className="mt-8 max-w-130 text-[16px] leading-[2.1] text-ink-soft">
          {messages.home.heroDesc}
        </p>
        <div className="mt-11 flex flex-col gap-4 sm:flex-row sm:gap-[18px]">
          <Link href="/booking" className="iv-btn-primary">
            {messages.home.heroCtaBooking}
          </Link>
          <Link
            href="/gallery"
            className="inline-flex items-center justify-center border-b border-gold px-3 py-4 text-sm tracking-[0.16em] text-ink-deep"
          >
            {messages.home.heroCtaGallery}
          </Link>
        </div>
      </section>

      {/* ===== 主視覺圖組 ===== */}
      <section className="lm-container grid grid-cols-1 gap-0.5 pb-16 sm:pb-24 lg:grid-cols-[1.4fr_1fr]">
        <Placeholder
          src={artworks[0]?.images?.[0]?.url}
          alt={artworks[0]?.name}
          label="Signature artwork — 招牌畫作"
          sizes="(max-width: 1024px) 100vw, 55vw"
          priority
          className="h-70 lg:h-110"
        />
        <div className="flex flex-col gap-0.5">
          <Placeholder
            src={artworks[1]?.images?.[0]?.url}
            alt={artworks[1]?.name}
            label="detail 01"
            sizes="(max-width: 1024px) 100vw, 40vw"
            priority
            className="min-h-54 flex-1"
          />
          <Placeholder
            src={artworks[2]?.images?.[0]?.url}
            alt={artworks[2]?.name}
            label="detail 02"
            sizes="(max-width: 1024px) 100vw, 40vw"
            priority
            className="min-h-54 flex-1"
          />
        </div>
      </section>

      {/* ===== 三種開始的方式 ===== */}
      <section className="bg-panel">
        <div className="lm-container py-16 sm:py-22">
          <div className="mb-13 text-center">
            <div className="lm-caption text-[13px]">{messages.home.waysEyebrow}</div>
            <h2 className="mt-3.5 font-serif text-[26px] font-normal text-ink sm:text-[36px]">
              {messages.home.waysTitle}
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-0.5 bg-line md:grid-cols-3">
            {[
              {
                n: "01",
                title: messages.home.way1Title,
                desc: messages.home.way1Desc,
                href: "/gallery",
                label: messages.home.way1Label,
              },
              {
                n: "02",
                title: messages.home.way2Title,
                desc: messages.home.way2Desc,
                href: "/rental",
                label: messages.home.way2Label,
              },
              {
                n: "03",
                title: messages.home.way3Title,
                desc: messages.home.way3Desc,
                href: "/journeys",
                label: messages.home.way3Label,
              },
            ].map((card) => (
              <div key={card.n} className="bg-panel px-8.5 py-11">
                <div className="font-cormorant text-[34px] text-gold">{card.n}</div>
                <h3 className="mt-4 mb-3 font-serif text-[22px] font-medium text-ink">
                  {card.title}
                </h3>
                <p className="mb-5 text-[14px] leading-[1.95] text-ink-soft">{card.desc}</p>
                <Link href={card.href} className="text-[13px] tracking-[0.1em] text-accent border-b border-gold pb-0.5">
                  {card.label}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 本季精選 ===== */}
      <section className="lm-container py-16 sm:py-22">
        <div className="mb-9 flex items-baseline justify-between">
          <h2 className="font-serif text-[26px] font-normal text-ink sm:text-[34px]">{messages.home.featuredTitle}</h2>
          <Link href="/gallery" className="text-[13px] tracking-[0.1em] text-accent whitespace-nowrap">
            {messages.home.featuredViewAll}
          </Link>
        </div>
        {artworks.length === 0 ? (
          <div className="iv-card text-center text-ink-soft">{messages.home.featuredEmpty}</div>
        ) : (
          <div className="grid grid-cols-1 gap-7 sm:grid-cols-3">
            {artworks.map((a) => {
              const metadata = a.metadata as { gradient?: [string, string] };
              return (
                <Link key={a.id} href={`/products/${a.slug}`} className="group block">
                  <Placeholder
                    src={a.images?.[0]?.url}
                    alt={a.name}
                    gradient={metadata?.gradient ?? gradientForId(a.id)}
                    className="h-64 sm:h-75"
                  />
                  <h4 className="mt-4 mb-1.5 font-serif text-[19px] text-ink">{a.name}</h4>
                  <div className="text-[12.5px] text-muted-2">
                    {a.price_rental_monthly != null &&
                      `${messages.home.priceRentalPrefix} ${formatTWD(a.price_rental_monthly)}${messages.home.priceRentalSuffix}`}
                    {messages.home.priceOutright} {formatTWD(a.price)}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* ===== 會員 CTA ===== */}
      <section className="bg-ink-deep text-panel">
        <div className="lm-container flex flex-col items-start gap-8 py-16 sm:py-20 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="lm-caption mb-4.5 text-[13px] sm:text-[14px]">{messages.home.membershipEyebrow}</div>
            <h2 className="max-w-135 font-serif text-[26px] font-normal leading-[1.5] text-panel sm:text-[36px]">
              {messages.home.membershipTitle}
            </h2>
            <p className="mt-4.5 max-w-115 text-[14px] leading-[1.95] text-cream-soft">
              {messages.home.membershipDesc}
            </p>
          </div>
          <Link
            href="/membership"
            className="whitespace-nowrap border border-gold px-8.5 py-4 text-sm tracking-[0.16em] text-panel"
          >
            {messages.home.membershipCta}
          </Link>
        </div>
      </section>
    </div>
  );
}
