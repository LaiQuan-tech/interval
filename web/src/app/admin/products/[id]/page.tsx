import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import ProductForm from "@/components/admin/ProductForm";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let product: Product | null = null;
  if (id !== "new") {
    const db = createAdminClient();
    const { data } = await db.from("products").select("*").eq("id", id).maybeSingle();
    if (!data) notFound();
    product = data as Product;
  }

  return (
    <div className="max-w-2xl">
      <h2 className="mb-4 font-bold">{product ? `編輯:${product.name}` : "新增商品"}</h2>
      <ProductForm product={product} />
    </div>
  );
}
