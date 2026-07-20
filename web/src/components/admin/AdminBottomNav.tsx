"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import LogoutButton from "@/components/LogoutButton";
import { ADMIN_NAV, AdminNavIcon, isAdminNavActive, type AdminBadgeKey } from "./AdminNavItems";

const MORE_ICON = "M5 12h.01M12 12h.01M19 12h.01";

export default function AdminBottomNav({
  email,
  badges,
}: {
  email: string;
  badges: Record<AdminBadgeKey, number>;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  // 換頁後自動關閉面板,避免點完選單它還開著
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  const primary = ADMIN_NAV.filter((i) => i.primary);
  const secondary = ADMIN_NAV.filter((i) => !i.primary);
  const moreActive = secondary.some((i) => isAdminNavActive(pathname, i.href));

  return (
    <>
      {moreOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink-deep/40 lg:hidden"
          onClick={() => setMoreOpen(false)}
          aria-hidden="true"
        />
      )}

      {moreOpen && (
        <div className="fixed inset-x-0 bottom-14 z-50 border-t border-line bg-paper p-3 lg:hidden">
          {secondary.map((item) => {
            const active = isAdminNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-3 text-sm ${
                  active ? "bg-accent-soft font-medium text-accent" : "text-nav"
                }`}
              >
                <AdminNavIcon d={item.icon} />
                {item.label}
              </Link>
            );
          })}
          <div className="mt-2 border-t border-line px-3 pt-3 text-[12px] text-ink-soft">
            <div className="truncate">{email}</div>
            <div className="mt-1 flex items-center gap-3">
              <Link href="/" className="text-accent">
                回前台
              </Link>
              <LogoutButton />
            </div>
          </div>
        </div>
      )}

      <nav
        aria-label="底部導覽"
        className="fixed inset-x-0 bottom-0 z-50 flex border-t border-line bg-paper lg:hidden"
      >
        {primary.map((item) => {
          const active = isAdminNavActive(pathname, item.href);
          const count = item.badge ? badges[item.badge] : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-label={count > 0 ? `${item.label}，${count} 筆待處理` : undefined}
              className={`relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${
                active ? "text-accent" : "text-muted-2"
              }`}
            >
              <AdminNavIcon d={item.icon} />
              {item.label}
              {count > 0 && (
                <span className="absolute right-1/2 top-1 ml-3 min-w-4 translate-x-full rounded-full bg-accent px-1 text-center text-[10px] leading-4 text-paper">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
          className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${
            moreOpen || moreActive ? "text-accent" : "text-muted-2"
          }`}
        >
          <AdminNavIcon d={MORE_ICON} />
          更多
        </button>
      </nav>
    </>
  );
}
