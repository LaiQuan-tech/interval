import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CartLink from "@/components/CartLink";
import MobileNav from "@/components/MobileNav";
import NavLinks from "@/components/NavLinks";

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
    <header className="sticky top-0 z-40 bg-paper/94 backdrop-blur-sm">
      <div className="lm-container flex h-auto items-center justify-between gap-6 py-5">
        <Link
          href="/"
          className="shrink-0 font-serif text-[22px] font-semibold tracking-[0.2em] text-ink-deep sm:text-[25px]"
        >
          好日子
        </Link>

        <nav className="hidden items-center gap-8 text-sm tracking-[0.08em] lg:flex">
          <NavLinks />
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <CartLink />
          <Link
            href="/booking"
            className="hidden whitespace-nowrap border border-ink-deep px-5 py-2 font-cormorant text-sm tracking-[0.2em] text-ink-deep lg:inline-flex"
          >
            預約參訪
          </Link>
          {user ? (
            <Link
              href="/account"
              className="iv-btn-ghost hidden !min-h-9 !px-4 !py-1.5 lg:inline-flex"
            >
              會員中心
            </Link>
          ) : (
            <Link
              href="/login"
              className="iv-btn-primary hidden !min-h-9 !px-4 !py-1.5 lg:inline-flex"
            >
              登入
            </Link>
          )}
          <MobileNav loggedIn={Boolean(user)} isAdmin={isAdmin} />
        </div>
      </div>
      <div className="lm-hairline" />
    </header>
  );
}
