import type { Metadata } from "next";
import OpenChatButton from "@/components/OpenChatButton";
import { getLocale, getMessages } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const messages = getMessages(await getLocale());
  return { title: messages.quoteInfo.metaTitle };
}

export default async function QuoteInfoPage() {
  const messages = getMessages(await getLocale());
  const steps = messages.quoteInfo.steps;

  return (
    <div className="lm-container max-w-170 py-14 sm:py-20">
      <div className="text-center">
        <div className="lm-eyebrow text-[19px]">{messages.quoteInfo.eyebrow}</div>
        <h1 className="mt-4 font-serif text-[27px] font-normal text-ink sm:text-[38px]">
          {messages.quoteInfo.title}
        </h1>
        <p className="mx-auto mt-5 max-w-130 text-[15px] leading-relaxed text-ink-soft">
          {messages.quoteInfo.desc}
        </p>
      </div>

      <ol className="mt-12 grid gap-4 sm:grid-cols-2">
        {steps.map((step, i) => (
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
          {messages.quoteInfo.footerNote}
        </p>
      </div>
    </div>
  );
}
