import { notFound } from "next/navigation";

// 顧客端 catch-all:接住所有不屬於任何既有路由的網址,讓它們也套用
// (storefront) group layout(Header/Footer/購物車/AI 客服),而不是落到
// 根層 app/not-found.tsx 變成裸頁。靜態與動態路由優先序高於 catch-all,
// 不會影響既有頁面、/admin、/api。
export default function StorefrontCatchAll() {
  notFound();
}
