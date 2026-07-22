"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "@/components/LogoutButton";
import { ADMIN_NAV, AdminNavIcon, isAdminNavActive, type AdminBadgeKey } from "./AdminNavItems";

export default function AdminSidebar({
  email,
  badges,
}: {
  email: string;
  badges: Record<AdminBadgeKey, number>;
}) {
  const pathname = usePathname();

  return (
    // 高度由 Task 5 的後台 layout(flex flex-1 橫向容器)撐滿;nav 的 overflow-y-auto 依賴此契約
    <aside className="hidden w-55 shrink-0 flex-col border-r border-line bg-panel lg:flex">
      <div className="border-b border-line px-5 py-4">
        <div className="font-serif text-[17px] text-ink">好日子</div>
        <div className="lm-caption text-[11px]">後台管理</div>
      </div>

      <nav aria-label="主要導覽" className="flex-1 overflow-y-auto p-3">
        {ADMIN_NAV.map((item) => {
          const active = isAdminNavActive(pathname, item.href);
          const count = item.badge ? badges[item.badge] : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              aria-label={count > 0 ? `${item.label}，${count} 筆待處理` : undefined}
              className={`mb-0.5 flex items-center gap-3 px-3 py-2.5 text-sm transition-colors ${
                active
                  ? "bg-accent-soft font-medium text-accent"
                  : "text-nav hover:bg-accent-soft/60 hover:text-accent"
              }`}
            >
              <AdminNavIcon d={item.icon} />
              <span>{item.label}</span>
              {count > 0 && (
                <span className="ml-auto min-w-5 rounded-full bg-accent px-1.5 py-0.5 text-center text-[11px] font-medium text-paper">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-line px-5 py-4 text-[12px] text-ink-soft">
        <div className="truncate" title={email}>
          {email}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <Link href="/" className="text-accent hover:underline">
            回前台
          </Link>
          <LogoutButton />
        </div>
      </div>
    </aside>
  );
}
