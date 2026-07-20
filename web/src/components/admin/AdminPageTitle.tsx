"use client";

import { usePathname } from "next/navigation";
import { ADMIN_NAV, isAdminNavActive } from "./AdminNavItems";

// 後台唯一的 <h1>。全寬 sr-only:視覺上各頁自己的 h2(如「訂單管理」)
// 就是使用者看到的標題,這裡只保留在無障礙樹中,避免整個後台沒有 level-1 標題。
export default function AdminPageTitle() {
  const pathname = usePathname();
  const current = ADMIN_NAV.find((item) => isAdminNavActive(pathname, item.href));

  return (
    <h1 className="sr-only">
      {current?.label ?? "後台"}
    </h1>
  );
}
