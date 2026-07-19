import Link from "next/link";
import Image from "next/image";
import { formatTWD } from "@/lib/format";
import type { Product } from "@/lib/types";

export default function ProductCard({ product }: { product: Product }) {
  const image = product.images?.[0];

  return (
    <Link
      href={`/products/${product.slug}`}
      className="group overflow-hidden rounded-2xl border border-line bg-card transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-square bg-paper">
        {image?.url ? (
          <Image
            src={image.url}
            alt={image.alt ?? product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover transition-transform group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl font-bold text-line">
            iv
          </div>
        )}
        {product.stock <= 0 && (
          <span className="absolute left-2 top-2 rounded-full bg-ink/80 px-2.5 py-1 text-xs font-semibold text-white">
            補貨中
          </span>
        )}
      </div>
      <div className="p-3 sm:p-4">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug sm:text-base">
          {product.name}
        </h3>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="font-bold text-accent">{formatTWD(product.price)}</span>
          {product.compare_at_price && product.compare_at_price > product.price && (
            <span className="text-xs text-ink-soft line-through">
              {formatTWD(product.compare_at_price)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
