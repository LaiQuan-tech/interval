"use client";

// 語言切換器(中/EN)。URL 前綴(/en)是語系真實來源,這裡只負責:
// 1. 依目前 pathname 算出「切到另一語言」的目標路徑(保留 query string)
// 2. 寫 NEXT_LOCALE cookie 記住偏好(目前 middleware 不讀這個 cookie,純記憶用途)
// 3. 導航到目標路徑
//
// 刻意不用 useSearchParams()(會讓整個 route 在靜態產生時被迫 de-opt 成 client
// render,需要額外包 Suspense boundary),改在 click 當下讀 window.location.search——
// 純事件處理內讀 window,不影響 SSR/hydration。
//
// 刻意用 window.location.href(整頁導航)而非 next/navigation 的 router.push:
// 實測 App Router 的 client-side soft navigation 不會重新執行 root layout,
// <html lang> 是 RootLayout(server component)依 getLocale() 算出的,soft nav
// 後會沿用舊的 <html> 輸出、lang 不會更新成 "en"。整頁導航保證 middleware 重跑、
// <html lang> 正確反映新語系,語言切換本來就是低頻操作,多一次整頁載入可接受。
import { usePathname } from "next/navigation";
import { useCallback } from "react";
import type { Locale } from "@/lib/i18n/config";

const LOCALE_COOKIE = "NEXT_LOCALE";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 一年

function stripEnPrefix(pathname: string): string {
  if (pathname === "/en") return "/";
  if (pathname.startsWith("/en/")) return pathname.slice(3);
  return pathname;
}

function toEnPrefix(basePath: string): string {
  return basePath === "/" ? "/en" : `/en${basePath}`;
}

export default function LocaleSwitcher({ className = "" }: { className?: string }) {
  const pathname = usePathname() ?? "/";

  const isEn = pathname === "/en" || pathname.startsWith("/en/");
  const basePath = stripEnPrefix(pathname);

  const switchTo = useCallback(
    (locale: Locale) => {
      const alreadyThere = (locale === "en") === isEn;
      if (alreadyThere) return;

      const search = typeof window !== "undefined" ? window.location.search : "";
      const target =
        locale === "en" ? `${toEnPrefix(basePath)}${search}` : `${basePath}${search}`;

      document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${COOKIE_MAX_AGE}`;
      window.location.href = target;
    },
    [isEn, basePath]
  );

  return (
    <div
      role="group"
      aria-label="切換語言 / Switch language"
      className={`flex items-center gap-1 font-cormorant text-sm tracking-[0.15em] text-ink-deep ${className}`}
    >
      <button
        type="button"
        aria-current={!isEn ? "true" : undefined}
        onClick={() => switchTo("zh")}
        className={`px-1 py-1 transition-colors ${
          !isEn ? "text-ink-deep" : "text-ink-deep/45 hover:text-ink-deep"
        }`}
      >
        中
      </button>
      <span className="text-ink-deep/30" aria-hidden="true">
        /
      </span>
      <button
        type="button"
        aria-current={isEn ? "true" : undefined}
        onClick={() => switchTo("en")}
        className={`px-1 py-1 transition-colors ${
          isEn ? "text-ink-deep" : "text-ink-deep/45 hover:text-ink-deep"
        }`}
      >
        EN
      </button>
    </div>
  );
}
