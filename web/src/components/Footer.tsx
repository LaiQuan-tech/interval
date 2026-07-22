import Link from "next/link";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { localeHref } from "@/lib/i18n/href";

export default async function Footer() {
  const locale = await getLocale();
  const messages = getMessages(locale);

  return (
    <footer className="mt-16">
      <div className="lm-hairline" />
      <div className="lm-container grid grid-cols-2 gap-x-8 gap-y-10 py-16 sm:grid-cols-4 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:gap-10">
        <div className="col-span-2 sm:col-span-4 lg:col-span-1">
          <div className="font-serif text-2xl font-semibold tracking-[0.2em] text-ink-deep">
            {messages.footer.brand}
          </div>
          <p className="mt-4 max-w-70 text-[13px] leading-[1.9] text-muted">
            {messages.footer.tagline}
          </p>
        </div>

        <div>
          <div className="lm-caption mb-4 text-[12px]">Explore</div>
          <div className="flex flex-col gap-3 text-[13.5px] text-ink-soft">
            <Link href={localeHref("/gallery", locale)} className="hover:text-accent">{messages.nav.gallery}</Link>
            <Link href={localeHref("/journeys", locale)} className="hover:text-accent">{messages.nav.journeys}</Link>
            <Link href={localeHref("/rental", locale)} className="hover:text-accent">{messages.nav.rental}</Link>
          </div>
        </div>

        <div>
          <div className="lm-caption mb-4 text-[12px]">Member</div>
          <div className="flex flex-col gap-3 text-[13.5px] text-ink-soft">
            <Link href={localeHref("/membership", locale)} className="hover:text-accent">{messages.nav.membership}</Link>
            <Link href={localeHref("/booking", locale)} className="hover:text-accent">{messages.nav.booking}</Link>
            <Link href={localeHref("/membership", locale)} className="hover:text-accent">{messages.footer.pointsRedeem}</Link>
          </div>
        </div>

        <div>
          <div className="lm-caption mb-4 text-[12px]">Visit</div>
          <div className="text-[13.5px] leading-[1.9] text-ink-soft">
            {messages.footer.addressLine1}
            <br />
            {messages.footer.hours}
            <br />
            {messages.footer.email}
          </div>
        </div>
      </div>
      <div className="lm-container flex flex-col gap-3 pb-10 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <div className="lm-caption text-[12px]">© {new Date().getFullYear()} {messages.footer.copyright}</div>
        <div className="flex justify-center gap-6 text-[12.5px] text-muted-2 sm:justify-end">
          <Link href="#">{messages.footer.privacyPolicy}</Link>
          <Link href="#">{messages.footer.terms}</Link>
        </div>
      </div>
    </footer>
  );
}
