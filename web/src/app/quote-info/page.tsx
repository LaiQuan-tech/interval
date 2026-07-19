import OpenChatButton from "@/components/OpenChatButton";

export const metadata = { title: "大量採購 / AI 報價" };

const STEPS = [
  {
    title: "告訴 AI 你的需求",
    desc: "打開右下角智慧客服,說明想採購的商品、數量與用途。",
  },
  {
    title: "留下 Email",
    desc: "AI 會協助整理需求,只要留下 email,系統就會自動準備報價單。",
  },
  {
    title: "專人確認、報價寄出",
    desc: "我們的同事會確認品項與價格,報價單直接寄到你的信箱。",
  },
  {
    title: "一鍵接受、自動成單",
    desc: "在報價單頁面按「接受報價」,訂單自動成立,付款資訊同步寄出。",
  },
];

export default function QuoteInfoPage() {
  return (
    <div className="iv-container max-w-3xl py-10 sm:py-16">
      <div className="text-center">
        <p className="mx-auto w-fit rounded-full bg-accent-soft px-4 py-1.5 text-sm font-semibold text-accent">
          AI 自動報價
        </p>
        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">
          大量採購,交給 AI 幫你報價
        </h1>
        <p className="mx-auto mt-4 max-w-xl leading-relaxed text-ink-soft">
          不用填表單、不用等回電。跟智慧客服聊聊你的需求,報價單自動準備好寄到信箱,
          按一下就能成立訂單。
        </p>
      </div>

      <ol className="mt-10 grid gap-4 sm:grid-cols-2">
        {STEPS.map((step, i) => (
          <li key={step.title} className="iv-card">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">
              {i + 1}
            </div>
            <h3 className="mt-3 font-bold">{step.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{step.desc}</p>
          </li>
        ))}
      </ol>

      <div className="mt-10 text-center">
        <OpenChatButton />
        <p className="mt-3 text-xs text-ink-soft">
          報價由專人確認後寄出,AI 不會自行承諾價格。
        </p>
      </div>
    </div>
  );
}
