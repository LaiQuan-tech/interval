import { createAdminClient } from "@/lib/supabase/admin";
import GalleryGrid from "@/components/GalleryGrid";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "藝術典藏" };

async function getArtworks(): Promise<Product[]> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("status", "active")
      .eq("product_type", "artwork")
      .order("sort_order");
    return (data ?? []) as Product[];
  } catch {
    return [];
  }
}

export default async function GalleryPage() {
  const works = await getArtworks();

  return (
    <div>
      <div className="lm-container pt-16 pb-6 sm:pt-20">
        <div className="lm-eyebrow text-[20px]">The Collection</div>
        <h1 className="mt-3.5 mb-4 font-serif text-[27px] font-normal tracking-[0.04em] text-ink sm:text-[52px]">
          藝術典藏
        </h1>
        <p className="max-w-140 text-[15.5px] leading-[2] text-ink-soft">
          每一幅 AI 藝術畫作皆為獨家生成、職人裝裱的實體作品。可租賃、可買斷，會員另享折扣。
        </p>
      </div>
      <div className="lm-container pb-16 sm:pb-24">
        <GalleryGrid works={works} />
      </div>
    </div>
  );
}
