import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTWD, formatPoints, localizeText, localizeList, getCategoryLabel } from "@/lib/format";
import Placeholder, { gradientForId } from "@/components/Placeholder";
import ArtworkPurchaseSection from "@/components/ArtworkPurchaseSection";
import QuickAddButton from "@/components/QuickAddButton";
import OpenChatButton from "@/components/OpenChatButton";
import { getLocale, getMessages } from "@/lib/i18n/server";
import type { MembershipTier, Product } from "@/lib/types";

export const dynamic = "force-dynamic";

// product.name/description 是 DB 內容,D phase 才翻譯;這裡只加 hreflang,
// 刻意不覆寫 title/description,zh 站沿用 root layout 的預設值,逐字不變。
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    alternates: {
      languages: {
        "zh-Hant-TW": `${baseUrl}/products/${slug}`,
        en: `${baseUrl}/en/products/${slug}`,
      },
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const locale = await getLocale();
  const messages = getMessages(locale);

  let product: Product | null = null;
  let tier: MembershipTier | null = null;
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("slug", slug)
      .eq("status", "active")
      .maybeSingle();
    product = data as Product | null;

    if (product?.product_type === "membership") {
      const tierSlug = (product.metadata as { tier_slug?: string })?.tier_slug;
      if (tierSlug) {
        const { data: tierData } = await supabase
          .from("membership_tiers")
          .select("*")
          .eq("slug", tierSlug)
          .maybeSingle();
        tier = tierData as MembershipTier | null;
      }
    }
  } catch {
    /* env 未設定 */
  }

  if (!product) notFound();

  const metadata = product.metadata as {
    tag?: string;
    medium?: string;
    gradient?: [string, string];
    duration?: string;
    duration_en?: string;
  };
  const gradient = metadata?.gradient ?? gradientForId(product.id);
  const displayName = localizeText(product.name, product.name_en, locale);
  const displayDescription = localizeText(product.description, product.description_en, locale);
  const displayDuration = localizeText(metadata?.duration ?? "", metadata?.duration_en, locale);

  return (
    <div className="lm-container py-12 sm:py-16">
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        <Placeholder
          src={product.images?.[0]?.url}
          alt={displayName}
          gradient={gradient}
          label={metadata?.tag}
          sizes="(max-width: 1024px) 100vw, 50vw"
          priority
          className="aspect-square w-full"
        />

        <div className="flex flex-col">
          {product.category && (
            <span className="lm-caption text-[12px]">{getCategoryLabel(product.category, locale)}</span>
          )}
          <h1 className="mt-2 mb-1 font-serif text-[28px] font-normal text-ink sm:text-[34px]">
            {displayName}
          </h1>
          {metadata?.medium && (
            <span className="font-cormorant text-[15px] text-accent">{metadata.medium}</span>
          )}

          <p className="mt-6 whitespace-pre-wrap text-[15px] leading-[1.9] text-ink-soft">
            {displayDescription || messages.product.noDescription}
          </p>

          <div className="mt-8">
            {product.product_type === "artwork" && (
              <ArtworkPurchaseSection product={product} />
            )}

            {product.product_type === "journey" && (
              <div>
                {displayDuration && (
                  <div className="mb-1 text-[13px] text-muted-2">{displayDuration}</div>
                )}
                <div className="mb-2 flex items-baseline gap-2">
                  <span className="font-cormorant text-[15px] text-accent">{messages.product.fromLabel}</span>
                  <span className="font-serif text-[28px] text-ink">{formatTWD(product.price, locale)}</span>
                </div>
                {product.points_price != null && (
                  <div className="mb-6 text-[13px] text-muted-2">
                    {messages.product.orPointsPrefix}{formatPoints(product.points_price, locale)}
                  </div>
                )}
                <QuickAddButton
                  product={product}
                  mode="journey"
                  unitPrice={product.price}
                  label={messages.product.journeyAddToCart}
                  addedLabel={messages.product.addedToCart}
                  className="iv-btn-primary w-full sm:w-auto"
                />
              </div>
            )}

            {product.product_type === "membership" && (
              <div>
                <div className="mb-5 font-serif text-[28px] text-ink">
                  {formatTWD(product.price, locale)}
                  <span className="text-[14px] text-muted-2">{messages.product.perYear}</span>
                </div>
                {tier && tier.perks.length > 0 && (
                  <div className="mb-6 flex flex-col gap-2.5 text-[14px] leading-[1.6] text-ink-soft">
                    {localizeList(tier.perks, tier.perks_en, locale).map((perk) => (
                      <div key={perk}>· {perk}</div>
                    ))}
                  </div>
                )}
                <QuickAddButton
                  product={product}
                  mode="membership"
                  unitPrice={product.price}
                  label={messages.product.membershipJoin}
                  addedLabel={messages.product.addedToCart}
                  className="iv-btn-primary w-full sm:w-auto"
                />
              </div>
            )}
          </div>

          <div className="mt-8 border border-line bg-panel p-5 text-sm leading-[1.8] text-ink-soft">
            {messages.product.customNeedsPrefix}
            <span className="mx-1 font-semibold text-accent">{messages.product.aiAdvisor}</span>
            {messages.product.customNeedsSuffix}
            <div className="mt-3">
              <OpenChatButton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
