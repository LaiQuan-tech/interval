"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { ChatMessage } from "@/lib/types";

const SUGGESTIONS = [
  "有哪些作品可以租賃或買斷?",
  "私人旅程怎麼規劃?",
  "會員點數怎麼累積?",
];

export default function ChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "您好，我是小時光的智慧客服顧問！想了解藝術典藏、租賃買斷、私人旅程或會員制度，都可以直接問我。",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const sessionIdRef = useRef<string>("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sessionIdRef.current) {
      sessionIdRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  // 後台不顯示
  if (pathname?.startsWith("/admin")) return null;

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next.slice(-12),
          sessionId: sessionIdRef.current,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`chat failed: ${res.status}`);
      }

      // 讀取 SSE:data: {"type":"text","text":...} / {"type":"done"}
      setMessages((m) => [...m, { role: "assistant", content: "" }]);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === "text" && evt.text) {
              setMessages((m) => {
                const copy = [...m];
                const last = copy[copy.length - 1];
                copy[copy.length - 1] = {
                  ...last,
                  content: last.content + evt.text,
                };
                return copy;
              });
            }
          } catch {
            // 忽略不完整的 chunk
          }
        }
      }
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "抱歉，系統忙碌中，請稍後再試，或直接到藝術典藏頁逛逛！",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* FAB */}
      <button
        aria-label={open ? "關閉客服" : "開啟智慧客服"}
        onClick={() => setOpen(!open)}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-ink-deep text-cream-text shadow-lg shadow-ink-deep/30 transition-transform hover:scale-105"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <line x1="5" y1="5" x2="19" y2="19" />
            <line x1="19" y1="5" x2="5" y2="19" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z" />
          </svg>
        )}
      </button>

      {/* 對話面板:手機貼齊左右、桌機固定寬 */}
      {open && (
        <div className="fixed inset-x-3 bottom-22 z-50 flex max-h-[72dvh] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-2xl sm:inset-x-auto sm:right-5 sm:w-95">
          <div className="flex items-center gap-3 bg-ink-deep px-4 py-3 text-cream-text">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gold text-sm font-bold text-ink-deep">
              小
            </div>
            <div>
              <div className="text-sm font-semibold">小時光智慧客服</div>
              <div className="text-xs text-cream-soft">AI 顧問 · 自動報價</div>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "ml-auto bg-ink-deep text-cream-text"
                    : "bg-panel text-ink"
                }`}
              >
                {m.content || "…"}
              </div>
            ))}
            {loading && messages[messages.length - 1]?.role === "user" && (
              <div className="max-w-[85%] rounded-2xl bg-panel px-3.5 py-2.5 text-sm text-ink-soft">
                正在輸入…
              </div>
            )}
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-line bg-card px-3 py-1.5 text-xs text-ink-soft hover:border-gold hover:text-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-line p-3"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="輸入訊息…"
              className="min-h-11 flex-1 rounded-full border border-line bg-paper px-4 text-sm outline-none focus:border-gold"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="送出"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink-deep text-cream-text disabled:opacity-40"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2 11 13" />
                <path d="M22 2 15 22l-4-9-9-4z" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
