// 商品無真實圖檔時的 CSS 漸層佔位圖(依 dc.html .ph 做法延伸):
// 每件作品有自己的漸層色組(products.metadata.gradient),沒有則以 id 決定一組穩定的備援漸層。
const FALLBACK_GRADIENTS: [string, string][] = [
  ["#ece1cd", "#bfa06a"],
  ["#e2d7c4", "#7a6b52"],
  ["#d8c9a8", "#8a7259"],
  ["#f4ede0", "#9a7d47"],
  ["#2e2519", "#a2854a"],
  ["#e3c98f", "#5a4d3b"],
  ["#ece1cd", "#a2854a"],
  ["#e2d7c4", "#bfa06a"],
  ["#2a2016", "#e3c98f"],
];

export function gradientForId(id: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return FALLBACK_GRADIENTS[hash % FALLBACK_GRADIENTS.length];
}

import Image from "next/image";

export default function Placeholder({
  gradient,
  label,
  src,
  alt,
  sizes = "(max-width: 768px) 100vw, 33vw",
  priority = false,
  className = "",
  style,
}: {
  gradient?: [string, string] | null;
  label?: string;
  src?: string | null;
  alt?: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const backgroundImage = gradient
    ? `repeating-linear-gradient(135deg, rgba(120,95,70,0.09) 0 1px, transparent 1px 12px), linear-gradient(135deg, ${gradient[0]}, ${gradient[1]})`
    : undefined;

  return (
    <div
      className={`lm-ph ${className}`}
      // 有真圖時不顯示開發用的佔位標籤
      data-label={src ? undefined : label}
      style={{ backgroundImage, ...style }}
    >
      {src && (
        <Image
          src={src}
          alt={alt ?? label ?? ""}
          fill
          sizes={sizes}
          priority={priority}
          className="object-cover"
        />
      )}
    </div>
  );
}
