import { createAdminClient } from "@/lib/supabase/admin";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/types";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata = { title: "商品" };

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;

  let products: Product[] = [];
  let categories: string[] = [];
  try {
    const supabase = createAdminClient();
    let query = supabase
      .from("products")
      .select("*")
      .eq("status", "active")
      .order("sort_order")
      .order("created_at", { ascending: false });
    if (category) query = query.eq("category", category);
    const { data } = await query;
    products = (data ?? []) as Product[];

    const { data: cats } = await supabase
      .from("products")
      .select("category")
      .eq("status", "active")
      .neq("category", "");
    categories = [...new Set((cats ?? []).map((c) => c.category))];
  } catch {
    /* env 未設定 */
  }

  return (
    <div className="iv-container py-8 sm:py-12">
      <h1 className="text-2xl font-bold sm:text-3xl">全部商品</h1>

      {categories.length > 0 && (
        <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
          <Link
            href="/products"
            className={`iv-chip whitespace-nowrap !px-4 !py-2 ${
              !category ? "bg-ink text-white" : "border border-line bg-card"
            }`}
          >
            全部
          </Link>
          {categories.map((c) => (
            <Link
              key={c}
              href={`/products?category=${encodeURIComponent(c)}`}
              className={`iv-chip whitespace-nowrap !px-4 !py-2 ${
                category === c ? "bg-ink text-white" : "border border-line bg-card"
              }`}
            >
              {c}
            </Link>
          ))}
        </div>
      )}

      {products.length === 0 ? (
        <div className="iv-card mt-8 text-center text-ink-soft">
          目前沒有商品,請稍後再來!
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
