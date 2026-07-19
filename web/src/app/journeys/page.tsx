import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTWD, formatPoints } from "@/lib/format";
import Placeholder from "@/components/Placeholder";
import QuickAddButton from "@/components/QuickAddButton";
import OpenChatButton from "@/components/OpenChatButton";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "私人旅程" };

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
              Bespoke Journeys
            </div>
            <h1 className="max-w-160 font-serif text-[27px] font-normal tracking-[0.04em] text-cream-text sm:text-[54px]">
              把一幅畫，延伸成一趟旅行
            </h1>
          </div>
        </div>
      </div>

      <div className="lm-container py-16 sm:py-20">
        <p className="mb-14 max-w-150 text-[15px] leading-[2.05] text-ink-soft sm:mb-16 sm:text-[16px]">
          以您鍾愛的畫作靈感為起點，專屬顧問為您量身策劃行程；從私人包車到藝術家工作室拜訪，會員點數皆可折抵體驗費用。
        </p>

        {journeys.length === 0 ? (
          <div className="iv-card text-center text-ink-soft">旅程即將上架，敬請期待。</div>
        ) : (
          <div className="flex flex-col gap-0.5 bg-line">
            {journeys.map((j) => {
              const metadata = j.metadata as { duration?: string };
              return (
                <div
                  key={j.id}
                  className="grid grid-cols-1 gap-6 bg-paper p-6 sm:gap-10 sm:p-11 lg:grid-cols-[0.9fr_1.5fr_0.6fr] lg:items-center"
                >
                  <Placeholder
                    src={j.images?.[0]?.url}
                    alt={j.name}
                    label={`journey · ${j.name.split("．")[0]}`}
                    sizes="(max-width: 1024px) 100vw, 30vw"
                    className="h-40"
                  />
                  <div>
                    <h3 className="mb-2.5 font-serif text-[21px] font-medium text-ink sm:text-[24px]">
                      {j.name}
                    </h3>
                    <p className="text-[14px] leading-[1.95] text-ink-soft">{j.description}</p>
                    {metadata?.duration && (
                      <p className="mt-2 text-[12.5px] text-muted-2">{metadata.duration}</p>
                    )}
                  </div>
                  <div className="text-left lg:text-right">
                    <div className="font-cormorant text-[15px] text-accent">from</div>
                    <div className="font-serif text-[22px] text-ink sm:text-[24px]">
                      {formatTWD(j.price)}
                    </div>
                    {j.points_price != null && (
                      <div className="mt-1 text-[12px] text-muted-2">
                        或 {formatPoints(j.points_price)}
                      </div>
                    )}
                    <QuickAddButton
                      product={j}
                      mode="journey"
                      unitPrice={j.price}
                      className="mt-3 inline-block text-[12px] tracking-[0.08em] text-accent border-b border-gold pb-0.5"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-14 text-center sm:mt-16">
          <Link href="/booking" className="iv-btn-primary">
            預約專屬旅程諮詢
          </Link>
          <div className="mt-8 flex flex-col items-center gap-3">
            <p className="text-[13.5px] text-muted">想要完全客製？跟 AI 顧問聊聊您的靈感。</p>
            <OpenChatButton />
          </div>
        </div>
      </div>
    </div>
  );
}
