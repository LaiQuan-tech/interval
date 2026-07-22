import Link from "next/link";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { localeHref } from "@/lib/i18n/href";

export default async function NotFound() {
  const locale = await getLocale();
  const messages = getMessages(locale);

  return (
    <div className="lm-container flex flex-col items-center gap-4 py-28 text-center">
      <p className="font-cormorant text-6xl text-gold">404</p>
      <h1 className="font-serif text-xl text-ink">{messages.notFound.title}</h1>
      <p className="text-sm text-ink-soft">{messages.notFound.desc}</p>
      <Link href={localeHref("/", locale)} className="iv-btn-primary mt-2">
        {messages.notFound.backHome}
      </Link>
    </div>
  );
}
