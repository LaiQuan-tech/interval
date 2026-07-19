import Link from "next/link";

export default function NotFound() {
  return (
    <div className="iv-container flex flex-col items-center gap-4 py-24 text-center">
      <p className="text-5xl font-bold text-line">404</p>
      <h1 className="text-xl font-bold">找不到這個頁面</h1>
      <p className="text-sm text-ink-soft">連結可能已失效或內容已移除。</p>
      <Link href="/" className="iv-btn-primary mt-2">
        回到首頁
      </Link>
    </div>
  );
}
