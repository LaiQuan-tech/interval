import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { markQuoteViewed } from "@/lib/quote";
import { formatDate, formatTWD, getQuoteStatusLabel } from "@/lib/format";
import AcceptQuoteButton from "@/components/AcceptQuoteButton";
import { getLocale, getMessages } from "@/lib/i18n/server";
import { localeHref } from "@/lib/i18n/href";
import type { Quote } from "@/lib/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function QuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  let quote: Quote | null = null;
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("quotes")
      .select("*")
      .eq("public_token", token)
      .maybeSingle();
    quote = data as Quote | null;
    // 草稿不公開
    if (quote?.status === "draft") quote = null;
    if (quote?.status === "sent") {
      await markQuoteViewed(token);
      quote.status = "viewed";
    }
  } catch {
    /* env 未設定 */
  }

  if (!quote) notFound();

  const canAccept = ["sent", "viewed"].includes(quote.status);
  const isConverted = quote.status === "converted" || quote.status === "accepted";
  const locale = await getLocale();
  const messages = getMessages(locale);
  const t = messages.quote;

  return (
    <div className="lm-container max-w-135 py-10 sm:py-16">
      <div className="iv-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-ink-soft">{t.quoteNoLabel}</div>
            <h1 className="font-serif text-xl text-ink">{quote.quote_no}</h1>
          </div>
          <span className="iv-chip bg-panel text-accent">
            {getQuoteStatusLabel(quote.status, locale)}
          </span>
        </div>

        <div className="mt-5 space-y-1.5 border-t border-line pt-5 text-sm">
          {quote.contact_name && (
            <p><span className="text-ink-soft">{t.customerLabel}</span>{quote.contact_name}</p>
          )}
          <p><span className="text-ink-soft">{t.dateLabel}</span>{formatDate(quote.sent_at ?? quote.created_at, locale)}</p>
          {quote.valid_until && (
            <p><span className="text-ink-soft">{t.validUntilLabel}</span>{formatDate(quote.valid_until, locale)}</p>
          )}
        </div>

        <div className="mt-5 border-t border-line pt-5">
          <h2 className="mb-3 font-serif text-ink">{t.detailsTitle}</h2>
          <div className="iv-table-wrap">
            <table className="w-full min-w-105 border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-ink-soft">
                  <th className="py-2 font-medium">{t.itemColumn}</th>
                  <th className="py-2 text-right font-medium">{t.unitPriceColumn}</th>
                  <th className="py-2 text-right font-medium">{t.qtyColumn}</th>
                  <th className="py-2 text-right font-medium">{t.amountColumn}</th>
                </tr>
              </thead>
              <tbody>
                {quote.line_items.map((item, i) => (
                  <tr key={i} className="border-b border-line/60">
                    <td className="py-2.5">
                      {item.name}
                      {item.note && (
                        <span className="block text-xs text-ink-soft">{item.note}</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right">{formatTWD(item.unit_price, locale)}</td>
                    <td className="py-2.5 text-right">{item.quantity}</td>
                    <td className="py-2.5 text-right">
                      {formatTWD(item.unit_price * item.quantity, locale)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-soft">{t.subtotal}</span>
              <span>{formatTWD(quote.subtotal, locale)}</span>
            </div>
            {quote.tax > 0 && (
              <div className="flex justify-between">
                <span className="text-ink-soft">{t.tax}</span>
                <span>{formatTWD(quote.tax, locale)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 text-base font-medium">
              <span>{t.total}</span>
              <span className="font-serif text-[18px] text-ink">{formatTWD(quote.total, locale)}</span>
            </div>
          </div>
        </div>

        {canAccept && (
          <div className="mt-6 border-t border-line pt-6">
            <AcceptQuoteButton token={token} />
            <p className="mt-3 text-center text-xs text-ink-soft">
              {t.acceptNote}
            </p>
          </div>
        )}

        {isConverted && (
          <div className="mt-6 border border-gold bg-panel p-4 text-center text-sm font-medium text-ink">
            {t.convertedNotice}
          </div>
        )}
        {quote.status === "expired" && (
          <div className="mt-6 border border-line bg-warn-soft p-4 text-center text-sm text-warn">
            {t.expiredPrefix}
            <Link href={localeHref("/quote-info", locale)} className="underline">{t.expiredLinkLabel}</Link>
            {t.expiredSuffix}
          </div>
        )}
      </div>
    </div>
  );
}
