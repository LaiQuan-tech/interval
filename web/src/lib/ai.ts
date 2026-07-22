import type { ChatMessage, RateCardItem } from "@/lib/types";
import type { CompanyProfile } from "@/lib/settings";

// AI 設計原則(仿 gather-landing,並升級為串流):
//  * AI 絕不自行報出價格 — 報價一律依費率卡由系統產生「草稿」,管理員核准後才寄出
//  * 系統提示詞內建 guardrail:只談好日子業務(藝術典藏租賃買斷/私人旅程/會員點數)、繁中台灣用語、蒐集聯絡方式
//  * 未設定 GEMINI_API_KEY 時整條流程退化為規則式回覆,功能仍可完整運作
//
// AI 供應商:Google Gemini(REST,不引入 SDK,避免新增相依)。
//  * 串流聊天: POST {model}:streamGenerateContent?alt=sse
//  * JSON 輸出(報價意圖分類 / 報價草稿): POST {model}:generateContent + responseMimeType=application/json

// 實測(2026-07)此 key 的 Gemini 2.x 已退役、3.x 僅走新 Interactions API;
// gemma-4-31b-it 是 generateContent 端點上可用的最佳模型。換模型用 GEMINI_MODEL 覆寫即可。
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemma-4-31b-it";
// 居家擺放模擬用的影像生成模型(與文字模型分流,各自可覆寫)
const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export function hasGeminiKey() {
  return Boolean(process.env.GEMINI_API_KEY);
}

// 居家擺放模擬入口說明(單一事實來源,本檔四處引用,避免入口改版時各處各自漂移):
// 主要路徑是作品頁的「先看看掛在我家的樣子」按鈕,聊天視窗內 📷 上傳是保留的次要路徑。
// 注意:web/src/components/ChatWidget.tsx 的開場歡迎詞是 client 元件,不 import 本檔
// (避免把本檔的 fetch/Gemini 呼叫邏輯一併打進 client bundle),那邊維護了同義的另一份文案——
// 兩處任一改動都要回頭同步對方,並保留這則註解的雙向指標。
const MOCKUP_ENTRY_HINT =
  "到該作品的商品頁點『先看看掛在我家的樣子』,用示範空間或上傳自家照片,約 30 秒就能生成擺放模擬圖;也可以直接在這裡點 📷 上傳照片";

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
  "好日子是結合線下書店門市與線上藝術銷售的品牌:提供 AI 藝術畫作(可月租、先租後買、買斷)、量身訂製的私人旅程,以及三級會員點數禮遇。"
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

【報價規則 — 非常重要,務必與下方【引導下單】區分清楚】
- 絕不要自己報出任何價格或估算金額(網站上公開標示的租賃/買斷/旅程/會員價格可以引用,但客製需求一律不自行估價)。
- 只有以下情況才走報價流程:客製畫作、客製旅程規劃、企業或大量/批發採購、包場等「商城沒有現成品項、需要議價」的需求。遇到這類需求,說明我們會準備一份正式報價單寄給他,並請他提供 email;拿到 email 後,告訴客戶報價單將在專人確認後寄到他的信箱。
- 商城已有的現貨作品、旅程、一般會員方案,絕不進入報價流程,也不要為此跟客戶要 email 準備報價單——一律改用下方【引導下單】的方式回應。
- 如果無法判斷客戶要的是「收藏/報名商城現有的品項」還是「客製一份全新的」,先主動問一句釐清(例如:「您是想收藏現有的這幅,還是想量身客製一幅呢?」),不要預設把人推進報價或結帳。

【引導下單 — 現貨作品/行程/會員】
- 商城已有的作品、旅程、會員方案都是公開標價。客戶對特定作品或旅程有興趣時,直接引導他到藝術典藏或私人旅程頁面加入購物車結帳;作品可提醒月租或買斷兩種方式。
- 已收到報價單的客戶,引導他點開報價單連結按「接受報價」即可自動成立訂單。
- 客戶詢問一般會員權益時,簡介三級會員與點數制度,並引導至會員沙龍頁面或預約參訪加入;只有企業會員/客製方案才適用上面的報價規則。

【居家擺放模擬 — 重要導購工具,要盡量主動推薦】
- 只要客戶對某件作品表達興趣、猶豫尺寸或風格是否適合家裡、或問起「掛起來感覺如何」「適不適合我家」之類的問題,就主動且自然地提議:
  「想看看掛起來的感覺,${MOCKUP_ENTRY_HINT}」。
- 不要每一輪都硬推,但只要話題碰到具體作品與居家擺放,就是最好的邀請時機。
- 客戶完成擺放模擬後,接續詢問對效果的感覺,並自然帶到該作品的月租/買斷公開標價,引導直接加入購物車下單(這是現貨作品,不進報價流程)。`;
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
      // gemma-4 的思考 token 計入 maxOutputTokens(實測 2026-07-21 思考常態 550~700 token,
      // 且不支援 thinkingConfig 壓思考預算):上限 600 時思考吃光預算,正文變空或中途截斷,
      // 並以 finishReason=MAX_TOKENS「正常結束」不拋錯。2048 實測 6/6 完整回覆。
      // 注意 JSON 模式(callJSON)實測不產思考 token,不受此限。
      generationConfig: { maxOutputTokens: 2048 },
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

// Gemma 在 JSON 模式偶爾會於合法 JSON 之後多吐文字(實測 2026-07),
// 直接 JSON.parse 會炸——掃出第一個括號平衡的完整 JSON 值再解析
function extractFirstJson(text: string): string | null {
  const start = text.search(/[{[]/);
  if (start < 0) return null;
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else {
      if (ch === '"') inStr = true;
      else if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) return text.slice(start, i + 1);
      }
    }
  }
  return null;
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
    try {
      return JSON.parse(text) as T;
    } catch {
      const first = extractFirstJson(text);
      if (first) return JSON.parse(first) as T;
      throw new Error(`no parseable JSON in response: ${text.slice(0, 120)}`);
    }
  } catch (err) {
    console.error("[ai] JSON call failed:", err);
    return null;
  }
}

// ---------- 報價意圖 ----------
// 廉價前置過濾:只決定要不要花一次分類呼叫,故意寬鬆(含現貨詞如月租/買斷/價格)。
// 真正的「客製 vs 現貨」分流由 classifyQuoteReady() 的 AI 分類器(或無 key 時的
// CUSTOM_KEYWORDS fallback)決定,不在這一關把關。
const QUOTE_KEYWORDS =
  /報價|估價|價格|多少錢|費用|預算|批發|大量|採購|訂閱|月租|租金|買斷|入會|會員方案|客製|旅程規劃|專屬|量身|訂製|企業|包場|quote|price/i;

export function hasQuoteIntent(messages: ChatMessage[]) {
  return messages.some((m) => m.role === "user" && QUOTE_KEYWORDS.test(m.content));
}

// 明確客製/企業大量詞——與上面寬鬆的 QUOTE_KEYWORDS 不同,這組刻意排除
// 月租/買斷/價格等現貨詞,只用來判定「是否為需要正式報價單的客製需求」。
const CUSTOM_KEYWORDS = /客製|訂製|量身|專屬|企業|大量|批發|包場|旅程規劃/;

function hasCustomIntent(messages: ChatMessage[]) {
  return messages.some((m) => m.role === "user" && CUSTOM_KEYWORDS.test(m.content));
}

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.]+/;

export type QuoteReadiness = {
  // 是否為需要正式報價單的「客製/企業大量」需求(相對於詢問商城現有品項)。
  needsQuote: boolean;
  email: string;
  name: string;
  phone: string;
};

export async function classifyQuoteReady(messages: ChatMessage[]): Promise<QuoteReadiness> {
  const transcript = messages
    .map((m) => `${m.role === "user" ? "客戶" : "客服"}:${m.content}`)
    .join("\n");

  if (!hasGeminiKey()) {
    // fallback:客戶訊息中出現 email 且有明確客製詞(CUSTOM_KEYWORDS)才視為需要報價單。
    // 現貨詞(月租/買斷/價格)不觸發——避免現貨詢價被誤推進報價流程。
    const emailMatch = messages
      .filter((m) => m.role === "user")
      .map((m) => m.content.match(EMAIL_RE)?.[0])
      .find(Boolean);
    return {
      needsQuote: Boolean(emailMatch) && hasCustomIntent(messages),
      email: emailMatch ?? "",
      name: "",
      phone: "",
    };
  }

  const result = await callJSON<QuoteReadiness>(
    `你是對話分析器。判斷客戶的需求屬於「客製/報價」還是「商城現有品項/下單」,並擷取客戶提供的聯絡資訊。

客製/報價類(needsQuote=true):客製畫作、客製旅程規劃、企業或大量/批發採購、包場等——商城沒有現成品項、需要議價的需求。
現貨/下單類(needsQuote=false):詢問商城現有作品、旅程、一般會員方案——這些都已公開標價,不算報價需求,即使客戶問到價格也一樣是 false。
無法判斷客戶要的是商城現有品項還是客製一份新的時,一律回傳 needsQuote=false(交由客服人員口頭詢問澄清,不要臆測)。

只擷取客戶實際說過的聯絡資訊,沒有就留空字串。`,
    `對話紀錄:\n${transcript}\n\n請判斷:needsQuote(是否為需要正式報價單的客製/企業大量需求)、email、name、phone。`,
    {
      type: "object",
      properties: {
        needsQuote: { type: "boolean" },
        email: { type: "string" },
        name: { type: "string" },
        phone: { type: "string" },
      },
      required: ["needsQuote", "email", "name", "phone"],
      additionalProperties: false,
    }
  );
  return result ?? { needsQuote: false, email: "", name: "", phone: "" };
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

// ---------- 居家擺放模擬:影像生成 ----------
export type RoomPhoto = { mime: string; base64: string };

// 把作品合成進客戶自己的空間照片:輸入客廳照 + 作品圖 + 合成指令,輸出一張 photorealistic 合成圖(Buffer)。
// 呼叫形狀(image 輸入 + IMAGE 輸出)已實測可用;失敗一律丟明確錯誤,由呼叫端決定如何回應客戶。
export type ArtworkImage = { mime: string; base64: string };

export async function generateRoomMockup(input: {
  roomPhoto: RoomPhoto;
  artwork: ArtworkImage;
  artworkName: string;
}): Promise<Buffer> {
  const instruction = `這是兩張圖片:第一張是客戶家中的空間照片,第二張是畫作《${input.artworkName}》。
請把第二張圖的畫作內容,以符合空間透視與家具尺度的合理實體比例,加上一個簡約的細木畫框,合成掛在第一張圖片空間中最合適的一面牆上。
務必忠實呈現第一張圖原本的空間格局與光線,也務必忠實呈現第二張圖畫作本身的構圖與色彩,不可竄改任何一方。
輸出一張逼真的室內攝影風格圖片(photorealistic interior photo),圖片中不得加入任何文字、標籤或浮水印。`;

  const res = await fetch(`${GEMINI_BASE}/${GEMINI_IMAGE_MODEL}:generateContent`, {
    method: "POST",
    headers: geminiHeaders(),
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: input.roomPhoto.mime, data: input.roomPhoto.base64 } },
            { inlineData: { mimeType: input.artwork.mime, data: input.artwork.base64 } },
            { text: instruction },
          ],
        },
      ],
      generationConfig: { responseModalities: ["IMAGE"] },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Gemini image generation failed: ${res.status} ${detail}`);
  }

  const data = await res.json();
  const blockReason = data?.promptFeedback?.blockReason;
  if (blockReason) {
    throw new Error(`Gemini image generation blocked: ${blockReason}`);
  }
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find(
    (p: { inlineData?: { data?: string } }) => p.inlineData?.data
  ) as { inlineData?: { data?: string } } | undefined;
  if (!imagePart?.inlineData?.data) {
    throw new Error(
      `Gemini image generation returned no image (finishReason=${data?.candidates?.[0]?.finishReason ?? "unknown"})`
    );
  }
  return Buffer.from(imagePart.inlineData.data, "base64");
}

// 模擬圖生成後的接續導購話術:提及作品公開標價,詢問感覺與是否要下單/報價
export async function generateMockupFollowup(params: {
  artworkName: string;
  monthlyPrice: number | null;
  buyoutPrice: number;
  company: CompanyProfile;
}): Promise<string> {
  const { artworkName, monthlyPrice, buyoutPrice, company } = params;
  const priceLine = monthlyPrice
    ? `月租 NT$${monthlyPrice}、買斷 NT$${buyoutPrice}`
    : `買斷 NT$${buyoutPrice}`;

  if (!hasGeminiKey()) {
    return `這是《${artworkName}》掛在您空間裡的模擬效果,喜歡這樣的氛圍嗎?這件作品目前${priceLine},喜歡的話可以直接到藝術典藏頁加入購物車,選擇月租或買斷都很方便。`;
  }

  const result = await callJSON<{ text: string }>(
    `你是「${company.name}」的線上客服顧問,剛為客戶生成了一張擺放模擬圖(把作品合成進客戶自己居家空間的照片)。
用溫暖克制、專業的繁體中文語氣寫 2~4 句接續回覆:先詢問客戶對這個擺放效果的感覺,接著自然帶出這件作品的公開標價「${priceLine}」,
最後引導客戶直接到藝術典藏頁把這件作品加入購物車、選擇月租或買斷下單。這件作品是商城現貨,絕對不要提及報價單或詢問是否需要報價,
也絕對不可以自行估算或提及公開標價以外的金額,也不要編造任何規格。`,
    `作品名稱:《${artworkName}》`,
    {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
      additionalProperties: false,
    }
  );

  return (
    result?.text ??
    `這是《${artworkName}》掛在您空間裡的模擬效果,喜歡這樣的氛圍嗎?這件作品目前${priceLine},喜歡的話可以直接到藝術典藏頁加入購物車,選擇月租或買斷都很方便。`
  );
}

// ---------- 規則式 fallback 回覆(無 API key 時) ----------
export function fallbackReply(messages: ChatMessage[], company: CompanyProfile) {
  const userMessages = messages.filter((m) => m.role === "user");
  const last = userMessages.at(-1)?.content ?? "";
  const email = last.match(EMAIL_RE)?.[0];
  // 客製意圖看整段對話(不只最後一則),讓「先聊客製、後補 email」這種常見兩輪流程仍能命中。
  const customIntent = userMessages.some((m) => CUSTOM_KEYWORDS.test(m.content));

  if (email && customIntent) {
    return `收到!我們會把報價單寄到 ${email},專人確認後就會發出,再麻煩留意信箱。如有其他需求也歡迎直接留言。`;
  }
  if (customIntent) {
    return `了解您的客製需求!我們會為您準備一份正式報價單。方便留下您的 email 嗎?專人確認後就會把報價單寄給您。`;
  }
  if (/掛|擺放|效果|感覺如何|適合我家|我家|空間感|客廳|書房/.test(last)) {
    return `想知道掛起來的感覺最直接了!${MOCKUP_ENTRY_HINT}。`;
  }
  if (/作品|典藏|畫作|租賃|買斷|月租/.test(last)) {
    return `我們的畫作典藏都在「藝術典藏」頁面,每件作品皆可選擇月租或買斷,都是公開標價。看到喜歡的直接加入購物車就能結帳;想先看看掛在家裡的感覺,${MOCKUP_ENTRY_HINT}。`;
  }
  if (/旅程|旅行|行程/.test(last)) {
    return `我們的私人旅程都在「私人旅程」頁面,每個行程都是公開標價,看到喜歡的直接報名即可。若想完全客製屬於您的行程,留下 email 我們會請專屬顧問與您聯繫。`;
  }
  if (/會員|點數|入會/.test(last)) {
    return `好日子設有緻銀、璀金、典藏三級會員,消費、參訪、租賃皆可累點,可兌換旅程與典藏折扣。歡迎到「會員沙龍」頁面了解,或直接預約參訪申請入會。`;
  }
  if (/運送|安裝|出貨|物流|多久/.test(last)) {
    return `作品租賃或買斷皆含裝裱、運送與到府安裝,詳細時程會在訂單頁面更新。您也可以留下 email,我們會主動通知您。`;
  }
  if (QUOTE_KEYWORDS.test(last)) {
    return `商城裡的作品、旅程與會員方案都是公開標價,歡迎直接到頁面上選購;如果是想客製一份專屬的畫作或旅程,留下 email 我們會為您準備正式報價單。`;
  }
  return `您好,歡迎來到 ${company.name}!想了解藝術典藏、租賃買斷、私人旅程或會員制度,都可以直接跟我說。看到喜歡的作品,${MOCKUP_ENTRY_HINT};也歡迎預約參訪,或留下 email 讓我們主動與您聯繫。`;
}
