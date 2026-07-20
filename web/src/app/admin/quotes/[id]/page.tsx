import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveChatImageUrl } from "@/lib/chat-images";
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
  // 併發解析每則訊息的圖片簽名網址(新資料 imagePath / 舊資料 imageUrl 反推),
  // 避免逐則 await 在訊息多時拖慢頁面。簽名失敗回 null,渲染端要能容忍。
  const transcriptWithImages = await Promise.all(
    transcript.map(async (m) => ({
      ...m,
      resolvedUrl: m.imagePath || m.imageUrl ? await resolveChatImageUrl(m) : null,
    }))
  );

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

      {transcriptWithImages.length > 0 && (
        <section className="iv-card">
          <h3 className="mb-3 font-bold">AI 對話紀錄</h3>
          <div className="max-h-80 space-y-2 overflow-y-auto text-sm">
            {transcriptWithImages.map((m, i) => (
              <div
                key={i}
                className={`max-w-full break-words rounded-xl px-3 py-2 ${
                  m.role === "user" ? "bg-accent-soft" : "bg-paper"
                }`}
              >
                <span className="mr-2 text-xs font-semibold text-ink-soft">
                  {m.role === "user" ? "客戶" : "AI"}
                </span>
                {(m.imagePath || m.imageUrl) &&
                  (m.resolvedUrl ? (
                    <a
                      href={m.resolvedUrl}
                      target="_blank"
                      rel="noopener"
                      className="mb-2 block max-w-xs"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.resolvedUrl}
                        alt={
                          m.role === "user"
                            ? "客戶上傳的空間照片"
                            : "AI 擺放模擬圖"
                        }
                        className="w-full rounded-xl"
                      />
                    </a>
                  ) : (
                    <div className="mb-2 text-xs text-ink-soft">圖片已無法載入</div>
                  ))}
                <span className="whitespace-pre-wrap">{m.content}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
