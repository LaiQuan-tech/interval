import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime, QUOTE_STATUS_LABEL } from "@/lib/format";
import QuoteEditor from "@/components/admin/QuoteEditor";
import type { ChatMessage, Quote } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminQuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();

  const { data: quote } = await db.from("quotes").select("*").eq("id", id).maybeSingle();
  if (!quote) notFound();
  const typedQuote = quote as Quote;

  // 附上對話紀錄供審核參考
  let transcript: ChatMessage[] = [];
  if (typedQuote.session_id) {
    const { data: log } = await db
      .from("ai_chat_logs")
      .select("messages")
      .eq("session_id", typedQuote.session_id)
      .maybeSingle();
    transcript = (log?.messages ?? []) as ChatMessage[];
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold">
          報價單 {typedQuote.quote_no}
          <span className="iv-chip ml-3 bg-accent-soft text-accent">
            {QUOTE_STATUS_LABEL[typedQuote.status] ?? typedQuote.status}
          </span>
        </h2>
        {typedQuote.status !== "draft" && (
          <Link
            href={`/quote/${typedQuote.public_token}`}
            target="_blank"
            className="text-sm text-accent"
          >
            客戶頁面 ↗
          </Link>
        )}
      </div>

      <div className="text-xs text-ink-soft">
        建立於 {formatDateTime(typedQuote.created_at)}
        {typedQuote.sent_at && ` · 寄出於 ${formatDateTime(typedQuote.sent_at)}`}
        {typedQuote.accepted_at && ` · 接受於 ${formatDateTime(typedQuote.accepted_at)}`}
      </div>

      <QuoteEditor quote={typedQuote} />

      {transcript.length > 0 && (
        <section className="iv-card">
          <h3 className="mb-3 font-bold">AI 對話紀錄</h3>
          <div className="max-h-80 space-y-2 overflow-y-auto text-sm">
            {transcript.map((m, i) => (
              <div
                key={i}
                className={`rounded-xl px-3 py-2 ${
                  m.role === "user" ? "bg-accent-soft" : "bg-paper"
                }`}
              >
                <span className="mr-2 text-xs font-semibold text-ink-soft">
                  {m.role === "user" ? "客戶" : "AI"}
                </span>
                <span className="whitespace-pre-wrap">{m.content}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
