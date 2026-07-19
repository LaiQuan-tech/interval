import { NextResponse } from "next/server";
import { tryCreateAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

// 供 ChatWidget 的居家擺放模擬選畫器使用:回傳上架中的作品(slug/name/image)
export async function GET() {
  const supabase = tryCreateAdminClient();
  if (!supabase) {
    return NextResponse.json({ artworks: [] });
  }

  const { data, error } = await supabase
    .from("products")
    .select("slug, name, images")
    .eq("product_type", "artwork")
    .eq("status", "active")
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[artworks] query failed:", error);
    return NextResponse.json({ artworks: [] }, { status: 500 });
  }

  const artworks = (data ?? []).map((p) => {
    const images = (p.images ?? []) as { url: string; alt?: string }[];
    return { slug: p.slug as string, name: p.name as string, image: images[0]?.url ?? null };
  });

  return NextResponse.json({ artworks });
}
