import Link from "next/link";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { localeHref } from "@/lib/i18n/href";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const messages = getMessages(await getLocale());
  return { title: messages.rental.metaTitle };
}

export default async function RentalPage() {
  const locale = await getLocale();
  const messages = getMessages(locale);
  const PLANS = [
    {
      key: "rental",
      eyebrow: "Rental",
      price: "NT$580",
      dark: false,
      title: messages.rental.plans.rental.title,
      priceNote: messages.rental.plans.rental.priceNote,
      perks: messages.rental.plans.rental.perks,
      tag: null as string | null,
    },
    {
      key: "rent-to-own",
      eyebrow: "Rent to Own",
      price: "NT$780",
      dark: true,
      title: messages.rental.plans.rentToOwn.title,
      priceNote: messages.rental.plans.rentToOwn.priceNote,
      perks: messages.rental.plans.rentToOwn.perks,
      tag: messages.rental.plans.rentToOwn.tag as string | null,
    },
    {
      key: "purchase",
      eyebrow: "Purchase",
      price: "NT$9,600",
      dark: false,
      title: messages.rental.plans.purchase.title,
      priceNote: messages.rental.plans.purchase.priceNote,
      perks: messages.rental.plans.purchase.perks,
      tag: null as string | null,
    },
  ];
  return (
    <div>
      <div className="lm-container pt-16 pb-8 text-center sm:pt-20">
        <div className="lm-eyebrow text-[20px]">{messages.rental.heroEyebrow}</div>
        <h1 className="mt-3.5 mb-4 font-serif text-[27px] font-normal tracking-[0.04em] text-ink sm:text-[52px]">
          {messages.rental.title}
        </h1>
        <p className="mx-auto max-w-140 text-[15.5px] leading-[2] text-ink-soft">
          {messages.rental.desc}
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
              {messages.rental.consultTitle}
            </h3>
            <p className="max-w-130 text-[14.5px] leading-[1.9] text-ink-soft">
              {messages.rental.consultDesc}
            </p>
          </div>
          <Link href={localeHref("/booking", locale)} className="iv-btn-primary whitespace-nowrap">
            {messages.rental.consultCta}
          </Link>
        </div>
      </div>
    </div>
  );
}
