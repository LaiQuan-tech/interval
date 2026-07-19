import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatTWD, QUOTE_STATUS_LABEL } from "@/lib/format";
import type { Quote } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminQuotesPage() {
  const db = createAdminClient();
  const { data } = await db
    .from("quotes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);
  const quotes = (data ?? []) as Quote[];

  return (
    <div>
      <h2 className="mb-4 font-bold">報價管理</h2>
      <p className="mb-4 rounded-xl bg-accent-soft p-3 text-sm">
        AI 產生的報價會先變成「草稿」,審核內容後按「核准並寄出」才會通知客戶。
      </p>

      <div className="iv-table-wrap">
        <table className="w-full min-w-140 border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-soft">
              <th className="py-2.5 font-medium">報價單</th>
              <th className="py-2.5 font-medium">客戶</th>
              <th className="py-2.5 text-right font-medium">金額</th>
              <th className="py-2.5 text-right font-medium">狀態</th>
              <th className="py-2.5 text-right font-medium">日期</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.id} className="border-b border-line/60 hover:bg-card">
                <td className="py-3">
                  <Link href={`/admin/quotes/${q.id}`} className="font-medium hover:text-accent">
                    {q.quote_no}
                  </Link>
                  {q.created_by === "ai" && (
                    <span className="iv-chip ml-2 bg-warn-soft text-warn">AI</span>
                  )}
                </td>
                <td className="py-3">
                  {q.contact_name || "—"}
                  <span className="block text-xs text-ink-soft">{q.contact_email}</span>
                </td>
                <td className="py-3 text-right font-semibold">{formatTWD(q.total)}</td>
                <td className="py-3 text-right">
                  <span
                    className={`iv-chip ${
                      q.status === "draft"
                        ? "bg-warn-soft text-warn"
                        : q.status === "converted" || q.status === "accepted"
                          ? "bg-ok-soft text-ok"
                          : "bg-accent-soft text-accent"
                    }`}
                  >
                    {QUOTE_STATUS_LABEL[q.status] ?? q.status}
                  </span>
                </td>
                <td className="py-3 text-right text-ink-soft">{formatDate(q.created_at)}</td>
              </tr>
            ))}
            {quotes.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-ink-soft">
                  還沒有報價單。客戶跟 AI 客服詢價後會自動出現在這裡。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
