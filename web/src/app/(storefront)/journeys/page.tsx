import Link from "next/link";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTWD, formatPoints, localizeText } from "@/lib/format";
import Placeholder from "@/components/Placeholder";
import QuickAddButton from "@/components/QuickAddButton";
import OpenChatButton from "@/components/OpenChatButton";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { localeHref } from "@/lib/i18n/href";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const messages = getMessages(await getLocale());
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    title: messages.journeys.title,
    description: messages.journeys.metaDescription,
    alternates: {
      languages: {
        "zh-Hant-TW": `${baseUrl}/journeys`,
        en: `${baseUrl}/en/journeys`,
      },
    },
  };
}

async function getJourneys(): Promise<Product[]> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("status", "active")
      .eq("product_type", "journey")
      .order("sort_order");
    return (data ?? []) as Product[];
  } catch {
    return [];
  }
}

export default async function JourneysPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const journeys = await getJourneys();

  return (
    <div>
      {/* 全幅主視覺 */}
      <div className="relative h-96 overflow-hidden bg-[#e4d6bd] sm:h-115">
        <Placeholder
          src="/scenes/journeys-hero.jpg"
          alt="私人旅程主視覺"
          label="Full-bleed journey scene — 旅程主視覺"
          sizes="100vw"
          priority
          className="absolute inset-0"
        />
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-b from-ink-deep/10 to-ink-deep/60 px-6 py-10 sm:px-16 sm:py-15">
          <div className="lm-container !px-0">
            <div className="mb-4 font-cormorant text-[19px] italic text-gold-bright sm:text-[21px]">
              {messages.journeys.eyebrow}
            </div>
            <h1 className="max-w-160 font-serif text-[27px] font-normal tracking-[0.04em] text-cream-text sm:text-[54px]">
              {messages.journeys.heroTitle}
            </h1>
          </div>
        </div>
      </div>

      <div className="lm-container py-16 sm:py-20">
        <p className="mb-14 max-w-150 text-[15px] leading-[2.05] text-ink-soft sm:mb-16 sm:text-[16px]">
          {messages.journeys.desc}
        </p>

        {journeys.length === 0 ? (
          <div className="iv-card text-center text-ink-soft">{messages.journeys.emptyState}</div>
        ) : (
          <div className="flex flex-col gap-0.5 bg-line">
            {journeys.map((j) => {
              const metadata = j.metadata as { duration?: string; duration_en?: string };
              const displayName = localizeText(j.name, j.name_en, locale);
              const displayDuration = localizeText(metadata?.duration ?? "", metadata?.duration_en, locale);
              return (
                <div
                  key={j.id}
                  className="grid grid-cols-1 gap-6 bg-paper p-6 sm:gap-10 sm:p-11 lg:grid-cols-[0.9fr_1.5fr_0.6fr] lg:items-center"
                >
                  <Placeholder
                    src={j.images?.[0]?.url}
                    alt={displayName}
                    label={`journey · ${j.name.split("．")[0]}`}
                    sizes="(max-width: 1024px) 100vw, 30vw"
                    className="h-40"
                  />
                  <div>
                    <h3 className="mb-2.5 font-serif text-[21px] font-medium text-ink sm:text-[24px]">
                      {displayName}
                    </h3>
                    <p className="text-[14px] leading-[1.95] text-ink-soft">
                      {localizeText(j.description, j.description_en, locale)}
                    </p>
                    {displayDuration && (
                      <p className="mt-2 text-[12.5px] text-muted-2">{displayDuration}</p>
                    )}
                  </div>
                  <div className="text-left lg:text-right">
                    <div className="font-cormorant text-[15px] text-accent">{messages.journeys.fromLabel}</div>
                    <div className="font-serif text-[22px] text-ink sm:text-[24px]">
                      {formatTWD(j.price, locale)}
                    </div>
                    {j.points_price != null && (
                      <div className="mt-1 text-[12px] text-muted-2">
                        {messages.journeys.orPointsPrefix}{formatPoints(j.points_price, locale)}
                      </div>
                    )}
                    <QuickAddButton
                      product={j}
                      mode="journey"
                      unitPrice={j.price}
                      label={messages.journeys.addToCart}
                      addedLabel={messages.journeys.addedToCart}
                      className="mt-3 inline-block text-[12px] tracking-[0.08em] text-accent border-b border-gold pb-0.5"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-14 text-center sm:mt-16">
          <Link href={localeHref("/booking", locale)} className="iv-btn-primary">
            {messages.journeys.consultCta}
          </Link>
          <div className="mt-8 flex flex-col items-center gap-3">
            <p className="text-[13.5px] text-muted">{messages.journeys.customPrompt}</p>
            <OpenChatButton />
          </div>
        </div>
      </div>
    </div>
  );
}
