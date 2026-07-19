import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

async function getFeatured(): Promise<Product[]> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("status", "active")
      .order("featured", { ascending: false })
      .order("sort_order")
      .limit(8);
    return (data ?? []) as Product[];
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const products = await getFeatured();

  return (
    <div>
      {/* Hero */}
      <section className="border-b border-line bg-card">
        <div className="iv-container flex flex-col items-start gap-6 py-16 sm:py-24">
          <p className="rounded-full bg-accent-soft px-4 py-1.5 text-sm font-semibold text-accent">
            interval — 跨境電商
          </p>
          <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
            把好東西
            <br className="sm:hidden" />
            <span className="text-accent">賣到全世界</span>
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
            精選商品直送到你手上。需要大量採購?讓 AI
            智慧客服即時了解你的需求,自動準備報價、一鍵下單。
          </p>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="/products" className="iv-btn-primary w-full sm:w-auto">
              逛逛商品
            </Link>
            <Link href="/quote-info" className="iv-btn-ghost w-full sm:w-auto">
              大量採購報價
            </Link>
          </div>
        </div>
      </section>

      {/* 特色 */}
      <section className="iv-container grid gap-4 py-12 sm:grid-cols-3">
        {[
          {
            title: "會員專屬",
            desc: "註冊會員即可追蹤訂單、快速結帳、查看專屬報價。",
          },
          {
            title: "AI 智慧報價",
            desc: "跟右下角智慧客服說需求,報價單自動準備、寄到信箱。",
          },
          {
            title: "安心購物",
            desc: "訂單全程狀態透明,出貨、付款通知即時送達。",
          },
        ].map((f) => (
          <div key={f.title} className="iv-card">
            <h3 className="font-bold">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* 精選商品 */}
      <section className="iv-container pb-8">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-2xl font-bold">精選商品</h2>
          <Link href="/products" className="text-sm font-medium text-accent">
            查看全部 →
          </Link>
        </div>
        {products.length === 0 ? (
          <div className="iv-card text-center text-ink-soft">
            商品即將上架,敬請期待!
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
