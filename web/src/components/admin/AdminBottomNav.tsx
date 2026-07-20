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

  // 面板開啟時:Esc 關閉、鎖定背景捲動(寫法沿用 CartFlyout.tsx 第 39-51 行)
  useEffect(() => {
    if (!moreOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMoreOpen(false);
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [moreOpen]);

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

      <div className="fixed inset-x-0 bottom-0 z-50 lg:hidden">
        {moreOpen && (
          <div className="absolute inset-x-0 bottom-full border-t border-line bg-paper p-3">
            {secondary.map((item) => {
              const active = isAdminNavActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
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
          className="flex border-t border-line bg-paper pb-[env(safe-area-inset-bottom)]"
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
                  <span className="absolute left-1/2 top-1 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] leading-4 text-paper">
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
      </div>
    </>
  );
}
