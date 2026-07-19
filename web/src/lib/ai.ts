import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, RateCardItem } from "@/lib/types";
import type { CompanyProfile } from "@/lib/settings";

// AI 設計原則(仿 gather-landing,並升級為串流):
//  * AI 絕不自行報出價格 — 報價一律依費率卡由系統產生「草稿」,管理員核准後才寄出
//  * 系統提示詞內建 guardrail:只談 interval 業務、繁中台灣用語、蒐集聯絡方式
//  * 未設定 ANTHROPIC_API_KEY 時整條流程退化為規則式回覆,功能仍可完整運作

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

export function hasAnthropicKey() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function client() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
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

【公司資訊】
${company.about ?? "跨境電商品牌,協助客戶把商品賣到全世界。"}
聯絡信箱:${company.email || "(請客戶留下聯絡方式,我們主動聯繫)"}

【商品概覽】
${productSummary || "(目前商品請參考網站商品頁)"}

【內部費率參考 — 僅供你理解業務範圍,絕對不可直接告訴客戶價格】
${rateLines || "(費率卡尚未設定)"}

【回答規則】
1. 一律使用繁體中文(台灣用語),親切、專業,每次回覆 2~5 句。
2. 只回答與 ${company.name} 商品、購買、報價、合作相關的問題;其他話題禮貌婉拒。
3. 不要編造不存在的商品、價格或政策。
4. 適時(但不要糾纏)邀請客戶留下聯絡方式(email 或電話)。

【報價規則 — 非常重要】
- 絕不要自己報出任何價格或估算金額。
- 當客戶詢問價格、報價、費用、大量採購或客製需求時:說明我們會準備一份正式報價單寄給他,並請他提供 email。
- 拿到 email 後,告訴客戶:報價單將在專人確認後寄到他的信箱。

【引導下單】
- 客戶對特定商品有興趣時,引導他到商品頁加入購物車結帳。
- 已收到報價單的客戶,引導他點開報價單連結按「接受報價」即可自動成立訂單。`;
}

export async function streamChatReply(system: string, messages: ChatMessage[]) {
  const anthropic = client();
  return anthropic.messages.stream({
    model: MODEL,
    max_tokens: 600,
    system,
    messages: messages.slice(-12).map((m) => ({ role: m.role, content: m.content })),
  });
}

// ---------- JSON 輔助呼叫 ----------
async function callJSON<T>(system: string, user: string, schema: object): Promise<T | null> {
  try {
    const anthropic = client();
    const res = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system,
      messages: [{ role: "user", content: user }],
      output_config: {
        format: { type: "json_schema", schema },
      },
    } as Parameters<typeof anthropic.messages.create>[0]);
    const text =
      "content" in res
        ? res.content.find((b) => b.type === "text")?.text ?? ""
        : "";
    return JSON.parse(text) as T;
  } catch (err) {
    console.error("[ai] JSON call failed:", err);
    return null;
  }
}

// ---------- 報價意圖 ----------
const QUOTE_KEYWORDS = /報價|估價|價格|多少錢|費用|預算|批發|大量|採購|quote|price/i;

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

export async function classifyQuoteReady(
  messages: ChatMessage[]
): Promise<QuoteReadiness> {
  const transcript = messages
    .map((m) => `${m.role === "user" ? "客戶" : "客服"}:${m.content}`)
    .join("\n");

  if (!hasAnthropicKey()) {
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

  if (!hasAnthropicKey() || rateCard.items.length === 0) {
    // fallback:關鍵字比對費率卡品項;完全沒中則給空草稿讓管理員手動補
    const matched = rateCard.items.filter((i) =>
      messages.some(
        (m) => m.role === "user" && m.content.includes(i.name.slice(0, 2))
      )
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
  if (/商品|產品|賣什麼|有什麼/.test(last)) {
    return `我們的完整商品都在「商品」頁面,歡迎逛逛!看到喜歡的直接加入購物車就能結帳。需要大量採購或客製,也可以直接跟我說,我們可以提供報價。`;
  }
  if (/運送|出貨|物流|多久/.test(last)) {
    return `付款確認後我們會盡快安排出貨,詳細時程會在訂單頁面更新。您也可以留下 email,出貨時我們會通知您。`;
  }
  return `您好,歡迎來到 ${company.name}!想了解商品、下單流程或需要大量採購報價,都可以直接跟我說。也歡迎留下 email,我們可以主動與您聯繫。`;
}
