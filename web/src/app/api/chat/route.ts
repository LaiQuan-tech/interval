import { NextRequest } from "next/server";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  buildSalesSystem,
  classifyQuoteReady,
  fallbackReply,
  hasGeminiKey,
  hasQuoteIntent,
  streamChatReply,
} from "@/lib/ai";
import { getCompanyProfile, getRateCard } from "@/lib/settings";
import { createQuoteDraftFromSession } from "@/lib/quote";
import type { ChatMessage } from "@/lib/types";

export const maxDuration = 60;

function sse(payload: object) {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

export async function POST(req: NextRequest) {
  let body: { messages?: ChatMessage[]; sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const messages = (body.messages ?? []).filter(
    (m) => m && typeof m.content === "string" && ["user", "assistant"].includes(m.role)
  );
  const sessionId = String(body.sessionId ?? "").slice(0, 64);
  if (messages.length === 0 || !sessionId) {
    return new Response("bad request", { status: 400 });
  }

  const supabase = tryCreateAdminClient();
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  // 限流:每 IP 每天 60 次、全站每天 3000 次
  try {
    if (!supabase) throw new Error("no db");
    const { data: allowed } = await supabase.rpc("ai_rate_check", {
      p_ip: ip,
      p_ip_limit: 60,
      p_global_limit: 3000,
    });
    if (allowed === false) {
      const encoder = new TextEncoder();
      return new Response(
        encoder.encode(
          sse({
            type: "text",
            text: "今日對話額度已用完,歡迎明天再來,或直接到商品頁逛逛!",
          }) + sse({ type: "done" })
        ),
        { headers: { "Content-Type": "text/event-stream" } }
      );
    }
  } catch (err) {
    console.error("[chat] rate check failed:", err);
  }

  // 登入使用者(可選)
  let userId: string | null = null;
  try {
    const userClient = await createClient();
    const { data } = await userClient.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    /* 未登入 */
  }

  const company = await getCompanyProfile();
  const rateCard = await getRateCard();

  const { data: products } = supabase
    ? await supabase
        .from("products")
        .select("name, price, category, product_type, price_rental_monthly")
        .eq("status", "active")
        .order("featured", { ascending: false })
        .limit(20)
    : { data: [] };
  const productSummary = (products ?? [])
    .map((p) => {
      const priceLabel =
        p.product_type === "artwork" && p.price_rental_monthly
          ? `月租 NT$${p.price_rental_monthly} · 買斷 NT$${p.price}`
          : `NT$${p.price}`;
      return `- ${p.name}(${priceLabel}${p.category ? `,${p.category}` : ""})`;
    })
    .join("\n");

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let assistantText = "";
      const push = (payload: object) =>
        controller.enqueue(encoder.encode(sse(payload)));

      try {
        if (hasGeminiKey()) {
          const system = buildSalesSystem(company, rateCard, productSummary);
          for await (const delta of streamChatReply(system, messages)) {
            assistantText += delta;
            push({ type: "text", text: delta });
          }
        } else {
          assistantText = fallbackReply(messages, company);
          push({ type: "text", text: assistantText });
        }
      } catch (err) {
        // Gemini 失敗(含免費層 429 限流)時退回規則式回覆,客服流程不中斷
        console.error("[chat] stream failed:", err);
        if (!assistantText) {
          assistantText = fallbackReply(messages, company);
          push({ type: "text", text: assistantText });
        } else {
          push({ type: "text", text: "\n\n(回覆似乎被中斷了,歡迎留下 email,由專人與您聯繫。)" });
        }
      }

      const fullConvo: ChatMessage[] = [
        ...messages,
        { role: "assistant", content: assistantText },
      ];

      // 對話落庫:伺服器權威 append,不用 client 傳來的歷史覆寫。
      //
      // 背景:上面的 `messages`(餵給 Gemini 當上下文用)是 client 只送最後 12 則的歷史,
      // 之前這裡直接把 fullConvo(= messages + 這輪回覆)整份寫回 DB,對話一旦超過 12 則,
      // 更早的訊息(含帶 imageUrl 的模擬圖訊息)就會從資料庫永久消失,也讓 mockup 路由
      // 靠數 messages 判定的「每 session 最多 3 張模擬圖」上限可被繞過。改法:讀出 DB
      // 現有的完整 messages,只 append 這一輪的 user + assistant 兩則(即 fullConvo 最後
      // 兩筆),寫回去的陣列只會累加、不會截斷。
      //
      // ⚠️ 併發限制:這是應用層「讀出來、append、再寫回去」,不是資料庫端的原子操作。若
      // 同一 session 有兩個請求幾乎同時抵達,後寫入的會用自己讀到的 existingMessages 覆寫,
      // 有極小機率漏掉另一個請求剛寫入的那一則(read-modify-write race)。此專案是小型
      // 後台、單一客戶對話的場景,機率低,先不加鎖;之後若流量變大或常見多分頁併發,建議
      // 改用 Postgres RPC 做 jsonb 陣列的原子 append,或加樂觀鎖版本欄位。
      try {
        if (!supabase) throw new Error("no db");
        const { data: existingLog } = await supabase
          .from("ai_chat_logs")
          .select("messages")
          .eq("session_id", sessionId)
          .maybeSingle();
        const existingMessages = (existingLog?.messages ?? []) as ChatMessage[];
        const dbMessages: ChatMessage[] = [...existingMessages, ...fullConvo.slice(-2)];
        await supabase.from("ai_chat_logs").upsert({
          session_id: sessionId,
          user_id: userId,
          messages: dbMessages,
          message_count: dbMessages.length,
          ip,
          user_agent: req.headers.get("user-agent") ?? "",
        });
      } catch (err) {
        console.error("[chat] log failed:", err);
      }

      // 報價意圖:關鍵字閘門 → AI 分類 → 建立草稿(不打斷對話)
      let quotePending = false;
      try {
        if (supabase && hasQuoteIntent(fullConvo)) {
          const readiness = await classifyQuoteReady(fullConvo);
          if (readiness.needsQuote && readiness.email) {
            const quote = await createQuoteDraftFromSession(
              sessionId,
              fullConvo,
              {
                email: readiness.email,
                name: readiness.name,
                phone: readiness.phone,
              },
              userId
            );
            quotePending = Boolean(quote);
            if (quotePending) {
              await supabase
                .from("ai_chat_logs")
                .update({
                  contact_email: readiness.email,
                  contact_name: readiness.name,
                  contact_phone: readiness.phone,
                  intent: "quote",
                })
                .eq("session_id", sessionId);
            }
          }
        }
      } catch (err) {
        console.error("[chat] quote pipeline failed:", err);
      }

      push({ type: "done", quotePending });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
