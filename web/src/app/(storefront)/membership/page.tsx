import Link from "next/link";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTWD } from "@/lib/format";
import QuickAddButton from "@/components/QuickAddButton";
import { getLocale, getMessages } from "@/lib/i18n/server";
import type { MembershipTier, Product } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const messages = getMessages(await getLocale());
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    title: messages.membership.title,
    description: messages.membership.metaDescription,
    alternates: {
      languages: {
        "zh-Hant-TW": `${baseUrl}/membership`,
        en: `${baseUrl}/en/membership`,
      },
    },
  };
}

// 點數面額不隨 locale 變動,兌換文案才依 locale 走 messages。
const REDEMPTION_POINTS = ["500 pt", "1,200 pt", "6,400 pt", "13,400 pt"] as const;

async function getData(): Promise<{ tiers: MembershipTier[]; products: Product[] }> {
  try {
    const supabase = createAdminClient();
    const [{ data: tiers }, { data: products }] = await Promise.all([
      supabase.from("membership_tiers").select("*").order("sort"),
      supabase.from("products").select("*").eq("status", "active").eq("product_type", "membership"),
    ]);
    return { tiers: (tiers ?? []) as MembershipTier[], products: (products ?? []) as Product[] };
  } catch {
    return { tiers: [], products: [] };
  }
}

export default async function MembershipPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const { tiers, products } = await getData();
  const productByTier = new Map(
    products.map((p) => [(p.metadata as { tier_slug?: string })?.tier_slug, p])
  );
  const redemptionDescs = [
    messages.membership.redemptions.artworkRental,
    messages.membership.redemptions.teaService,
    messages.membership.redemptions.kyotoJourney,
    messages.membership.redemptions.tuscanyJourney,
  ];
  const REDEMPTIONS = REDEMPTION_POINTS.map((points, i) => ({
    points,
    desc: redemptionDescs[i],
  }));

  return (
    <div>
      <div className="bg-ink-deep text-panel">
        <div className="lm-container py-16 text-center sm:py-22">
          <div className="font-cormorant text-[20px] italic text-gold-bright sm:text-[21px]">
            {messages.membership.eyebrow}
          </div>
          <h1 className="mx-auto mt-4 mb-4.5 max-w-160 font-serif text-[27px] font-normal tracking-[0.05em] text-panel sm:text-[52px]">
            {messages.membership.title}
          </h1>
          <p className="mx-auto max-w-130 text-[15.5px] leading-[2] text-cream-soft">
            {messages.membership.desc}
          </p>
        </div>
      </div>

      <div className="lm-container-narrow grid grid-cols-1 gap-7 pt-16 pb-6 sm:pt-20 md:grid-cols-3">
        {tiers.map((tier) => {
          const recommended = tier.slug === "gold";
          const product = productByTier.get(tier.slug);
          return (
            <div
              key={tier.slug}
              className={`relative p-8.5 text-center sm:p-11 ${
                recommended ? "border border-gold bg-panel" : "border border-line bg-card"
              }`}
            >
              {recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap bg-gold px-3.5 py-1 text-[11px] tracking-[0.14em] text-ink">
                  {messages.membership.recommendedBadge}
                </div>
              )}
              <div className={`font-cormorant text-[13px] tracking-[0.24em] uppercase ${recommended ? "text-accent-dark" : "text-accent"}`}>
                {tier.slug === "silver" ? "Silver" : tier.slug === "gold" ? "Gold" : "Platinum"}
              </div>
              <h3 className="mt-3 mb-5 font-serif text-[26px] font-medium text-ink">{tier.name}</h3>
              <div className="flex flex-col gap-3 text-left text-[14px] leading-[1.6] text-ink-soft">
                {tier.perks.map((perk) => (
                  <div key={perk}>· {perk}</div>
                ))}
              </div>
              <div className="mt-7 text-[13px] text-muted-2">
                {messages.membership.yearlyFeePrefix}
                {formatTWD(tier.price_yearly, locale)}
              </div>
              {product && (
                <QuickAddButton
                  product={product}
                  mode="membership"
                  unitPrice={product.price}
                  label={messages.membership.joinPlan}
                  addedLabel={messages.membership.addedToCart}
                  className="iv-btn-ghost mt-4 w-full"
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="lm-container py-14 sm:py-24">
        <div className="mb-11 text-center">
          <h2 className="font-serif text-[24px] font-normal text-ink sm:text-[32px]">{messages.membership.redeemTitle}</h2>
        </div>
        <div className="grid grid-cols-2 gap-0.5 bg-line md:grid-cols-4">
          {REDEMPTIONS.map((r) => (
            <div key={r.points} className="bg-card px-7 py-9 text-center">
              <div className="font-cormorant text-[30px] text-gold">{r.points}</div>
              <div className="mt-2.5 text-[13.5px] leading-[1.7] text-ink-soft">{r.desc}</div>
            </div>
          ))}
        </div>
        <div className="mt-13 text-center">
          <Link href="/booking" className="iv-btn-primary">
            {messages.membership.applyLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
