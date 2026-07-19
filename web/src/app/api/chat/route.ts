import { NextRequest } from "next/server";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  buildSalesSystem,
  classifyQuoteReady,
  fallbackReply,
  hasAnthropicKey,
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
        .select("name, price, category")
        .eq("status", "active")
        .order("featured", { ascending: false })
        .limit(20)
    : { data: [] };
  const productSummary = (products ?? [])
    .map((p) => `- ${p.name}(NT$${p.price}${p.category ? `,${p.category}` : ""})`)
    .join("\n");

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let assistantText = "";
      const push = (payload: object) =>
        controller.enqueue(encoder.encode(sse(payload)));

      try {
        if (hasAnthropicKey()) {
          const system = buildSalesSystem(company, rateCard, productSummary);
          const claudeStream = await streamChatReply(system, messages);
          for await (const event of claudeStream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              assistantText += event.delta.text;
              push({ type: "text", text: event.delta.text });
            }
          }
        } else {
          assistantText = fallbackReply(messages, company);
          push({ type: "text", text: assistantText });
        }
      } catch (err) {
        console.error("[chat] stream failed:", err);
        assistantText =
          assistantText ||
          "抱歉,系統忙碌中,請稍後再試,或留下 email 由專人與您聯繫。";
        push({ type: "text", text: " " + assistantText });
      }

      const fullConvo: ChatMessage[] = [
        ...messages,
        { role: "assistant", content: assistantText },
      ];

      // 對話落庫(upsert by session)
      try {
        if (!supabase) throw new Error("no db");
        await supabase.from("ai_chat_logs").upsert({
          session_id: sessionId,
          user_id: userId,
          messages: fullConvo,
          message_count: fullConvo.length,
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
          if (readiness.ready && readiness.email) {
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
