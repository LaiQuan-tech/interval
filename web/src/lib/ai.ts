import type { ChatMessage, RateCardItem } from "@/lib/types";
import type { CompanyProfile } from "@/lib/settings";

// AI 設計原則(仿 gather-landing,並升級為串流):
//  * AI 絕不自行報出價格 — 報價一律依費率卡由系統產生「草稿」,管理員核准後才寄出
//  * 系統提示詞內建 guardrail:只談小時光業務(藝術典藏租賃買斷/私人旅程/會員點數)、繁中台灣用語、蒐集聯絡方式
//  * 未設定 GEMINI_API_KEY 時整條流程退化為規則式回覆,功能仍可完整運作
//
// AI 供應商:Google Gemini(REST,不引入 SDK,避免新增相依)。
//  * 串流聊天: POST {model}:streamGenerateContent?alt=sse
//  * JSON 輸出(報價意圖分類 / 報價草稿): POST {model}:generateContent + responseMimeType=application/json

// 實測(2026-07)此 key 的 Gemini 2.x 已退役、3.x 僅走新 Interactions API;
// gemma-4-31b-it 是 generateContent 端點上可用的最佳模型。換模型用 GEMINI_MODEL 覆寫即可。
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemma-4-31b-it";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export function hasGeminiKey() {
  return Boolean(process.env.GEMINI_API_KEY);
}

function geminiHeaders() {
  return {
    "Content-Type": "application/json",
    "x-goog-api-key": process.env.GEMINI_API_KEY ?? "",
  };
}

function toGeminiContents(messages: ChatMessage[]) {
  return messages.slice(-12).map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

export function buildSalesSystem(
  company: CompanyProfile,
  rateCard: { note: string; items: RateCardItem[] },
  productSummary: string
) {
  const rateLines = rateCard.items
    .map(
      (i) =>
        `- ${i.name}:NT$${i.unit_price}${i.unit ? `/${i.unit}` : ""}${
          i.min_quantity ? `(最低 ${i.min_quantity}）` : ""
        }${i.note ? ` — ${i.note}` : ""}`
    )
    .join("\n");

  return `你是「${company.name}」的線上客服顧問。${company.tagline ?? ""}

【品牌與服務】
${
  company.about ??
  "小時光是結合線下書店門市與線上藝術銷售的品牌:提供 AI 藝術畫作(可月租、先租後買、買斷)、量身訂製的私人旅程,以及三級會員點數禮遇。"
}
聯絡信箱:${company.email || "(請客戶留下聯絡方式,我們主動聯繫)"}

【商品概覽】
${productSummary || "(目前典藏與旅程請參考網站頁面)"}

【內部費率參考 — 僅供你理解業務範圍,絕對不可直接告訴客戶價格】
${rateLines || "(費率卡尚未設定)"}

【回答規則】
1. 一律使用繁體中文(台灣用語),語氣溫暖、克制、專業,每次回覆 2~5 句。
2. 只回答與 ${company.name} 的藝術典藏、租賃買斷、私人旅程、會員制相關的問題;其他話題禮貌婉拒。
3. 不要編造不存在的作品、旅程、價格或政策。
4. 適時(但不要糾纏)邀請客戶留下聯絡方式(email 或電話)。

【報價規則 — 非常重要】
- 絕不要自己報出任何價格或估算金額(網站上公開標示的租賃/買斷/旅程價格可以引用,但客製需求一律不自行估價)。
- 當客戶詢問客製畫作、客製旅程規劃、企業空間租賃或其他報價需求時:說明我們會準備一份正式報價單寄給他,並請他提供 email。
- 拿到 email 後,告訴客戶:報價單將在專人確認後寄到他的信箱。

【引導下單】
- 客戶對特定作品或旅程有興趣時,引導他到藝術典藏或私人旅程頁面加入購物車結帳;作品可提醒月租或買斷兩種方式。
- 已收到報價單的客戶,引導他點開報價單連結按「接受報價」即可自動成立訂單。
- 客戶詢問會員權益時,可簡介三級會員與點數制度,並引導至會員沙龍頁面或預約參訪。`;
}

// ---------- 串流聊天回覆(SSE) ----------
export async function* streamChatReply(
  system: string,
  messages: ChatMessage[]
): AsyncGenerator<string> {
  const res = await fetch(`${GEMINI_BASE}/${GEMINI_MODEL}:streamGenerateContent?alt=sse`, {
    method: "POST",
    headers: geminiHeaders(),
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: toGeminiContents(messages),
      generationConfig: { maxOutputTokens: 600 },
    }),
  });

  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini stream failed: ${res.status} ${detail}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // 留下可能被截斷的最後一行,等下一輪補完

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const jsonStr = trimmed.slice(5).trim();
      if (!jsonStr) continue;
      try {
        const chunk = JSON.parse(jsonStr);
        const parts = chunk?.candidates?.[0]?.content?.parts ?? [];
        // 思考型模型(如 gemma-4)串流會夾帶 thought:true 的推理片段,絕不能吐給客戶
        const text = parts
          .filter((p: { thought?: boolean }) => !p.thought)
          .map((p: { text?: string }) => p.text ?? "")
          .join("");
        if (text) yield text;
      } catch {
        // SSE 片段偶爾會被截斷成非完整 JSON,略過即可(不影響後續片段)
      }
    }
  }
}

// ---------- JSON 結構化輸出輔助 ----------
type SchemaNode = {
  type: "object" | "array" | "string" | "integer" | "number" | "boolean";
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
  required?: string[];
  additionalProperties?: boolean;
};

// Gemini responseSchema 為 OpenAPI 3.0 子集:type 需大寫,且不支援 additionalProperties
function toGeminiSchema(node: SchemaNode): Record<string, unknown> {
  const out: Record<string, unknown> = { type: node.type.toUpperCase() };
  if (node.properties) {
    out.properties = Object.fromEntries(
      Object.entries(node.properties).map(([k, v]) => [k, toGeminiSchema(v)])
    );
    out.propertyOrdering = Object.keys(node.properties);
  }
  if (node.items) out.items = toGeminiSchema(node.items);
  if (node.required) out.required = node.required;
  return out;
}

async function callJSON<T>(system: string, user: string, schema: SchemaNode): Promise<T | null> {
  try {
    const res = await fetch(`${GEMINI_BASE}/${GEMINI_MODEL}:generateContent`, {
      method: "POST",
      headers: geminiHeaders(),
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: {
          maxOutputTokens: 1200,
          responseMimeType: "application/json",
          responseSchema: toGeminiSchema(schema),
        },
      }),
    });
    if (!res.ok) {
      console.error("[ai] Gemini JSON call failed:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .filter((p: { thought?: boolean }) => !p.thought)
      .map((p: { text?: string }) => p.text ?? "")
      .join("");
    return JSON.parse(text) as T;
  } catch (err) {
    console.error("[ai] JSON call failed:", err);
    return null;
  }
}

// ---------- 報價意圖 ----------
const QUOTE_KEYWORDS =
  /報價|估價|價格|多少錢|費用|預算|批發|大量|採購|訂閱|月租|租金|買斷|入會|會員方案|客製|旅程規劃|quote|price/i;

export function hasQuoteIntent(messages: ChatMessage[]) {
  return messages.some((m) => m.role === "user" && QUOTE_KEYWORDS.test(m.content));
}

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/;

export type QuoteReadiness = {
  ready: boolean;
  email: string;
  name: string;
  phone: string;
};

export async function classifyQuoteReady(messages: ChatMessage[]): Promise<QuoteReadiness> {
  const transcript = messages
    .map((m) => `${m.role === "user" ? "客戶" : "客服"}:${m.content}`)
    .join("\n");

  if (!hasGeminiKey()) {
    // fallback:客戶訊息中出現 email 且有報價關鍵字即視為 ready
    const emailMatch = messages
      .filter((m) => m.role === "user")
      .map((m) => m.content.match(EMAIL_RE)?.[0])
      .find(Boolean);
    return {
      ready: Boolean(emailMatch) && hasQuoteIntent(messages),
      email: emailMatch ?? "",
      name: "",
      phone: "",
    };
  }

  const result = await callJSON<QuoteReadiness>(
    "你是對話分析器。判斷客戶是否已表達報價需求並提供了 email。只擷取客戶實際說過的資訊,沒有就留空字串。",
    `對話紀錄:\n${transcript}\n\n請判斷:ready(是否可以為客戶準備報價單:需同時有明確報價意圖與 email)、email、name、phone。`,
    {
      type: "object",
      properties: {
        ready: { type: "boolean" },
        email: { type: "string" },
        name: { type: "string" },
        phone: { type: "string" },
      },
      required: ["ready", "email", "name", "phone"],
      additionalProperties: false,
    }
  );
  return result ?? { ready: false, email: "", name: "", phone: "" };
}

// ---------- 報價草稿 ----------
export type DraftLineItems = {
  line_items: { name: string; unit_price: number; quantity: number; note: string }[];
  summary: string;
};

export async function generateQuoteLineItems(
  messages: ChatMessage[],
  rateCard: { note: string; items: RateCardItem[] }
): Promise<DraftLineItems> {
  const transcript = messages
    .map((m) => `${m.role === "user" ? "客戶" : "客服"}:${m.content}`)
    .join("\n");

  if (!hasGeminiKey() || rateCard.items.length === 0) {
    // fallback:關鍵字比對費率卡品項;完全沒中則給空草稿讓管理員手動補
    const matched = rateCard.items.filter((i) =>
      messages.some((m) => m.role === "user" && m.content.includes(i.name.slice(0, 2)))
    );
    return {
      line_items: matched.map((i) => ({
        name: i.name,
        unit_price: i.unit_price,
        quantity: i.min_quantity ?? 1,
        note: i.note ?? "",
      })),
      summary: "系統依關鍵字自動比對費率卡產生(無 AI),請人工確認品項與數量。",
    };
  }

  const rateJson = JSON.stringify(rateCard.items);
  const result = await callJSON<DraftLineItems>(
    `你是報價助理。根據對話需求與費率卡草擬報價品項。
規則:
1. 只能使用費率卡中existing的品項與單價,不可自創品項或修改單價。
2. 數量依客戶描述推估;不確定就用費率卡的最低數量或 1。
3. 金額一律為新台幣整數。
4. summary 用一兩句話總結客戶需求給內部同事看。
費率卡:${rateJson}`,
    `對話紀錄:\n${transcript}\n\n請草擬報價品項。`,
    {
      type: "object",
      properties: {
        line_items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              unit_price: { type: "integer" },
              quantity: { type: "integer" },
              note: { type: "string" },
            },
            required: ["name", "unit_price", "quantity", "note"],
            additionalProperties: false,
          },
        },
        summary: { type: "string" },
      },
      required: ["line_items", "summary"],
      additionalProperties: false,
    }
  );

  return (
    result ?? {
      line_items: [],
      summary: "AI 草擬失敗,請人工依對話內容補上品項。",
    }
  );
}

// ---------- 規則式 fallback 回覆(無 API key 時) ----------
export function fallbackReply(messages: ChatMessage[], company: CompanyProfile) {
  const last = messages.filter((m) => m.role === "user").at(-1)?.content ?? "";
  const email = last.match(EMAIL_RE)?.[0];

  if (email) {
    return `收到!我們會把報價單寄到 ${email},專人確認後就會發出,再麻煩留意信箱。如有其他需求也歡迎直接留言。`;
  }
  if (QUOTE_KEYWORDS.test(last)) {
    return `了解您的需求!我們會為您準備一份正式報價單。方便留下您的 email 嗎?專人確認後就會把報價單寄給您。`;
  }
  if (/作品|典藏|畫作|租賃|買斷|月租/.test(last)) {
    return `我們的畫作典藏都在「藝術典藏」頁面,每件作品皆可選擇月租或買斷。看到喜歡的直接加入購物車就能結帳,也歡迎留言讓我們為您推薦。`;
  }
  if (/旅程|旅行|行程/.test(last)) {
    return `私人旅程會依您鍾愛的畫作靈感量身策劃,詳情在「私人旅程」頁面。若想完全客製,留下 email 我們會請專屬顧問與您聯繫。`;
  }
  if (/會員|點數|入會/.test(last)) {
    return `小時光設有緻銀、璀金、典藏三級會員,消費、參訪、租賃皆可累點,可兌換旅程與典藏折扣。歡迎到「會員沙龍」頁面了解,或直接預約參訪申請入會。`;
  }
  if (/運送|安裝|出貨|物流|多久/.test(last)) {
    return `作品租賃或買斷皆含裝裱、運送與到府安裝,詳細時程會在訂單頁面更新。您也可以留下 email,我們會主動通知您。`;
  }
  return `您好,歡迎來到 ${company.name}!想了解藝術典藏、租賃買斷、私人旅程或會員制度,都可以直接跟我說。也歡迎預約參訪,或留下 email 讓我們主動與您聯繫。`;
}
