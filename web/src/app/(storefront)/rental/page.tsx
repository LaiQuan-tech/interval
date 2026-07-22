import Link from "next/link";
import { getLocale } from "@/lib/i18n/server";
import { localeHref } from "@/lib/i18n/href";

export const metadata = { title: "租賃 · 買斷" };

const PLANS = [
  {
    key: "rental",
    eyebrow: "Rental",
    title: "月租方案",
    price: "NT$580",
    priceNote: "起 / 月",
    perks: ["每季可更換一次畫作", "含裝裱、運送與到府安裝", "專人保養與保險", "隨時可升級買斷"],
    dark: false,
    tag: null,
  },
  {
    key: "rent-to-own",
    eyebrow: "Rent to Own",
    title: "先租後買",
    price: "NT$780",
    priceNote: "起 / 月",
    perks: ["月租金 100% 折抵買斷價", "12 個月內完成買斷免手續費", "含裝裱、運送與到府安裝", "會員再享點數回饋"],
    dark: true,
    tag: "最受歡迎",
  },
  {
    key: "purchase",
    eyebrow: "Purchase",
    title: "直接買斷",
    price: "NT$9,600",
    priceNote: "起",
    perks: ["永久擁有，附收藏證書", "含裝裱、運送與到府安裝", "會員折扣最高 15%", "可預約更換裝裱樣式"],
    dark: false,
    tag: null,
  },
];

export default async function RentalPage() {
  // 這頁文案本身尚未 i18n(既有狀態,Phase G 範圍外——見交接說明);這裡只補上
  // /booking 連結的 locale 前綴,避免英文站點進來後掉回無前綴路徑、語系被重置成中文。
  const locale = await getLocale();
  return (
    <div>
      <div className="lm-container pt-16 pb-8 text-center sm:pt-20">
        <div className="lm-eyebrow text-[20px]">Rent, or make it yours</div>
        <h1 className="mt-3.5 mb-4 font-serif text-[27px] font-normal tracking-[0.04em] text-ink sm:text-[52px]">
          租賃 · 買斷
        </h1>
        <p className="mx-auto max-w-140 text-[15.5px] leading-[2] text-ink-soft">
          用彈性的方式收藏藝術。先以月租體驗，隨時可升級為買斷；已付租金按比例折抵。
        </p>
      </div>

      <div className="lm-container-narrow grid grid-cols-1 gap-7 py-6 sm:py-10 md:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.key}
            className={`relative p-8.5 sm:p-11 ${
              plan.dark
                ? "border border-gold bg-ink-deep text-panel"
                : "border border-line bg-card"
            }`}
          >
            {plan.tag && (
              <div className="absolute -top-3 left-8.5 bg-gold px-3 py-1 text-[11px] tracking-[0.14em] text-ink">
                {plan.tag}
              </div>
            )}
            <div className={`font-cormorant text-[13px] tracking-[0.2em] uppercase ${plan.dark ? "text-gold-bright" : "text-accent"}`}>
              {plan.eyebrow}
            </div>
            <h3 className={`mt-4 mb-1.5 font-serif text-[26px] font-medium ${plan.dark ? "text-panel" : "text-ink"}`}>
              {plan.title}
            </h3>
            <div className={`font-serif text-[34px] ${plan.dark ? "text-panel" : "text-ink"}`}>
              {plan.price}
              <span className={`text-[15px] ${plan.dark ? "text-cream-soft" : "text-muted-2"}`}> {plan.priceNote}</span>
            </div>
            <div className={`my-6 h-px ${plan.dark ? "bg-[#5a4a34]" : "lm-hairline"}`} />
            <div className={`flex flex-col gap-3.5 text-[14px] leading-[1.6] ${plan.dark ? "text-cream-soft-2" : "text-ink-soft"}`}>
              {plan.perks.map((perk) => (
                <div key={perk}>· {perk}</div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="lm-container py-12 sm:py-24">
        <div className="flex flex-col items-start gap-8 bg-panel p-8.5 sm:flex-row sm:items-center sm:justify-between sm:p-14">
          <div>
            <h3 className="mb-3 font-serif text-[24px] font-normal text-ink sm:text-[28px]">
              不確定哪一幅適合您的空間？
            </h3>
            <p className="max-w-130 text-[14.5px] leading-[1.9] text-ink-soft">
              預約到府顧問服務，我們帶著樣品與色卡到府，為您的牆面挑選最合適的作品與裝裱。
            </p>
          </div>
          <Link href={localeHref("/booking", locale)} className="iv-btn-primary whitespace-nowrap">
            預約到府顧問
          </Link>
        </div>
      </div>
    </div>
  );
}
