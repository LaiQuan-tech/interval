import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTWD } from "@/lib/format";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "草稿",
  active: "上架中",
  archived: "已下架",
};

export default async function AdminProductsPage() {
  const db = createAdminClient();
  const { data } = await db
    .from("products")
    .select("*")
    .neq("status", "archived")
    .order("sort_order")
    .order("created_at", { ascending: false });
  const products = (data ?? []) as Product[];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold">商品管理</h2>
        <Link href="/admin/products/new" className="iv-btn-primary !min-h-10 !px-5">
          + 新增商品
        </Link>
      </div>

      <div className="flex flex-col gap-2.5 lg:hidden">
        {products.map((p) => (
          <div key={p.id} className="iv-card !p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link
                  href={`/admin/products/${p.id}`}
                  className="font-medium text-ink hover:text-accent break-words"
                >
                  {p.name}
                </Link>
              </div>
              <span
                className={`iv-chip shrink-0 ${
                  p.status === "active" ? "bg-ok-soft text-ok" : "bg-line text-ink-soft"
                }`}
              >
                {STATUS_LABEL[p.status]}
              </span>
            </div>
            <div className="mt-1.5 text-[13px] text-ink-soft break-words">
              /{p.slug}
              {p.featured && " · 精選"}
            </div>
            <div className="mt-1 text-[13px] text-ink-soft">
              {formatTWD(p.price)} · 庫存 {p.stock}
            </div>
            <div className="mt-3">
              <Link href={`/admin/products/${p.id}`} className="iv-btn-ghost">
                編輯
              </Link>
            </div>
          </div>
        ))}
        {products.length === 0 && (
          <div className="iv-card text-center text-ink-soft">
            還沒有商品,點右上角「新增商品」開始上架。
          </div>
        )}
      </div>

      <div className="iv-table-wrap hidden lg:block">
        <table className="w-full min-w-130 border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-soft">
              <th className="py-2.5 font-medium">商品</th>
              <th className="py-2.5 text-right font-medium">價格</th>
              <th className="py-2.5 text-right font-medium">庫存</th>
              <th className="py-2.5 text-right font-medium">狀態</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-b border-line/60 hover:bg-card">
                <td className="py-3">
                  <Link href={`/admin/products/${p.id}`} className="font-medium hover:text-accent">
                    {p.name}
                  </Link>
                  <span className="block text-xs text-ink-soft">
                    /{p.slug}
                    {p.featured && " · 精選"}
                  </span>
                </td>
                <td className="py-3 text-right">{formatTWD(p.price)}</td>
                <td className="py-3 text-right">{p.stock}</td>
                <td className="py-3 text-right">
                  <span
                    className={`iv-chip ${
                      p.status === "active"
                        ? "bg-ok-soft text-ok"
                        : "bg-line text-ink-soft"
                    }`}
                  >
                    {STATUS_LABEL[p.status]}
                  </span>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-ink-soft">
                  還沒有商品,點右上角「新增商品」開始上架。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
