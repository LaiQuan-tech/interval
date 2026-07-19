"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const NAV_ITEMS = [
  { href: "/", label: "首頁", match: (p: string) => p === "/" },
  { href: "/gallery", label: "藝術典藏", match: (p: string) => p.startsWith("/gallery") || p.startsWith("/products") },
  { href: "/journeys", label: "私人旅程", match: (p: string) => p.startsWith("/journeys") },
  { href: "/rental", label: "租賃 · 買斷", match: (p: string) => p.startsWith("/rental") },
  { href: "/membership", label: "會員沙龍", match: (p: string) => p.startsWith("/membership") },
];

export default function NavLinks({ className = "" }: { className?: string }) {
  const pathname = usePathname() ?? "/";

  return (
    <>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          data-active={item.match(pathname)}
          className={`lm-nav-link ${className}`}
        >
          {item.label}
        </Link>
      ))}
    </>
  );
}
