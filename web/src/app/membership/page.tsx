import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTWD } from "@/lib/format";
import QuickAddButton from "@/components/QuickAddButton";
import type { MembershipTier, Product } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "會員沙龍" };

const REDEMPTIONS = [
  { points: "500 pt", desc: "藝術品租賃折抵 NT$500" },
  { points: "1,200 pt", desc: "門市私人鑑賞午茶席" },
  { points: "6,400 pt", desc: "京都私人旅程折抵" },
  { points: "13,400 pt", desc: "托斯卡尼旅程折抵" },
];

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
  const { tiers, products } = await getData();
  const productByTier = new Map(
    products.map((p) => [(p.metadata as { tier_slug?: string })?.tier_slug, p])
  );

  return (
    <div>
      <div className="bg-ink-deep text-panel">
        <div className="lm-container py-16 text-center sm:py-22">
          <div className="font-cormorant text-[20px] italic text-gold-bright sm:text-[21px]">
            The Membership Salon
          </div>
          <h1 className="mx-auto mt-4 mb-4.5 max-w-160 font-serif text-[27px] font-normal tracking-[0.05em] text-panel sm:text-[52px]">
            會員沙龍
          </h1>
          <p className="mx-auto max-w-130 text-[15.5px] leading-[2] text-cream-soft">
            加入小時光，累積屬於您的點數。消費、參訪、租賃皆可累點，兌換私人旅程與藝術典藏折扣。
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
                  推薦
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
              <div className="mt-7 text-[13px] text-muted-2">年費 {formatTWD(tier.price_yearly)}</div>
              {product && (
                <QuickAddButton
                  product={product}
                  mode="membership"
                  unitPrice={product.price}
                  label="加入此方案 →"
                  addedLabel="已加入購物車 ✓"
                  className="iv-btn-ghost mt-4 w-full"
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="lm-container py-14 sm:py-24">
        <div className="mb-11 text-center">
          <h2 className="font-serif text-[24px] font-normal text-ink sm:text-[32px]">點數，可以兌換什麼</h2>
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
            申請入會
          </Link>
        </div>
      </div>
    </div>
  );
}
