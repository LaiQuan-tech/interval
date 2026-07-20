import { redirect } from "next/navigation";

// 舊路由:一律導向新的藝術典藏頁
export default function ProductsPage() {
  redirect("/gallery");
}
