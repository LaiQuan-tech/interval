"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import LocaleSwitcher from "@/components/LocaleSwitcher";
import { NAV_ITEMS } from "@/components/NavLinks";
import { useTranslations } from "@/lib/i18n/context";

export default function MobileNav({
  loggedIn,
  isAdmin,
}: {
  loggedIn: boolean;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "/";
  const { messages } = useTranslations();

  return (
    <div className="lg:hidden">
      <button
        aria-label={messages.nav.openMenu}
        onClick={() => setOpen(!open)}
        className="flex h-11 w-11 items-center justify-center text-ink-deep hover:bg-panel"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          {open ? (
            <>
              <line x1="5" y1="5" x2="19" y2="19" />
              <line x1="19" y1="5" x2="5" y2="19" />
            </>
          ) : (
            <>
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </>
          )}
        </svg>
      </button>

      {open && (
        <div className="absolute inset-x-0 top-full border-t border-line bg-paper shadow-lg">
          <nav className="lm-container flex flex-col py-2 text-base">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                data-active={item.match(pathname)}
                className="border-b border-line/60 py-3.5 tracking-[0.04em] text-nav last:border-0 data-[active=true]:text-accent"
              >
                {messages.nav[item.labelKey]}
              </Link>
            ))}
            <Link
              href="/booking"
              onClick={() => setOpen(false)}
              className="border-b border-line/60 py-3.5 font-medium tracking-[0.04em] text-ink-deep"
            >
              {messages.nav.booking}
            </Link>
            {loggedIn ? (
              <Link
                href="/account"
                onClick={() => setOpen(false)}
                className="border-b border-line/60 py-3.5 tracking-[0.04em] text-nav"
              >
                {messages.nav.memberCenter}
              </Link>
            ) : (
              <Link
                href="/login"
                onClick={() => setOpen(false)}
                className="border-b border-line/60 py-3.5 tracking-[0.04em] text-nav"
              >
                {messages.nav.loginRegister}
              </Link>
            )}
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="py-3.5 tracking-[0.04em] text-accent"
              >
                {messages.nav.adminPanel}
              </Link>
            )}
            <div className="flex justify-center border-t border-line/60 py-4">
              <LocaleSwitcher />
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
