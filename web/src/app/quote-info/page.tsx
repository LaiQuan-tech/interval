import OpenChatButton from "@/components/OpenChatButton";

export const metadata = { title: "客製報價 / AI 顧問" };

const STEPS = [
  {
    title: "告訴 AI 顧問你的需求",
    desc: "打開右下角智慧客服，說明想客製的畫作、旅程規劃或企業空間方案。",
  },
  {
    title: "留下 Email",
    desc: "AI 會協助整理需求，只要留下 email，系統就會自動準備報價單。",
  },
  {
    title: "專人確認、報價寄出",
    desc: "我們的同事會確認品項與價格，報價單直接寄到你的信箱。",
  },
  {
    title: "一鍵接受、自動成單",
    desc: "在報價單頁面按「接受報價」，訂單自動成立，付款資訊同步寄出。",
  },
];

export default function QuoteInfoPage() {
  return (
    <div className="lm-container max-w-170 py-14 sm:py-20">
      <div className="text-center">
        <div className="lm-eyebrow text-[19px]">Bespoke Enquiry</div>
        <h1 className="mt-4 font-serif text-[27px] font-normal text-ink sm:text-[38px]">
          客製需求，交給 AI 顧問幫你準備報價
        </h1>
        <p className="mx-auto mt-5 max-w-130 text-[15px] leading-relaxed text-ink-soft">
          不用填表單、不用等回電。跟智慧客服聊聊你的需求，報價單自動準備好寄到信箱，
          按一下就能成立訂單。
        </p>
      </div>

      <ol className="mt-12 grid gap-4 sm:grid-cols-2">
        {STEPS.map((step, i) => (
          <li key={step.title} className="iv-card">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink-deep text-sm font-bold text-cream-text">
              {i + 1}
            </div>
            <h3 className="mt-3 font-serif text-ink">{step.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{step.desc}</p>
          </li>
        ))}
      </ol>

      <div className="mt-12 text-center">
        <OpenChatButton />
        <p className="mt-3 text-xs text-muted">
          報價由專人確認後寄出，AI 不會自行承諾價格。
        </p>
      </div>
    </div>
  );
}
