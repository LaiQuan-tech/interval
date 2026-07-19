"use client";

import Link from "next/link";
import { useState } from "react";

export default function MobileNav({
  loggedIn,
  isAdmin,
}: {
  loggedIn: boolean;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        aria-label="開啟選單"
        onClick={() => setOpen(!open)}
        className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-line/60"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
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
        <div className="absolute inset-x-0 top-14 border-b border-line bg-card shadow-lg">
          <nav className="iv-container flex flex-col py-2 text-base">
            {[
              { href: "/products", label: "商品" },
              { href: "/quote-info", label: "大量採購 / AI 報價" },
              ...(loggedIn
                ? [{ href: "/account", label: "會員中心" }]
                : [{ href: "/login", label: "登入 / 註冊" }]),
              ...(isAdmin ? [{ href: "/admin", label: "後台管理" }] : []),
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="border-b border-line/60 py-3.5 last:border-0"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
