"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "@/lib/i18n/context";
import type { Messages } from "@/lib/i18n/messages";

// label 改成 nav messages 的 key(labelKey),實際文字由 render 端依目前語系從
// messages.nav 取——Header(桌機)與 MobileNav(手機)共用同一份 NAV_ITEMS,
// 兩端都會自動吃到正確語系,不需要各自維護一份文字。
export const NAV_ITEMS: {
  href: string;
  labelKey: keyof Messages["nav"];
  match: (p: string) => boolean;
}[] = [
  { href: "/", labelKey: "home", match: (p: string) => p === "/" },
  { href: "/gallery", labelKey: "gallery", match: (p: string) => p.startsWith("/gallery") || p.startsWith("/products") },
  { href: "/journeys", labelKey: "journeys", match: (p: string) => p.startsWith("/journeys") },
  { href: "/rental", labelKey: "rental", match: (p: string) => p.startsWith("/rental") },
  { href: "/membership", labelKey: "membership", match: (p: string) => p.startsWith("/membership") },
];

export default function NavLinks({ className = "" }: { className?: string }) {
  const pathname = usePathname() ?? "/";
  const { messages } = useTranslations();

  return (
    <>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          data-active={item.match(pathname)}
          className={`lm-nav-link ${className}`}
        >
          {messages.nav[item.labelKey]}
        </Link>
      ))}
    </>
  );
}
