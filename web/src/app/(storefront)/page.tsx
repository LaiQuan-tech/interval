import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTWD } from "@/lib/format";
import Placeholder, { gradientForId } from "@/components/Placeholder";
import type { Product } from "@/lib/types";

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
  const artworks = await getFeaturedArtworks();

  return (
    <div>
      {/* ===== Hero ===== */}
      <section className="lm-container flex flex-col items-center py-16 text-center sm:py-24">
        <div className="lm-eyebrow text-[20px] sm:text-[22px]">
          A private collection, curated for you
        </div>
        <div className="my-6 h-px w-11 bg-gold" />
        <h1 className="max-w-190 text-[27px] font-normal leading-[1.34] tracking-[0.05em] text-ink sm:text-[44px] lg:text-[64px]">
          為懂得生活的人，
          <br />
          典藏值得停留的時光
        </h1>
        <p className="mt-8 max-w-130 text-[16px] leading-[2.1] text-ink-soft">
          獨家 AI 藝術畫作、量身訂製的私人旅程，以及專屬顧問服務。租賃或買斷皆宜，會員享點數與禮遇。
        </p>
        <div className="mt-11 flex flex-col gap-4 sm:flex-row sm:gap-[18px]">
          <Link href="/booking" className="iv-btn-primary">
            預約私人鑑賞
          </Link>
          <Link
            href="/gallery"
            className="inline-flex items-center justify-center border-b border-gold px-3 py-4 text-sm tracking-[0.16em] text-ink-deep"
          >
            瀏覽典藏 →
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
            <div className="lm-caption text-[13px]">Three ways to begin</div>
            <h2 className="mt-3.5 font-serif text-[26px] font-normal text-ink sm:text-[36px]">
              三種開始的方式
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-0.5 bg-line md:grid-cols-3">
            {[
              {
                n: "01",
                title: "AI 藝術典藏",
                desc: "獨一無二的生成藝術，職人裝裱為實體畫作，掛上牆即是風景。",
                href: "/gallery",
                label: "瀏覽典藏 →",
              },
              {
                n: "02",
                title: "租賃 · 買斷",
                desc: "先租後買、依季更換。用彈性的方式，讓空間持續有新意。",
                href: "/rental",
                label: "了解方案 →",
              },
              {
                n: "03",
                title: "私人旅程",
                desc: "為你策劃的旅行提案，以會員點數兌換體驗，讓靈感延伸到遠方。",
                href: "/journeys",
                label: "探索旅程 →",
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
          <h2 className="font-serif text-[26px] font-normal text-ink sm:text-[34px]">本季精選</h2>
          <Link href="/gallery" className="text-[13px] tracking-[0.1em] text-accent whitespace-nowrap">
            看全部作品 →
          </Link>
        </div>
        {artworks.length === 0 ? (
          <div className="iv-card text-center text-ink-soft">典藏即將上架，敬請期待。</div>
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
                    {a.price_rental_monthly != null && `租賃 ${formatTWD(a.price_rental_monthly)}/月 · `}
                    買斷 {formatTWD(a.price)}
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
            <div className="lm-caption mb-4.5 text-[13px] sm:text-[14px]">Membership Salon</div>
            <h2 className="max-w-135 font-serif text-[26px] font-normal leading-[1.5] text-panel sm:text-[36px]">
              會員沙龍．以點數兌換旅程與典藏禮遇
            </h2>
            <p className="mt-4.5 max-w-115 text-[14px] leading-[1.95] text-cream-soft">
              消費、參訪、租賃皆可累點；點數可兌換私人旅程與藝術品折扣。
            </p>
          </div>
          <Link
            href="/membership"
            className="whitespace-nowrap border border-gold px-8.5 py-4 text-sm tracking-[0.16em] text-panel"
          >
            申請入會
          </Link>
        </div>
      </section>
    </div>
  );
}
