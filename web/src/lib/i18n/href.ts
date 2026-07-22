// Phase G:locale-aware 內部連結 helper。
//
// 背景:middleware 用 rewrite(不是 redirect)處理 /en 前綴,瀏覽器網址列與
// next/navigation 的 usePathname() 都會保留 /en;但頁面內部寫死的 <Link href="/gallery">
// 完全不知道目前在哪個語系,點下去就會掉回無前綴的中文路徑,html lang 也跟著被
// RootLayout 依新請求重算回 "zh"——這就是 Phase G 驗收抓到的「中途掉出英文語系」。
//
// 修法:顧客端所有內部連結一律透過這裡轉換,locale==="zh" 時原樣回傳(中文站零改動)。
import type { Locale } from "./config";

export function localeHref(href: string, locale: Locale): string {
  if (locale !== "en") return href;
  // 只處理站內相對路徑:以單一 "/" 開頭、非 "//"(protocol-relative 外部連結)。
  // "#..."、"mailto:..."、"http(s)://..." 都不會通過這個檢查,原樣不動。
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  // 已經帶 /en 前綴(理論上呼叫端不會這樣傳,但防呆避免疊加成 /en/en/...)。
  if (href === "/en" || href.startsWith("/en/")) return href;
  return href === "/" ? "/en" : `/en${href}`;
}

// 供 NavLinks/MobileNav 判斷「目前路徑是否 active」用:NAV_ITEMS.match() 全部寫死
// 不帶前綴的中文路徑(如 p.startsWith("/gallery")),但 usePathname() 在 /en 站下
// 回傳的是 "/en/gallery"——比對前先去掉前綴,否則 active 高亮在英文站永遠失效。
// 與 LocaleSwitcher.tsx 內部的 stripEnPrefix 是同一邏輯,但刻意不共用/不改動
// LocaleSwitcher(該元件已驗證穩定,不動它),這裡獨立一份給其餘元件用。
export function stripLocalePrefix(pathname: string): string {
  if (pathname === "/en") return "/";
  if (pathname.startsWith("/en/")) return pathname.slice(3);
  return pathname;
}
