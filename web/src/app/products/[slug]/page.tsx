import { notFound } from "next/navigation";
import Image from "next/image";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTWD } from "@/lib/format";
import AddToCartButton from "@/components/AddToCartButton";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let product: Product | null = null;
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("slug", slug)
      .eq("status", "active")
      .maybeSingle();
    product = data as Product | null;
  } catch {
    /* env 未設定 */
  }

  if (!product) notFound();

  const image = product.images?.[0];

  return (
    <div className="iv-container py-8 sm:py-12">
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="relative aspect-square overflow-hidden rounded-2xl border border-line bg-card">
          {image?.url ? (
            <Image
              src={image.url}
              alt={image.alt ?? product.name}
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
              priority
            />
          ) : (
            <div className="flex h-full items-center justify-center text-6xl font-bold text-line">
              iv
            </div>
          )}
        </div>

        <div className="flex flex-col">
          {product.category && (
            <span className="text-sm text-ink-soft">{product.category}</span>
          )}
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{product.name}</h1>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-3xl font-bold text-accent">
              {formatTWD(product.price)}
            </span>
            {product.compare_at_price &&
              product.compare_at_price > product.price && (
                <span className="text-lg text-ink-soft line-through">
                  {formatTWD(product.compare_at_price)}
                </span>
              )}
          </div>

          <p className="mt-6 whitespace-pre-wrap text-base leading-relaxed text-ink-soft">
            {product.description || "此商品尚無詳細說明。"}
          </p>

          <div className="mt-8">
            <AddToCartButton product={product} />
          </div>

          <div className="mt-6 rounded-xl bg-accent-soft p-4 text-sm leading-relaxed text-ink">
            需要大量採購或客製?跟右下角的
            <span className="font-semibold text-accent"> AI 智慧客服 </span>
            說需求,我們會自動為你準備專屬報價單。
          </div>
        </div>
      </div>
    </div>
  );
}
