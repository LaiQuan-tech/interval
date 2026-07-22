#!/usr/bin/env node
/**
 * 商品內容 AI 翻譯腳本(Phase D2)
 *
 * 背景:products/membership_tiers 的中文內容(作品名/描述、旅程天數、會員權益)一次性翻成英文,
 * 存進 20260722000002_product_i18n.sql 新增的 name_en/description_en/perks_en/metadata.duration_en
 * 欄位——不是執行期即時翻譯,是預先翻好存進 DB,英文站直接讀欄位。
 *
 * 翻譯對齊 web/src/lib/ai.ts 的 callJSON 慣例(Gemini generateContent + responseSchema JSON 模式),
 * 但本檔獨立維護一份精簡實作(腳本沒有引入 TS 路徑別名,無法直接 import ai.ts)。
 *
 * 冪等:預設只翻 name_en(products)/name_en(membership_tiers)為 null 的列;--force 全部重翻。
 * 安全:只寫新欄位(name_en/description_en/perks_en/metadata.duration_en),絕不動既有中文欄位。
 *
 * 用法(在 repo 根目錄,金鑰讀 web/.env.local):
 *   node scripts/translate-products.mjs              # 只翻未翻譯過的
 *   node scripts/translate-products.mjs --limit=2     # 先試 2 筆,確認翻譯品質再全跑
 *   node scripts/translate-products.mjs --force       # 全部重翻(含已有英文欄位的)
 *
 * 前提:supabase/migrations/20260722000002_product_i18n.sql 必須已套用到目標 DB,
 * 否則 update 會因欄位不存在而失敗(錯誤訊息會清楚指出 column 不存在)。
 */
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WEB_ROOT = join(ROOT, "web");

// ---------- 讀 web/.env.local(不覆蓋已存在的環境變數,方便 CI 用真正的 env 覆寫)----------
async function loadEnvFile(path) {
  try {
    const content = await readFile(path, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key]) continue; // 已有(如 CI 注入)就不覆蓋
      const value = rawValue.replace(/^["']|["']$/g, "");
      process.env[key] = value;
    }
  } catch {
    // .env.local 不存在就略過,靠外部環境變數
  }
}

const log = (msg) => console.log(`\x1b[36m▸\x1b[0m ${msg}`);
const ok = (msg) => console.log(`\x1b[32m✓\x1b[0m ${msg}`);
const warn = (msg) => console.log(`\x1b[33m⚠\x1b[0m ${msg}`);
const fail = (msg) => console.log(`\x1b[31m✗\x1b[0m ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- CLI 參數 ----------
const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity;

// ---------- Gemini JSON 呼叫(對齊 web/src/lib/ai.ts 的 toGeminiSchema/callJSON) ----------
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemma-4-31b-it";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

function geminiHeaders() {
  return {
    "Content-Type": "application/json",
    "x-goog-api-key": process.env.GEMINI_API_KEY ?? "",
  };
}

// Gemini responseSchema 為 OpenAPI 3.0 子集:type 需大寫。
function toGeminiSchema(node) {
  const out = { type: node.type.toUpperCase() };
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

// Gemma 在 JSON 模式偶爾會於合法 JSON 之後多吐文字,掃出第一個括號平衡的完整 JSON 值再解析
// (對齊 web/src/lib/ai.ts 的 extractFirstJson)。
function extractFirstJson(text) {
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

async function callJSON(system, user, schema) {
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
    throw new Error(`Gemini JSON call failed: ${res.status} ${await res.text().catch(() => "")}`);
  }
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .filter((p) => !p.thought)
    .map((p) => p.text ?? "")
    .join("");
  try {
    return JSON.parse(text);
  } catch {
    const first = extractFirstJson(text);
    if (first) return JSON.parse(first);
    throw new Error(`no parseable JSON in response: ${text.slice(0, 120)}`);
  }
}

// ---------- 翻譯 system prompt ----------
const TRANSLATE_SYSTEM = `你是「好日子 Good Days」線上藝廊的雙語文案譯者,負責把中文商品文案譯成英文。

要求:
1. 典雅、意譯而非逐字直譯——參考國際拍賣行(如 Sotheby's/Christie's)與精品藝廊的英文文案語感。
2. 保留專有名詞或使用慣用英譯:地名(京都→Kyoto、北海道→Hokkaido、托斯卡尼→Tuscany)、
   媒材(Giclée 版畫維持 Giclée、Canvas 油畫布維持 Canvas)。
3. 品牌名一律譯為「Good Days」,不要譯成其他詞或意譯。
4. 只輸出符合 schema 的 JSON,不要加任何說明文字或 markdown 標記。`;

// ---------- 主流程 ----------
async function main() {
  await loadEnvFile(join(WEB_ROOT, ".env.local"));

  const missing = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "GEMINI_API_KEY"].filter(
    (k) => !process.env[k]
  );
  if (missing.length) {
    fail(`缺少必要環境變數:${missing.join(", ")}(請確認 web/.env.local 或外部 env 已設定)`);
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  console.log("\n=== 商品內容 AI 翻譯(Phase D2)===");
  console.log(FORCE ? "模式:--force(全部重翻)" : "模式:只翻尚未翻譯的(name_en is null)");
  if (LIMIT !== Infinity) console.log(`限制:最多處理 ${LIMIT} 筆/類別(用於試翻品質)`);
  console.log("");

  let succeeded = 0;
  let skipped = 0;
  let failed = 0;

  // ---------- membership_tiers(先翻,products 的 membership 商品名稱要對齊這裡) ----------
  // 順序很重要:products.name 與 membership_tiers.name 對同一等級是逐字相同的中文字串
  // (如兩邊都存「緻銀會員」),必須先把 tier 翻好,products 那邊的同名商品才能直接沿用同一個
  // 英文名稱,不然兩處各自獨立呼叫 AI 會翻出兩個不同的英文名(實測發生過:
  // 「Silver Tier Membership」vs「Refined Silver Member」),同一方案在網站上出現兩個
  // 不同英文名會很奇怪。
  log("讀取 membership_tiers…");
  let tierQuery = supabase.from("membership_tiers").select("slug, name, perks, name_en").order("sort");
  if (!FORCE) tierQuery = tierQuery.is("name_en", null);
  const { data: tiers, error: tiersErr } = await tierQuery;
  if (tiersErr) {
    fail(`讀取 membership_tiers 失敗:${tiersErr.message}`);
    process.exitCode = 1;
    return;
  }
  const tiersToRun = tiers.slice(0, LIMIT);
  ok(`共 ${tiers.length} 筆待翻(本次處理 ${tiersToRun.length} 筆)`);

  for (const t of tiersToRun) {
    const label = `[tier] ${t.slug}`;
    try {
      const schema = {
        type: "object",
        properties: {
          name_en: { type: "string" },
          perks_en: { type: "array", items: { type: "string" } },
        },
        required: ["name_en", "perks_en"],
      };
      const user = `會員等級中文名稱:${t.name}\n中文權益清單(依序,共 ${t.perks.length} 項):\n${t.perks
        .map((perk, i) => `${i + 1}. ${perk}`)
        .join("\n")}\n\n請提供典雅的英文翻譯,perks_en 陣列的順序與筆數需與中文清單完全一致(共 ${t.perks.length} 項)。`;

      log(`翻譯中:${label}`);
      const result = await callJSON(TRANSLATE_SYSTEM, user, schema);
      if (!result?.name_en || !Array.isArray(result?.perks_en) || result.perks_en.length !== t.perks.length) {
        throw new Error(`回傳格式不符(需要 ${t.perks.length} 項 perks_en):${JSON.stringify(result)}`);
      }

      const { error: updateErr } = await supabase
        .from("membership_tiers")
        .update({ name_en: result.name_en, perks_en: result.perks_en })
        .eq("slug", t.slug);
      if (updateErr) throw new Error(updateErr.message);

      ok(`完成:${label} → "${result.name_en}"`);
      succeeded++;
      await sleep(300);
    } catch (err) {
      fail(`失敗:${label} — ${err.message}`);
      failed++;
    }
  }

  // 不管這次有沒有翻到任何 tier,都要拿到「目前所有 tier 的英文名稱」完整對照表——
  // products 那邊的 membership 商品要對齊的是 tier 的最終狀態(可能是這次剛翻的,
  // 也可能是之前就翻好、這次因為冪等被跳過的),用一次乾淨的全量查詢最保險。
  const { data: allTiers, error: allTiersErr } = await supabase
    .from("membership_tiers")
    .select("slug, name_en");
  if (allTiersErr) {
    fail(`讀取 membership_tiers 英文名稱對照表失敗:${allTiersErr.message}`);
    process.exitCode = 1;
    return;
  }
  const tierEnNameBySlug = new Map(allTiers.map((t) => [t.slug, t.name_en]).filter(([, v]) => v));

  // ---------- products(artwork / journey / membership 商品列共用一張表) ----------
  log("讀取 active products…");
  let productQuery = supabase
    .from("products")
    .select("id, slug, name, description, category, product_type, metadata, name_en")
    .eq("status", "active")
    .order("sort_order");
  if (!FORCE) productQuery = productQuery.is("name_en", null);
  const { data: products, error: productsErr } = await productQuery;
  if (productsErr) {
    fail(`讀取 products 失敗:${productsErr.message}`);
    if (productsErr.message.includes("name_en")) {
      fail("→ 看起來 name_en 欄位不存在,請先確認 migration 20260722000002_product_i18n.sql 已套用到此 DB。");
    }
    process.exitCode = 1;
    return;
  }
  const productsToRun = products.slice(0, LIMIT);
  ok(`共 ${products.length} 筆待翻(本次處理 ${productsToRun.length} 筆)`);

  for (const p of productsToRun) {
    const label = `[${p.product_type}] ${p.slug}`;
    try {
      const metadata = p.metadata ?? {};
      const needsDuration = p.product_type === "journey" && Boolean(metadata.duration);
      // membership 商品的 name 與對應 tier 的 name 是逐字相同的中文字串,英文名稱直接沿用
      // tier 那邊翻好的結果,不再讓 AI 獨立重翻一次(避免兩處各自翻出不同英文名)。
      const tierSlug = p.product_type === "membership" ? metadata.tier_slug : undefined;
      const reuseTierName = tierSlug ? tierEnNameBySlug.get(tierSlug) : undefined;

      const schema = {
        type: "object",
        properties: {
          ...(reuseTierName ? {} : { name_en: { type: "string" } }),
          description_en: { type: "string" },
          ...(needsDuration ? { duration_en: { type: "string" } } : {}),
        },
        required: [
          ...(reuseTierName ? [] : ["name_en"]),
          "description_en",
          ...(needsDuration ? ["duration_en"] : []),
        ],
      };

      const hints = [
        `slug(可作翻譯提示,不必逐字照搬):${p.slug}`,
        p.category ? `分類:${p.category}` : null,
        metadata.medium ? `媒材:${metadata.medium}` : null,
        needsDuration ? `天數:${metadata.duration}` : null,
        reuseTierName ? `此會員等級的英文名稱已定案為:"${reuseTierName}"(description_en 若提到等級名稱,直接用這個)` : null,
      ]
        .filter(Boolean)
        .join("\n");

      const user = `中文名稱:${p.name}\n中文描述:${p.description || "(無)"}\n${hints}\n\n請提供典雅的英文翻譯。${
        needsDuration ? "duration_en 是天數的英文版(如「四天三夜」→\"4 Days, 3 Nights\")。" : ""
      }`;

      log(`翻譯中:${label}`);
      const result = await callJSON(TRANSLATE_SYSTEM, user, schema);
      const name_en = reuseTierName ?? result?.name_en;
      if (!name_en || !result?.description_en) {
        throw new Error(`回傳缺少必要欄位:${JSON.stringify(result)}`);
      }

      const updatePayload = {
        name_en,
        description_en: result.description_en,
      };
      if (needsDuration && result.duration_en) {
        updatePayload.metadata = { ...metadata, duration_en: result.duration_en };
      }

      const { error: updateErr } = await supabase.from("products").update(updatePayload).eq("id", p.id);
      if (updateErr) throw new Error(updateErr.message);

      ok(`完成:${label} → "${name_en}"${reuseTierName ? "(沿用 tier 英文名)" : ""}`);
      succeeded++;
      await sleep(300); // 對 Gemini API 溫柔一點,避免速率限制
    } catch (err) {
      fail(`失敗:${label} — ${err.message}`);
      failed++;
    }
  }

  const totalCandidates = products.length + tiers.length;
  skipped = totalCandidates - productsToRun.length - tiersToRun.length;

  console.log("\n=== 翻譯結果 ===");
  console.log(`成功:${succeeded}　因 --limit 略過:${skipped}　失敗:${failed}`);
  if (failed > 0) process.exitCode = 1;
}

main();
