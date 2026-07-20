"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import type { ChatMessage } from "@/lib/types";
import { resizeToJpeg, type PendingImage } from "@/lib/image";

const SUGGESTIONS = [
  "有哪些作品可以租賃或買斷?",
  "私人旅程怎麼規劃?",
  "會員點數怎麼累積?",
];

// widget 內部訊息:在 ChatMessage 之上加 UI 專用欄位(不回傳給後端)
type WidgetMessage = ChatMessage & {
  kind?: "quote-card"; // 報價單準備中的系統樣式卡
  artworkName?: string; // 模擬圖訊息對應的作品名(供歷史純文字表徵)
};

type ArtworkOption = { slug: string; name: string; image: string | null };

// 送後端的歷史:圖片訊息換成純文字表徵(Gemini 只吃文字歷史),但保留 imageUrl/imagePath 供後台紀錄
// 注意:/api/chat 已改為伺服器權威 append,DB 寫入不再依賴這份歷史——這裡保留欄位只是型別一致。
function toApiHistory(messages: WidgetMessage[]): ChatMessage[] {
  return messages
    .filter((m) => m.kind !== "quote-card")
    .map((m) => {
      if (!m.imageUrl && !m.imagePath) return { role: m.role, content: m.content };
      const content =
        m.role === "user"
          ? "(上傳了空間照片)"
          : `(已提供擺放模擬圖${m.artworkName ? `:${m.artworkName}` : ""})${
              m.content ? ` ${m.content}` : ""
            }`;
      return { role: m.role, content, imageUrl: m.imageUrl, imagePath: m.imagePath };
    });
}

export default function ChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<WidgetMessage[]>([
    {
      role: "assistant",
      content:
        "您好，我是小時光的智慧客服顧問！想了解藝術典藏、租賃買斷、私人旅程或會員制度，都可以直接問我。看到喜歡的作品，也可以點下方 📷 上傳您家的照片，我來為您生成掛在您空間中的模擬圖。",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [artworks, setArtworks] = useState<ArtworkOption[]>([]);
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [selectedSlug, setSelectedSlug] = useState("");
  const [mockupLoading, setMockupLoading] = useState(false);
  const [mockupError, setMockupError] = useState("");
  const sessionIdRef = useRef<string>("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  }, [messages, open, pendingImage]);

  // 開啟面板時預抓作品清單(選畫器用)
  useEffect(() => {
    if (!open || artworks.length > 0) return;
    fetch("/api/artworks")
      .then((r) => r.json())
      .then((d) => setArtworks(Array.isArray(d.artworks) ? d.artworks : []))
      .catch(() => {});
  }, [open, artworks.length]);

  // 後台不顯示
  if (pathname?.startsWith("/admin")) return null;

  async function send(text: string) {
    const content = text.trim();
    if (!content || loading) return;
    const next: WidgetMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: toApiHistory(next).slice(-12),
          sessionId: sessionIdRef.current,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`chat failed: ${res.status}`);
      }

      // 讀取 SSE:data: {"type":"text","text":...} / {"type":"done","quotePending":...}
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
            } else if (evt.type === "done" && evt.quotePending) {
              setMessages((m) => [
                ...m,
                {
                  role: "assistant",
                  kind: "quote-card",
                  content: "專屬報價單準備中，確認後將寄至您的信箱 ✓",
                },
              ]);
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

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // 允許重選同一張
    if (!file || mockupLoading) return;
    setMockupError("");
    try {
      const resized = await resizeToJpeg(file);
      setPendingImage(resized);

      // 選畫器清單(若預抓失敗這裡補抓)
      let list = artworks;
      if (list.length === 0) {
        try {
          const d = await fetch("/api/artworks").then((r) => r.json());
          list = Array.isArray(d.artworks) ? d.artworks : [];
          setArtworks(list);
        } catch {
          /* 選畫器顯示為空,仍可取消重試 */
        }
      }

      // 對話中最近提到的作品優先預選
      let preselect = "";
      for (let i = messages.length - 1; i >= 0 && !preselect; i--) {
        const hit = list.find((a) => messages[i].content.includes(a.name));
        if (hit) preselect = hit.slug;
      }
      setSelectedSlug(preselect || list[0]?.slug || "");
    } catch {
      setMockupError("這張圖片無法讀取，請換一張再試。");
    }
  }

  async function generateMockup() {
    if (!pendingImage || !selectedSlug || mockupLoading) return;
    setMockupLoading(true);
    setMockupError("");
    const artworkName =
      artworks.find((a) => a.slug === selectedSlug)?.name ?? "";

    try {
      const res = await fetch("/api/chat/mockup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdRef.current,
          artworkSlug: selectedSlug,
          image: { mime: pendingImage.mime, base64: pendingImage.base64 },
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || "生成失敗");
      }

      setMessages((m) => [
        ...m,
        { role: "user", content: "(上傳了空間照片)", imageUrl: data.roomUrl },
        {
          role: "assistant",
          content: data.followupText ?? "",
          imageUrl: data.mockupUrl,
          artworkName,
        },
      ]);
      setPendingImage(null);
      setSelectedSlug("");
    } catch (err) {
      setMockupError(
        err instanceof Error && err.message !== "生成失敗"
          ? err.message
          : "模擬圖生成失敗，可能是網路忙碌，請再試一次。"
      );
    } finally {
      setMockupLoading(false);
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
              <div className="text-xs text-cream-soft">AI 顧問 · 擺放模擬 · 自動報價</div>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) =>
              m.kind === "quote-card" ? (
                <div
                  key={i}
                  className="mx-auto max-w-[92%] rounded-[2px] border border-gold/60 bg-accent-soft px-4 py-3 text-center text-xs tracking-wide text-accent"
                >
                  {m.content}
                </div>
              ) : (
                <div
                  key={i}
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "ml-auto bg-ink-deep text-cream-text"
                      : "bg-panel text-ink"
                  }`}
                >
                  {m.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.imageUrl}
                      alt={m.role === "user" ? "上傳的空間照片" : "擺放模擬圖"}
                      className="mb-2 w-full cursor-zoom-in rounded-xl"
                      onClick={() => window.open(m.imageUrl, "_blank", "noopener")}
                    />
                  )}
                  {m.content || (m.imageUrl ? null : "…")}
                </div>
              )
            )}
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

          {/* 擺放模擬:照片預覽 + 選畫器 */}
          {pendingImage && (
            <div className="space-y-2.5 border-t border-line bg-panel p-3">
              {mockupLoading ? (
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={pendingImage.dataUrl}
                    alt="空間照片預覽"
                    className="h-14 w-14 shrink-0 rounded-[2px] object-cover opacity-70"
                  />
                  <div className="flex-1 text-xs text-ink-soft">
                    <div className="animate-pulse font-medium text-accent">
                      正在為您把作品掛上牆…
                    </div>
                    <div className="mt-1">約需 15–30 秒，請稍候片刻。</div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={pendingImage.dataUrl}
                      alt="空間照片預覽"
                      className="h-14 w-14 shrink-0 rounded-[2px] object-cover"
                    />
                    <div className="flex-1 pt-0.5 text-xs text-ink-soft">
                      選擇想掛上牆的作品，我來為您生成擺放模擬圖。
                    </div>
                    <button
                      aria-label="取消上傳"
                      onClick={() => {
                        setPendingImage(null);
                        setSelectedSlug("");
                        setMockupError("");
                      }}
                      className="shrink-0 px-1 text-lg leading-none text-muted hover:text-ink"
                    >
                      ×
                    </button>
                  </div>
                  {artworks.length > 0 && (
                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                      {artworks.map((a) => (
                        <button
                          key={a.slug}
                          onClick={() => setSelectedSlug(a.slug)}
                          className={`flex shrink-0 items-center gap-1.5 rounded-[2px] border px-2 py-1.5 text-xs transition-colors ${
                            selectedSlug === a.slug
                              ? "border-ink-deep bg-ink-deep text-cream-text"
                              : "border-line-2 bg-card text-ink-soft hover:border-gold hover:text-accent"
                          }`}
                        >
                          {a.image && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={a.image}
                              alt=""
                              className="h-6 w-6 rounded-[2px] object-cover"
                            />
                          )}
                          <span className="whitespace-nowrap">{a.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {mockupError && (
                    <p className="text-xs text-danger">{mockupError}</p>
                  )}
                  <button
                    onClick={generateMockup}
                    disabled={!selectedSlug}
                    className="iv-btn-primary w-full text-xs"
                  >
                    生成擺放模擬
                  </button>
                </>
              )}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 border-t border-line p-3"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              aria-label="上傳空間照片生成擺放模擬"
              title="上傳您家的照片，生成作品擺放模擬圖"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || mockupLoading}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line-2 bg-card text-lg transition-colors hover:border-gold disabled:opacity-40"
            >
              📷
            </button>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="輸入訊息…"
              className="min-h-11 min-w-0 flex-1 rounded-full border border-line bg-paper px-4 text-sm outline-none focus:border-gold"
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
