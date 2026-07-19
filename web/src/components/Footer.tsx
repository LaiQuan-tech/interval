import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-line bg-card">
      <div className="iv-container flex flex-col gap-6 py-10 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-lg font-bold">interval</div>
          <p className="mt-1 text-sm text-ink-soft">賣到全世界 — 跨境電商</p>
        </div>
        <nav className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm text-ink-soft">
          <Link href="/products" className="hover:text-ink">商品</Link>
          <Link href="/quote-info" className="hover:text-ink">大量採購</Link>
          <Link href="/account" className="hover:text-ink">會員中心</Link>
          <Link href="/login" className="hover:text-ink">登入</Link>
        </nav>
      </div>
      <div className="border-t border-line/60 py-4 text-center text-xs text-ink-soft">
        © {new Date().getFullYear()} interval. All rights reserved.
      </div>
    </footer>
  );
}
