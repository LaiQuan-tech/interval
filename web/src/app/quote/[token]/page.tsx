import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { markQuoteViewed } from "@/lib/quote";
import { formatDate, formatTWD, QUOTE_STATUS_LABEL } from "@/lib/format";
import AcceptQuoteButton from "@/components/AcceptQuoteButton";
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

  return (
    <div className="iv-container max-w-2xl py-8 sm:py-12">
      <div className="iv-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-ink-soft">報價單編號</div>
            <h1 className="text-xl font-bold">{quote.quote_no}</h1>
          </div>
          <span className="iv-chip bg-accent-soft text-accent">
            {QUOTE_STATUS_LABEL[quote.status] ?? quote.status}
          </span>
        </div>

        <div className="mt-5 space-y-1.5 border-t border-line pt-5 text-sm">
          {quote.contact_name && (
            <p><span className="text-ink-soft">客戶:</span>{quote.contact_name}</p>
          )}
          <p><span className="text-ink-soft">報價日期:</span>{formatDate(quote.sent_at ?? quote.created_at)}</p>
          {quote.valid_until && (
            <p><span className="text-ink-soft">有效期限:</span>{formatDate(quote.valid_until)}</p>
          )}
        </div>

        <div className="mt-5 border-t border-line pt-5">
          <h2 className="mb-3 font-bold">報價明細</h2>
          <div className="iv-table-wrap">
            <table className="w-full min-w-105 border-collapse text-sm">
              <thead>
                <tr className="border-b border-line text-left text-ink-soft">
                  <th className="py-2 font-medium">項目</th>
                  <th className="py-2 text-right font-medium">單價</th>
                  <th className="py-2 text-right font-medium">數量</th>
                  <th className="py-2 text-right font-medium">金額</th>
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
                    <td className="py-2.5 text-right">{formatTWD(item.unit_price)}</td>
                    <td className="py-2.5 text-right">{item.quantity}</td>
                    <td className="py-2.5 text-right">
                      {formatTWD(item.unit_price * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-soft">小計</span>
              <span>{formatTWD(quote.subtotal)}</span>
            </div>
            {quote.tax > 0 && (
              <div className="flex justify-between">
                <span className="text-ink-soft">稅金</span>
                <span>{formatTWD(quote.tax)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 text-base font-bold">
              <span>合計</span>
              <span className="text-accent">{formatTWD(quote.total)}</span>
            </div>
          </div>
        </div>

        {canAccept && (
          <div className="mt-6 border-t border-line pt-6">
            <AcceptQuoteButton token={token} />
            <p className="mt-3 text-center text-xs text-ink-soft">
              按下「接受報價」即會自動成立訂單,並寄送付款資訊到您的信箱。
            </p>
          </div>
        )}

        {isConverted && (
          <div className="mt-6 rounded-xl bg-ok-soft p-4 text-center text-sm font-semibold text-ok">
            此報價已接受並成立訂單,請至信箱查看訂單資訊。
          </div>
        )}
        {quote.status === "expired" && (
          <div className="mt-6 rounded-xl bg-warn-soft p-4 text-center text-sm text-warn">
            此報價已過期,如仍有需求歡迎透過
            <Link href="/quote-info" className="underline">智慧客服</Link>
            重新詢價。
          </div>
        )}
      </div>
    </div>
  );
}
