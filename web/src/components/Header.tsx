import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CartLink from "@/components/CartLink";
import MobileNav from "@/components/MobileNav";

export default async function Header() {
  let user = null;
  let isAdmin = false;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      isAdmin = profile?.role === "admin";
    }
  } catch {
    // env 未設定時仍可渲染
  }

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur">
      <div className="iv-container flex h-14 items-center justify-between gap-4 sm:h-16">
        <Link href="/" className="text-lg font-bold tracking-wide">
          interval
          <span className="ml-2 hidden text-xs font-normal text-ink-soft sm:inline">
            賣到全世界
          </span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium md:flex">
          <Link href="/products" className="hover:text-accent">
            商品
          </Link>
          <Link href="/quote-info" className="hover:text-accent">
            大量採購
          </Link>
          {isAdmin && (
            <Link href="/admin" className="text-accent hover:text-accent-dark">
              後台管理
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          <CartLink />
          {user ? (
            <Link href="/account" className="iv-btn-ghost hidden !min-h-9 !px-4 !py-1.5 md:inline-flex">
              會員中心
            </Link>
          ) : (
            <Link href="/login" className="iv-btn-primary hidden !min-h-9 !px-4 !py-1.5 md:inline-flex">
              登入
            </Link>
          )}
          <MobileNav loggedIn={Boolean(user)} isAdmin={isAdmin} />
        </div>
      </div>
    </header>
  );
}
