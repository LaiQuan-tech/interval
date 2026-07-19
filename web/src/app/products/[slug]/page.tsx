import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTWD, formatPoints } from "@/lib/format";
import Placeholder, { gradientForId } from "@/components/Placeholder";
import ArtworkPurchaseSection from "@/components/ArtworkPurchaseSection";
import QuickAddButton from "@/components/QuickAddButton";
import OpenChatButton from "@/components/OpenChatButton";
import type { MembershipTier, Product } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

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
  };
  const gradient = metadata?.gradient ?? gradientForId(product.id);

  return (
    <div className="lm-container py-12 sm:py-16">
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        <Placeholder
          gradient={gradient}
          label={metadata?.tag}
          className="aspect-square w-full"
        />

        <div className="flex flex-col">
          {product.category && (
            <span className="lm-caption text-[12px]">{product.category}</span>
          )}
          <h1 className="mt-2 mb-1 font-serif text-[28px] font-normal text-ink sm:text-[34px]">
            {product.name}
          </h1>
          {metadata?.medium && (
            <span className="font-cormorant text-[15px] text-accent">{metadata.medium}</span>
          )}

          <p className="mt-6 whitespace-pre-wrap text-[15px] leading-[1.9] text-ink-soft">
            {product.description || "此作品尚無詳細說明。"}
          </p>

          <div className="mt-8">
            {product.product_type === "artwork" && (
              <ArtworkPurchaseSection product={product} />
            )}

            {product.product_type === "journey" && (
              <div>
                {metadata?.duration && (
                  <div className="mb-1 text-[13px] text-muted-2">{metadata.duration}</div>
                )}
                <div className="mb-2 flex items-baseline gap-2">
                  <span className="font-cormorant text-[15px] text-accent">from</span>
                  <span className="font-serif text-[28px] text-ink">{formatTWD(product.price)}</span>
                </div>
                {product.points_price != null && (
                  <div className="mb-6 text-[13px] text-muted-2">
                    或 {formatPoints(product.points_price)}
                  </div>
                )}
                <QuickAddButton
                  product={product}
                  mode="journey"
                  unitPrice={product.price}
                  label="加入購物車"
                  addedLabel="已加入 ✓"
                  className="iv-btn-primary w-full sm:w-auto"
                />
              </div>
            )}

            {product.product_type === "membership" && (
              <div>
                <div className="mb-5 font-serif text-[28px] text-ink">
                  {formatTWD(product.price)}
                  <span className="text-[14px] text-muted-2"> / 年</span>
                </div>
                {tier && tier.perks.length > 0 && (
                  <div className="mb-6 flex flex-col gap-2.5 text-[14px] leading-[1.6] text-ink-soft">
                    {tier.perks.map((perk) => (
                      <div key={perk}>· {perk}</div>
                    ))}
                  </div>
                )}
                <QuickAddButton
                  product={product}
                  mode="membership"
                  unitPrice={product.price}
                  label="加入此方案"
                  addedLabel="已加入 ✓"
                  className="iv-btn-primary w-full sm:w-auto"
                />
              </div>
            )}
          </div>

          <div className="mt-8 border border-line bg-panel p-5 text-sm leading-[1.8] text-ink-soft">
            需要客製尺寸、企業空間規劃或專屬旅程？跟
            <span className="mx-1 font-semibold text-accent">AI 顧問</span>
            說需求，我們會為您準備專屬報價單。
            <div className="mt-3">
              <OpenChatButton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
