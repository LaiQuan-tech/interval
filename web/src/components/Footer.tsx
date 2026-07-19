import Link from "next/link";

export default function Footer() {
  return (
    <footer className="mt-16">
      <div className="lm-hairline" />
      <div className="lm-container grid grid-cols-2 gap-x-8 gap-y-10 py-16 sm:grid-cols-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:gap-10">
        <div className="col-span-2 sm:col-span-4 lg:col-span-1">
          <div className="font-serif text-2xl font-semibold tracking-[0.2em] text-ink-deep">
            小時光
          </div>
          <p className="mt-4 max-w-70 text-[13px] leading-[1.9] text-muted">
            線下書店門市 × 線上藝術與旅程。收藏一幅畫，啟程一段旅行。
          </p>
        </div>

        <div>
          <div className="lm-caption mb-4 text-[12px]">Explore</div>
          <div className="flex flex-col gap-3 text-[13.5px] text-ink-soft">
            <Link href="/gallery" className="hover:text-accent">藝術典藏</Link>
            <Link href="/journeys" className="hover:text-accent">私人旅程</Link>
            <Link href="/rental" className="hover:text-accent">租賃 · 買斷</Link>
          </div>
        </div>

        <div>
          <div className="lm-caption mb-4 text-[12px]">Member</div>
          <div className="flex flex-col gap-3 text-[13.5px] text-ink-soft">
            <Link href="/membership" className="hover:text-accent">會員沙龍</Link>
            <Link href="/booking" className="hover:text-accent">預約參訪</Link>
            <Link href="/membership" className="hover:text-accent">點數兌換</Link>
          </div>
        </div>

        <div>
          <div className="lm-caption mb-4 text-[12px]">Visit</div>
          <div className="text-[13.5px] leading-[1.9] text-ink-soft">
            台北市大安區
            <br />
            週二 – 週日 11:00–20:00
            <br />
            salon@littlemoments.tw
          </div>
        </div>
      </div>
      <div className="lm-container flex flex-col gap-3 pb-10 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <div className="lm-caption text-[12px]">© {new Date().getFullYear()} 小時光 · Little Moments</div>
        <div className="flex justify-center gap-6 text-[12.5px] text-muted-2 sm:justify-end">
          <Link href="#">隱私政策</Link>
          <Link href="#">服務條款</Link>
        </div>
      </div>
    </footer>
  );
}
