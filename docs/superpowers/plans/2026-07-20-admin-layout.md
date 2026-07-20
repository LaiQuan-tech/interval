# 小時光後台版面改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓 `/admin` 脫離顧客端外殼，桌機用左側邊欄、手機用底部分頁列，並修掉導致內容被裁切的容器缺陷。

**Architecture:** 用 Next.js route group 把顧客端頁面收進 `app/(storefront)/`（網址不變），顧客端的 Header/Footer/ChatWidget/CartFlyout 只掛在該群組的 layout；根 layout 只留 html/body/字體。後台 layout 改寫成自有外殼：`AdminSidebar`（≥lg）與 `AdminBottomNav`（<lg）共用一份 `ADMIN_NAV` 定義。五個清單頁維持桌機表格、新增手機卡片版。

**Tech Stack:** Next.js 15 App Router、React 19、Tailwind CSS 4（`@theme` token）、Supabase（`@supabase/ssr`）。

**驗證方式說明：** 本 repo **沒有測試框架**（無 test script、無測試檔），因此本計畫不使用 red-green TDD。每個任務以 `npm run typecheck` / `npm run build` 加上瀏覽器實測（1280px 桌機、390px 手機）作為驗收證據，通過才 commit。所有指令都在 repo 根目錄 `scratchpad/interval/` 執行。

**設計來源：** `docs/superpowers/specs/2026-07-20-admin-layout-design.md`

---

## File Structure

| 檔案 | 責任 |
|---|---|
| `web/src/app/layout.tsx` | 只負責 `<html>`/`<body>`/字體/metadata |
| `web/src/app/(storefront)/layout.tsx` | 顧客端外殼：Header、Footer、ChatWidget、CartFlyout |
| `web/src/components/admin/AdminNavItems.tsx` | 導覽項目與圖示的**單一來源**（側邊欄與分頁列共用） |
| `web/src/components/admin/AdminSidebar.tsx` | 桌機側邊欄（client，active 判定） |
| `web/src/components/admin/AdminBottomNav.tsx` | 手機底部分頁列 ＋「更多」面板（client） |
| `web/src/app/admin/layout.tsx` | 守衛 + 外殼組裝 + 徽章數量查詢 |
| `web/src/app/admin/{orders,quotes,products,members,bookings}/page.tsx` | 各自加手機卡片版清單 |

---

## Task 1: 用 route group 把顧客端外殼與後台分離

**Files:**
- Create: `web/src/app/(storefront)/layout.tsx`
- Modify: `web/src/app/layout.tsx`
- Move: `web/src/app/{account,booking,cart,checkout,gallery,journeys,login,membership,orders,products,quote,quote-info,rental}` → `web/src/app/(storefront)/`
- Move: `web/src/app/page.tsx` → `web/src/app/(storefront)/page.tsx`

- [ ] **Step 1: 搬移顧客端頁面到 route group**

```bash
cd web/src/app
mkdir -p "(storefront)"
git mv account booking cart checkout gallery journeys login membership orders products quote quote-info rental "(storefront)/"
git mv page.tsx "(storefront)/page.tsx"
```

`not-found.tsx`、`admin/`、`api/`、`globals.css`、`layout.tsx` **留在原位**。（`not-found.tsx` 必須留根層，App Router 只有根層的會接住未匹配網址。）

- [ ] **Step 2: 建立 storefront layout，承接四個顧客端元件**

Create `web/src/app/(storefront)/layout.tsx`：

```tsx
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ChatWidget from "@/components/ChatWidget";
import CartFlyout from "@/components/CartFlyout";
import { getShippingConfig } from "@/lib/settings";

export default async function StorefrontLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const shippingConfig = await getShippingConfig();

  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <ChatWidget />
      <CartFlyout
        shippingConfig={{
          fee_home: shippingConfig.fee_home,
          free_threshold_home: shippingConfig.free_threshold_home,
        }}
      />
    </>
  );
}
```

- [ ] **Step 3: 根 layout 只留骨架**

Modify `web/src/app/layout.tsx` — 刪掉 `Header`/`Footer`/`ChatWidget`/`CartFlyout` 的 import 與使用，以及 `getShippingConfig` import 與呼叫，函式改為非 async。`metadata`、`viewport`、`FONTS_URL` 常數、`<head>` 內的字體 link 全部保留不動。body 之內只留 `{children}`：

```tsx
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant-TW">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={FONTS_URL} rel="stylesheet" />
      </head>
      <body className="flex min-h-dvh flex-col antialiased">{children}</body>
    </html>
  );
}
```

`body` 的 `flex min-h-dvh flex-col` 保留——storefront layout 的 `<main className="flex-1">` 與後台外殼都依賴它撐滿高度。

- [ ] **Step 4: 驗證建置與路由完全不變**

Run:
```bash
npm run typecheck --workspace web && npm run build --workspace web 2>&1 | grep -E "^[├└│]|Route|●|ƒ|○" | head -40
```

Expected: 建置成功，且路由表包含且網址未改變：`/`、`/gallery`、`/journeys`、`/rental`、`/membership`、`/booking`、`/products/[slug]`、`/cart`、`/checkout`、`/account`、`/login`、`/orders/[token]`、`/quote/[token]`、`/quote-info`、`/admin`、`/_not-found`。若任一顧客端網址消失或多出 `/(storefront)` 字樣，代表搬錯位置，回頭檢查 Step 1。

- [ ] **Step 5: 瀏覽器實測顧客端外觀未變**

啟 dev server（`npm run dev --workspace web`，port 3000），在瀏覽器檢查：

```js
// 於 http://localhost:3000/ 執行
JSON.stringify({
  header: !!document.querySelector('header'),
  footer: !!document.querySelector('footer'),
  chat: !!document.querySelector('[aria-label*="客服"], button'),
})
```

Expected: `header` 與 `footer` 皆為 `true`（顧客端外殼仍在）。再開 `http://localhost:3000/admin`（需先登入 admin），確認頁面上**沒有**顧客端導覽列與頁尾。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: 以 route group 分離顧客端外殼與後台

顧客端頁面移入 app/(storefront)/，Header/Footer/ChatWidget/CartFlyout
改掛該群組 layout；根 layout 只留 html/body/字體。網址完全不變。"
```

---

## Task 2: 導覽項目單一來源

**Files:**
- Create: `web/src/components/admin/AdminNavItems.tsx`

- [ ] **Step 1: 建立共用的導覽定義與圖示**

專案沒有 icon 套件（既有做法是 inline SVG，見 `components/CartLink.tsx:28`），因此圖示用 inline SVG path 表示。

Create `web/src/components/admin/AdminNavItems.tsx`：

```tsx
export type AdminBadgeKey = "orders" | "quotes";

export type AdminNavItem = {
  href: string;
  label: string;
  /** SVG path d 屬性(24x24 viewBox, stroke 樣式) */
  icon: string;
  badge?: AdminBadgeKey;
  /** true = 顯示在手機底部分頁列;false = 收進「更多」 */
  primary?: boolean;
};

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin", label: "總覽", icon: "M3 12h7V3H3v9Zm11 9h7v-9h-7v9ZM3 21h7v-6H3v6Zm11-12h7V3h-7v6Z" },
  { href: "/admin/orders", label: "訂單", icon: "M6 2h9l5 5v15H6V2Zm9 0v5h5M9 13h8M9 17h5", badge: "orders", primary: true },
  { href: "/admin/quotes", label: "報價", icon: "M5 3h10l4 4v14H5V3Zm10 0v4h4M9 12h6M9 16h4", badge: "quotes", primary: true },
  { href: "/admin/products", label: "商品", icon: "M3 6h18v13H3V6Zm0 0 3-3h12l3 3M9 11a3 3 0 0 0 6 0", primary: true },
  { href: "/admin/members", label: "會員", icon: "M16 20v-1a4 4 0 0 0-8 0v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" },
  { href: "/admin/bookings", label: "預約", icon: "M4 5h16v16H4V5Zm0 5h16M9 3v4M15 3v4" },
  { href: "/admin/settings", label: "設定", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3a8 8 0 0 1-.1 1.2l2 1.6-2 3.4-2.4-1a8 8 0 0 1-2 1.2l-.4 2.6h-4l-.4-2.6a8 8 0 0 1-2-1.2l-2.4 1-2-3.4 2-1.6A8 8 0 0 1 4 12a8 8 0 0 1 .1-1.2l-2-1.6 2-3.4 2.4 1a8 8 0 0 1 2-1.2L8.9 3h4l.4 2.6a8 8 0 0 1 2 1.2l2.4-1 2 3.4-2 1.6A8 8 0 0 1 20 12Z" },
];

/** 目前路徑是否命中該項目。/admin 需完全相符,否則所有子頁都會讓它亮起。 */
export function isAdminNavActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminNavIcon({ d, className = "" }: { d: string; className?: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
```

- [ ] **Step 2: 驗證型別**

Run: `npm run typecheck --workspace web`
Expected: 無輸出（通過）。

- [ ] **Step 3: Commit**

```bash
git add web/src/components/admin/AdminNavItems.tsx
git commit -m "feat(admin): 新增導覽項目單一來源與 active 判定"
```

---

## Task 3: 桌機側邊欄

**Files:**
- Create: `web/src/components/admin/AdminSidebar.tsx`

- [ ] **Step 1: 建立側邊欄元件**

Create `web/src/components/admin/AdminSidebar.tsx`：

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
    <aside className="hidden w-55 shrink-0 flex-col border-r border-line bg-panel lg:flex">
      <div className="border-b border-line px-5 py-4">
        <div className="font-serif text-[17px] text-ink">小時光</div>
        <div className="lm-caption text-[11px]">後台管理</div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3">
        {ADMIN_NAV.map((item) => {
          const active = isAdminNavActive(pathname, item.href);
          const count = item.badge ? badges[item.badge] : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
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
```

登出重用既有的 `web/src/components/LogoutButton.tsx`（client component，內部呼叫 `supabase.auth.signOut()` 後導回首頁）。專案**沒有** `/logout` 路由，不要自建。在檔案頂端加上：

```tsx
import LogoutButton from "@/components/LogoutButton";
```

- [ ] **Step 2: 驗證型別**

Run: `npm run typecheck --workspace web`
Expected: 無輸出。（此時尚未被引用，只驗證元件本身型別正確。）

- [ ] **Step 3: Commit**

```bash
git add web/src/components/admin/AdminSidebar.tsx
git commit -m "feat(admin): 新增桌機左側邊欄"
```

---

## Task 4: 手機底部分頁列與「更多」面板

**Files:**
- Create: `web/src/components/admin/AdminBottomNav.tsx`

- [ ] **Step 1: 建立底部分頁列元件**

Create `web/src/components/admin/AdminBottomNav.tsx`：

```tsx
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

      {/* 面板與 nav 一起包在外層 fixed 容器內,面板用 bottom-full 貼齊 nav 上緣——
          不要寫死 bottom-14 之類的高度,nav 高度由內容決定,寫死必然漂移。 */}
      {moreOpen && (
        <div className="absolute inset-x-0 bottom-full border-t border-line bg-paper p-3">
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
                /* left-1/2 單獨即可;實測 right-1/2+ml-3+translate-x-full 渲染結果相同,
                   其中 ml-3 完全無效果(絕對定位求解會抵銷 margin),不要再寫回去。 */
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
    </>
  );
}
```

- [ ] **Step 2: 驗證型別**

Run: `npm run typecheck --workspace web`
Expected: 無輸出。

- [ ] **Step 3: Commit**

```bash
git add web/src/components/admin/AdminBottomNav.tsx
git commit -m "feat(admin): 新增手機底部分頁列與更多面板"
```

---

## Task 5: 組裝後台外殼並修掉容器缺陷

**Files:**
- Create: `web/src/components/admin/AdminPageTitle.tsx`
- Modify: `web/src/app/admin/layout.tsx`（整檔改寫，守衛邏輯保留）

- [ ] **Step 0: 新增後台頁面標題（同時是後台唯一的 `<h1>`）**

舊版 layout 有 `<h1>後台管理</h1>`；新外殼若不補回，整個 `/admin/*` 將沒有 level-1 標題（側邊欄品牌名是 `<div>`），是無障礙迴歸。同時 spec 要求手機頂部列顯示「**目前頁面標題**」而非固定字串，兩者用同一個元件一併解決。

Create `web/src/components/admin/AdminPageTitle.tsx`：

```tsx
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
```

- [ ] **Step 1: 改寫後台 layout**

`iv-container` 這個 class 在 `globals.css` 中不存在（全專案僅 `app/admin/layout.tsx:37` 一處使用），是內容貼齊螢幕邊緣、寬表格被裁切的原因。改用明確的 Tailwind。

Replace the entire contents of `web/src/app/admin/layout.tsx`：

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminBottomNav from "@/components/admin/AdminBottomNav";
import AdminPageTitle from "@/components/admin/AdminPageTitle";
import type { AdminBadgeKey } from "@/components/admin/AdminNavItems";

export const dynamic = "force-dynamic";

// 後台守衛:必須登入且 profiles.role = 'admin'
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/admin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/");

  // 待處理數量。注意:Supabase 查詢失敗不會拋例外,錯誤在回傳值的 error 欄位,
  // 所以必須顯式檢查並記錄——否則欄位/權限一旦變動,徽章會永遠是 0 而無人察覺。
  // 外層 try/catch 只是防網路層等非預期例外,不讓輔助資訊拖垮整個後台。
  const badges: Record<AdminBadgeKey, number> = { orders: 0, quotes: 0 };
  try {
    const [pendingOrders, draftQuotes] = await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("quotes").select("id", { count: "exact", head: true }).eq("status", "draft"),
    ]);
    if (pendingOrders.error) console.error("[admin] 待付款訂單數查詢失敗", pendingOrders.error);
    if (draftQuotes.error) console.error("[admin] 草稿報價數查詢失敗", draftQuotes.error);
    badges.orders = pendingOrders.count ?? 0;
    badges.quotes = draftQuotes.count ?? 0;
  } catch (err) {
    console.error("[admin] 徽章查詢發生非預期例外", err);
  }

  const email = user.email ?? "";

  return (
    <div className="flex flex-1">
      <AdminSidebar email={email} badges={badges} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* 後台唯一的 h1(見下方 AdminPageTitle)。不可包進 lg:hidden 容器,
            否則桌機會被 display:none 移出無障礙樹,整個後台就沒有 level-1 標題。 */}
        <AdminPageTitle />

        {/* pb-20 讓最後一列不被手機底部分頁列蓋住 */}
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-20 pt-5 sm:px-6 lg:pb-10">
          {children}
        </main>
      </div>

      <AdminBottomNav email={email} badges={badges} />
    </div>
  );
}
```

- [ ] **Step 2: 驗證建置**

Run: `npm run lint --workspace web && npm run typecheck --workspace web && npm run build --workspace web 2>&1 | tail -5`
Expected: lint 無錯誤、typecheck 無輸出、build 顯示 `✓ Compiled successfully`。

- [ ] **Step 3: 瀏覽器實測兩種寬度**

啟 dev server 並以 admin 帳號登入後開 `/admin/orders`。

桌機（視窗寬 1280px）執行：
```js
// 注意:Task 4 修正後 `fixed` 在外層 wrapper div 上(為了讓「更多」面板用
// bottom-full 貼齊),不在 <nav> 上,所以這裡選 wrapper 而非 nav.fixed。
JSON.stringify({
  sidebar: !!document.querySelector('aside'),
  sidebarVisible: !!document.querySelector('aside')?.offsetParent,
  bottomNav: getComputedStyle(document.querySelector('div.fixed.bottom-0')).display,
  overflow: document.body.scrollWidth <= window.innerWidth,
})
```
Expected: `sidebar: true`、`sidebarVisible: true`、`bottomNav: "none"`、`overflow: true`。

手機（視窗寬 390px）執行同一段。
Expected: `sidebar: true` 但 `sidebarVisible: false`（`hidden lg:flex`）、`bottomNav` 非 `"none"`（wrapper 是普通 block，內層 `<nav>` 才是 flex）、`overflow: true`（無水平溢出）。

再點側邊欄各項，確認 active 高亮跟著換頁；`/admin` 只在總覽頁亮起，不會在子頁一起亮。

兩種寬度都要另外執行這段，確認 `<h1>` 存在且在桌機仍留在無障礙樹中（`display:none` 就是沒修好）：
```js
JSON.stringify({
  h1Count: document.querySelectorAll('h1').length,
  h1Text: document.querySelector('h1')?.textContent,
  h1InA11yTree: getComputedStyle(document.querySelector('h1')).display !== 'none',
})
```
Expected（`/admin/orders`）：`h1Count: 1`、`h1Text: "訂單"`、`h1InA11yTree: true`。手機再切到 `/admin/settings` 確認變成「設定」。

- [ ] **Step 4: Commit**

```bash
git add web/src/app/admin/layout.tsx web/src/components/admin/AdminPageTitle.tsx
git commit -m "feat(admin): 後台外殼改為側邊欄+底部分頁,修正未定義的 iv-container

iv-container 未定義導致內容無最大寬度與留白、寬表格被裁切,
改用明確的 max-w-[1400px] 容器。"
```

---

## 卡片共用規則（Task 6–8 一體適用，實作前必讀）

以下兩條是 Task 6 實作後由程式品質審查抓出來的缺陷，**下方所有卡片範本都已據此修正**；若你在範本裡看到違反這兩條的寫法，以本節為準。

1. **`iv-chip` 一定要配色。** `.iv-chip`（`globals.css:226-233`）只定義排版（padding、圓角、字級），**沒有 background / color / border**。裸寫 `iv-chip` 會渲染成沒有底色的文字，看起來像樣式壞掉。全 repo 既有 15 處用法都搭配了配色 class。**規則：手機卡片的 chip 一律沿用該頁桌機表格同一欄位的 class 表達式**——若桌機是條件式配色（如 `quotes`、`products` 依狀態給不同顏色），就沿用**同一份**條件邏輯，不要自己另寫一套；若桌機是固定配色（如 `orders` 的 `bg-accent-soft text-accent`），就照抄。

2. **徽章不要包進 `<Link>` 裡。** 徽章（AI 標記、狀態 chip 等）若寫在 `<Link>` 內部，會被併入連結的可及名稱，螢幕閱讀器會讀成「Q-2026-0003 AI」；而各頁桌機表格都是把徽章放在連結**外面**當手足元素。**規則：徽章一律放 `</Link>` 外，與桌機一致**；需要並排時用一個 `<div className="min-w-0">` 包住「連結＋徽章」，`min-w-0` 讓長內容在 flex 容器裡能正確收縮。

3. **次要資訊行一定要 `break-words`。** 卡片沒有 `overflow` 保護（`.iv-card` 未設），而姓名、email 等欄位可能是近百字的無空白字串（客戶把 email 或亂碼貼進姓名欄）。少了 `break-words` 會撐開卡片、造成**整頁水平溢出**——而「內容被裁切、要橫向滑」正是這整個改造要解決的原始問題，不可在新版重新引入。桌機表格因為包在有 `overflow-x:auto` 的 `iv-table-wrap` 裡不受影響，手機卡片沒有這層保護，必須自己加。

---

## Task 6: 訂單清單手機卡片

**Files:**
- Modify: `web/src/app/admin/orders/page.tsx`

- [ ] **Step 1: 桌機表格加上斷點、新增手機卡片**

現況是 `<div className="iv-table-wrap"><table className="w-full min-w-140 ...">`（約 `:41-42`）。

1. 把既有的 `<div className="iv-table-wrap">` 改成 `<div className="iv-table-wrap hidden lg:block">`。
2. 在該 div **之前**插入手機卡片清單。欄位取自既有查詢結果（`Order` 型別：`order_no`、`status`、`total`、`contact_name`、`created_at`、`public_token`、`id`），沿用既有的 `formatTWD`、`formatDate`、`ORDER_STATUS_LABEL` 與狀態按鈕元件 `OrderStatusButtons`（**不要**重寫狀態流轉邏輯）：

```tsx
<div className="flex flex-col gap-2.5 lg:hidden">
  {orders.map((o) => (
    <div key={o.id} className="iv-card !p-3.5">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/admin/orders/${o.id}`} className="font-medium text-ink hover:text-accent">
          {o.order_no}
        </Link>
        <span className="iv-chip shrink-0 bg-accent-soft text-accent">
          {ORDER_STATUS_LABEL[o.status] ?? o.status}
        </span>
      </div>
      <div className="mt-1.5 text-[13px] text-ink-soft break-words">
        {o.contact_name} · {formatTWD(o.total)} · {formatDate(o.created_at)}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <OrderStatusButtons orderId={o.id} status={o.status} />
      </div>
    </div>
  ))}
  {orders.length === 0 && (
    <div className="iv-card text-center text-ink-soft">目前沒有訂單。</div>
  )}
</div>
```

**在動手前先讀該檔**，確認：迴圈變數名稱、`OrderStatusButtons` 實際的 props 簽名、`ORDER_STATUS_LABEL` 的匯入來源與既有空狀態文案，並據此調整上面的程式碼。若 `OrderStatusButtons` 在桌機表格中帶有其他 props，手機卡片要傳一模一樣的值。

- [ ] **Step 2: 驗證建置**

Run: `npm run typecheck --workspace web && npm run build --workspace web 2>&1 | tail -3`
Expected: typecheck 無輸出、build 成功。

- [ ] **Step 3: 手機實測**

視窗寬 390px 開 `/admin/orders`：
```js
JSON.stringify({
  cards: document.querySelectorAll('.iv-card').length,
  tableVisible: [...document.querySelectorAll('table')].some(t => t.offsetParent !== null),
  overflow: document.body.scrollWidth <= window.innerWidth,
})
```
Expected: `cards` > 0（有卡片）、`tableVisible: false`（表格在手機隱藏）、`overflow: true`（無水平溢出）。

視窗寬 1280px 再測一次。
Expected: `tableVisible: true`（桌機顯示表格）。

- [ ] **Step 4: Commit**

```bash
git add web/src/app/admin/orders/page.tsx
git commit -m "feat(admin): 訂單清單在手機改為卡片式"
```

---

## Task 7: 報價清單手機卡片

**Files:**
- Modify: `web/src/app/admin/quotes/page.tsx`

- [ ] **Step 1: 桌機表格加上斷點、新增手機卡片**

現況 `<div className="iv-table-wrap">` 在約 `:24`。改為 `<div className="iv-table-wrap hidden lg:block">`，並在其前插入：

```tsx
<div className="flex flex-col gap-2.5 lg:hidden">
  {quotes.map((q) => (
    <div key={q.id} className="iv-card !p-3.5">
      <div className="flex items-start justify-between gap-2">
        {/* AI 徽章必須在 </Link> 外(比照桌機表格 :78-83)。包在 Link 內會讓螢幕閱讀器
            把連結可及名稱讀成「Q-2026-0003 AI」,與桌機同一筆資料的語意不一致。
            min-w-0 讓長內容在 flex 容器裡能正確收縮。 */}
        <div className="min-w-0">
          <Link href={`/admin/quotes/${q.id}`} className="font-medium text-ink hover:text-accent">
            {q.quote_no}
          </Link>
          {q.created_by === "ai" && (
            <span className="iv-chip ml-2 bg-warn-soft text-warn">AI</span>
          )}
        </div>
        {/* 配色必須沿用桌機表格 :53-63 的同一份條件式,不要另寫一套(見「卡片共用規則」1) */}
        <span className="iv-chip shrink-0 ...沿用桌機條件式配色...">{q.status}</span>
      </div>
      <div className="mt-1.5 text-[13px] text-ink-soft break-words">
        {q.contact_email} · {formatTWD(q.total)} · {formatDate(q.created_at)}
      </div>
      <div className="mt-3">
        <Link href={`/admin/quotes/${q.id}`} className="iv-btn-ghost">
          審核
        </Link>
      </div>
    </div>
  ))}
  {quotes.length === 0 && (
    <div className="iv-card text-center text-ink-soft">還沒有報價單。</div>
  )}
</div>
```

**動手前先讀該檔**：狀態 chip 在既有表格中是用條件式套不同顏色 class（約 `:51-63`），手機卡片要沿用**同一份**條件邏輯，不要自己另寫一套；空狀態文案也照抄既有的。

- [ ] **Step 2: 驗證建置**

Run: `npm run typecheck --workspace web && npm run build --workspace web 2>&1 | tail -3`
Expected: typecheck 無輸出、build 成功。

- [ ] **Step 3: 手機實測**

視窗寬 390px 開 `/admin/quotes`，執行 Task 6 Step 3 的同一段檢查。
Expected: `cards` > 0、`tableVisible: false`、`overflow: true`。

- [ ] **Step 4: Commit**

```bash
git add web/src/app/admin/quotes/page.tsx
git commit -m "feat(admin): 報價清單在手機改為卡片式"
```

---

## Task 8: 商品、會員、預約清單手機卡片

**Files:**
- Modify: `web/src/app/admin/products/page.tsx`
- Modify: `web/src/app/admin/members/page.tsx`
- Modify: `web/src/app/admin/bookings/page.tsx`

三個檔案套用同一模式：既有 `<div className="iv-table-wrap">` 加上 `hidden lg:block`，並在其前插入 `<div className="flex flex-col gap-2.5 lg:hidden">` 卡片清單。

- [ ] **Step 1: 商品清單**

`Product` 欄位：`name`、`slug`、`price`、`stock`、`status`、`product_type`、`id`。

```tsx
<div className="flex flex-col gap-2.5 lg:hidden">
  {products.map((p) => (
    <div key={p.id} className="iv-card !p-3.5">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/admin/products/${p.id}`} className="font-medium text-ink hover:text-accent">
          {p.name}
        </Link>
        {/* 配色沿用桌機表格 :59 的同一份條件式(見「卡片共用規則」1) */}
        <span className="iv-chip shrink-0 ...沿用桌機條件式配色...">{p.status}</span>
      </div>
      <div className="mt-1.5 text-[13px] text-ink-soft break-words">
        {p.product_type} · {formatTWD(p.price)} · 庫存 {p.stock}
      </div>
      <div className="mt-3">
        <Link href={`/admin/products/${p.id}`} className="iv-btn-ghost">
          編輯
        </Link>
      </div>
    </div>
  ))}
</div>
```

- [ ] **Step 2: 會員清單**

`Profile` 欄位：`id`、`email`、`name`、`tier_slug`、`created_at`，點數餘額欄位以該頁既有查詢結果為準。

```tsx
<div className="flex flex-col gap-2.5 lg:hidden">
  {members.map((m) => (
    <div key={m.id} className="iv-card !p-3.5">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-ink break-words">{m.name || m.email}</span>
        {/* 等級 chip 沿用桌機表格 :60 的 `iv-chip bg-accent-soft text-accent` */}
        {m.tier_slug && (
          <span className="iv-chip shrink-0 bg-accent-soft text-accent">{m.tier_slug}</span>
        )}
      </div>
      <div className="mt-1.5 text-[13px] text-ink-soft break-words">{m.email}</div>
    </div>
  ))}
</div>
```

**讀該檔後補上**：既有表格顯示的點數餘額與調點元件（`AdjustPointsForm`）也要放進卡片，props 與桌機完全一致。

- [ ] **Step 3: 預約清單**

`Booking` 欄位：`id`、`name`、`email`、`phone`、`visit_date`、`purpose`、`status`、`created_at`。狀態按鈕沿用既有 `BookingStatusButtons`。

```tsx
<div className="flex flex-col gap-2.5 lg:hidden">
  {bookings.map((b) => (
    <div key={b.id} className="iv-card !p-3.5">
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium text-ink break-words">{b.name}</span>
        {/* 狀態 chip 沿用桌機表格 :68 的 `iv-chip bg-accent-soft text-accent` */}
        <span className="iv-chip shrink-0 bg-accent-soft text-accent">{b.status}</span>
      </div>
      <div className="mt-1.5 text-[13px] text-ink-soft break-words">
        {b.visit_date ?? "未指定日期"} · {b.purpose ?? "—"}
      </div>
      <div className="mt-1 text-[13px] text-ink-soft break-words">{b.phone ?? b.email}</div>
      <div className="mt-3 flex flex-wrap gap-2">
        <BookingStatusButtons bookingId={b.id} status={b.status} />
      </div>
    </div>
  ))}
</div>
```

**動手前先讀三個檔**，核對迴圈變數名、狀態 chip 的條件式樣式、空狀態文案、以及 `AdjustPointsForm` / `BookingStatusButtons` 的實際 props 簽名，照既有寫法傳值。

⚠️ 上面三段範本**都省略了空狀態**（Task 6、7 的範本有，這裡沒有，是範本疏漏不是刻意）。三個卡片清單都要比照 Task 6 補上 `{xxx.length === 0 && (...)}`，文案**沿用該頁桌機表格既有的空狀態文案**，不要自創。

- [ ] **Step 4: 驗證建置**

Run: `npm run lint --workspace web && npm run typecheck --workspace web && npm run build --workspace web 2>&1 | tail -3`
Expected: 全部通過。

- [ ] **Step 5: 三頁手機實測**

視窗寬 390px，逐一開 `/admin/products`、`/admin/members`、`/admin/bookings`，每頁執行：
```js
JSON.stringify({
  tableVisible: [...document.querySelectorAll('table')].some(t => t.offsetParent !== null),
  overflow: document.body.scrollWidth <= window.innerWidth,
})
```
Expected: 每頁皆 `tableVisible: false`、`overflow: true`。

- [ ] **Step 6: Commit**

```bash
git add web/src/app/admin/products/page.tsx web/src/app/admin/members/page.tsx web/src/app/admin/bookings/page.tsx
git commit -m "feat(admin): 商品/會員/預約清單在手機改為卡片式"
```

---

## Task 9: 整體驗收

**Files:** 無（僅驗證）

- [ ] **Step 1: 完整建置**

Run: `npm run lint --workspace web && npm run typecheck --workspace web && npm run typecheck --workspace api && npm run build --workspace web && npm run build:api`
Expected: 全部通過，無錯誤。

- [ ] **Step 2: 顧客端回歸（確認 route group 沒改壞任何網址）**

逐一開啟並確認頁面正常渲染、且有顧客端 Header/Footer：
`/`、`/gallery`、`/journeys`、`/rental`、`/membership`、`/booking`、`/cart`、`/checkout`、`/account`、`/login`、`/quote-info`、任一 `/products/<slug>`。

Expected: 全部 200 且外觀與改造前相同。

- [ ] **Step 3: 後台七頁兩種寬度**

以 admin 帳號登入，於 1280px 與 390px 各走一遍：`/admin`、`/admin/orders`、`/admin/quotes`、`/admin/products`、`/admin/members`、`/admin/bookings`、`/admin/settings`。

每頁確認：
- 沒有顧客端 Header/Footer/客服泡泡
- 桌機有側邊欄且 active 正確；手機有底部分頁列、「更多」面板可開可關
- `document.body.scrollWidth <= window.innerWidth`（無水平溢出）

- [ ] **Step 4: 守衛未壞**

登出後開 `/admin`。
Expected: 導向 `/login?redirect=/admin`。

以非管理員帳號登入後開 `/admin`。
Expected: 導向 `/`。

- [ ] **Step 5: 功能未壞（抽驗一筆）**

在手機寬度下，於 `/admin/orders` 對一筆測試訂單按狀態按鈕。
Expected: 狀態正確更新，與改造前行為一致。測試後把該筆測試資料清掉。

- [ ] **Step 6: Commit（若有修正）與收尾**

```bash
git add -A
git commit -m "chore(admin): 版面改造整體驗收修正"
```

若 Step 1–5 全數通過且無需修正，略過此 commit。
