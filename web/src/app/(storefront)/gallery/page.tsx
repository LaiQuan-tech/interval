import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase/admin";
import GalleryGrid from "@/components/GalleryGrid";
import { getLocale, getMessages } from "@/lib/i18n/server";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const messages = getMessages(await getLocale());
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return {
    title: messages.gallery.title,
    description: messages.gallery.metaDescription,
    alternates: {
      languages: {
        "zh-Hant-TW": `${baseUrl}/gallery`,
        en: `${baseUrl}/en/gallery`,
      },
    },
  };
}

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
  const messages = getMessages(await getLocale());
  const works = await getArtworks();

  return (
    <div>
      <div className="lm-container pt-16 pb-6 sm:pt-20">
        <div className="lm-eyebrow text-[20px]">{messages.gallery.eyebrow}</div>
        <h1 className="mt-3.5 mb-4 font-serif text-[27px] font-normal tracking-[0.04em] text-ink sm:text-[52px]">
          {messages.gallery.title}
        </h1>
        <p className="max-w-140 text-[15.5px] leading-[2] text-ink-soft">
          {messages.gallery.desc}
        </p>
      </div>
      <div className="lm-container pb-16 sm:pb-24">
        <GalleryGrid works={works} />
      </div>
    </div>
  );
}
