"use client";

import { usePathname } from "next/navigation";
import { ADMIN_NAV, isAdminNavActive } from "./AdminNavItems";

// 後台唯一的 <h1>。手機:頂部標題列;桌機:視覺上由側邊欄品牌名代替,
// 故 sr-only 隱藏但保留在無障礙樹中,避免整個後台沒有 level-1 標題。
export default function AdminPageTitle() {
  const pathname = usePathname();
  const current = ADMIN_NAV.find((item) => isAdminNavActive(pathname, item.href));

  return (
    <h1 className="border-b border-line px-4 py-3 font-serif text-[15px] text-ink lg:sr-only">
      {current?.label ?? "後台"}
    </h1>
  );
}
