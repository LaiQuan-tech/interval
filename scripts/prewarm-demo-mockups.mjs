#!/usr/bin/env node
/**
 * 示範空間模擬圖預熱腳本
 *
 * 背景:作品頁模擬 flyout 選「示範空間」時,POST /api/chat/mockup 會把作品合成進示範空間照片
 * (web/public/rooms/*.jpg,目前 4 張)。示範空間組合是有限的(作品 × 4),
 * 這支腳本把全部組合預先生成、存進 chat-uploads bucket 的 demo-mockups/ 路徑,
 * 之後客戶點示範空間時 route 直接命中快取、簽名回傳,不必再等 Gemini 15~18 秒。
 *
 * 快取鍵/路徑算法必須與 web/src/app/api/chat/mockup/route.ts 的
 * artworkImageSourceKey() / demoMockupCachePath() 完全一致(本檔為求腳本獨立執行,
 * 沒有直接 import 那支 TS route,而是各自維護一份對齊的實作——兩邊任一邏輯改動,
 * 記得回頭同步另一邊,否則腳本生成的路徑會跟 route 算出來的對不上,快取永遠不會命中)。
 *
 * 冪等:每個組合上傳前都會先檢查快取路徑是否已存在,已存在就跳過,可放心重跑補齊失敗的組合。
 *
 * 用法(在 repo 根目錄):
 *   node scripts/prewarm-demo-mockups.mjs
 *
 * 金鑰來源:web/.env.local(NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / GEMINI_API_KEY)。
 * 不會把任何金鑰內容印到 console。
 */
import { readFile, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

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

// ---------- 示範空間白名單(必須與 route.ts 的 DEMO_ROOMS 一致) ----------
const DEMO_ROOMS = ["living-nordic", "dining-warm-wood", "bedroom-minimal", "study-quiet"];

const BUCKET = "chat-uploads";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const MAX_GENERATE_ATTEMPTS = 6; // gemini-2.5-flash-image 實測約 50% 機率 finishReason=NO_IMAGE,需重試

// ---------- 快取鍵(必須與 route.ts 的 artworkImageSourceKey / demoMockupCachePath 完全對齊) ----------
async function artworkImageSourceKey(slug, product) {
  const localPath = join(WEB_ROOT, "public", "artworks", `${slug}.jpg`);
  try {
    await access(localPath);
    return `local:${slug}`;
  } catch {
    /* 本機無此檔,往下看後台填的網址 */
  }
  const externalUrl = product.images?.[0]?.url;
  return externalUrl ? `url:${externalUrl}` : `local:${slug}`;
}

function demoMockupCachePath(artworkSlug, roomSlug, sourceKey) {
  const hash = createHash("sha1").update(sourceKey).digest("hex").slice(0, 8);
  return `demo-mockups/${artworkSlug}--${roomSlug}--${hash}.jpg`;
}

// ---------- 讀圖(對齊 route.ts 的 readArtworkImage / readDemoRoomImage 實際內容來源) ----------
async function resolveArtworkImageBytes(slug, product) {
  const localPath = join(WEB_ROOT, "public", "artworks", `${slug}.jpg`);
  try {
    const buf = await readFile(localPath);
    return { mime: "image/jpeg", base64: buf.toString("base64") };
  } catch {
    /* 繼續往下層 */
  }
  const url = product.images?.[0]?.url;
  if (url) {
    if (/^https?:\/\//i.test(url)) {
      const res = await fetch(url);
      if (res.ok) {
        const mime = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0].trim();
        const buf = Buffer.from(await res.arrayBuffer());
        return { mime, base64: buf.toString("base64") };
      }
    } else if (url.startsWith("/")) {
      // 後台存的相對路徑一律對應 web/public 底下的檔案(與種子資料 migration 的慣例一致)
      try {
        const buf = await readFile(join(WEB_ROOT, "public", url));
        return { mime: "image/jpeg", base64: buf.toString("base64") };
      } catch {
        /* 繼續往下,最終丟錯 */
      }
    }
  }
  throw new Error(`找不到作品圖片來源(無本機檔、無可用網址):${slug}`);
}

async function readRoomImage(roomSlug) {
  const localPath = join(WEB_ROOT, "public", "rooms", `${roomSlug}.jpg`);
  const buf = await readFile(localPath);
  return { mime: "image/jpeg", base64: buf.toString("base64") };
}

// ---------- Gemini 影像合成(對齊 web/src/lib/ai.ts 的 generateRoomMockup) ----------
async function generateRoomMockup({ roomPhoto, artwork, artworkName }) {
  const model = process.env.GEMINI_IMAGE_MODEL ?? "gemini-2.5-flash-image";
  const instruction = `這是兩張圖片:第一張是客戶家中的空間照片,第二張是畫作《${artworkName}》。
請把第二張圖的畫作內容,以符合空間透視與家具尺度的合理實體比例,加上一個簡約的細木畫框,合成掛在第一張圖片空間中最合適的一面牆上。
務必忠實呈現第一張圖原本的空間格局與光線,也務必忠實呈現第二張圖畫作本身的構圖與色彩,不可竄改任何一方。
輸出一張逼真的室內攝影風格圖片(photorealistic interior photo),圖片中不得加入任何文字、標籤或浮水印。`;

  const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY ?? "",
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: roomPhoto.mime, data: roomPhoto.base64 } },
            { inlineData: { mimeType: artwork.mime, data: artwork.base64 } },
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
  const imagePart = parts.find((p) => p.inlineData?.data);
  if (!imagePart?.inlineData?.data) {
    throw new Error(
      `Gemini image generation returned no image (finishReason=${data?.candidates?.[0]?.finishReason ?? "unknown"})`
    );
  }
  return Buffer.from(imagePart.inlineData.data, "base64");
}

async function generateRoomMockupWithRetry(input) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_GENERATE_ATTEMPTS; attempt++) {
    try {
      return await generateRoomMockup(input);
    } catch (err) {
      lastErr = err;
      if (attempt < MAX_GENERATE_ATTEMPTS) {
        const backoffMs = Math.min(2000 * attempt, 12000);
        warn(`    重試 ${attempt}/${MAX_GENERATE_ATTEMPTS}(${err.message})→ ${backoffMs}ms 後再試`);
        await sleep(backoffMs);
      }
    }
  }
  throw lastErr;
}

// ---------- 浮水印(對齊 web/src/lib/watermark.ts) ----------
async function watermarkMockup(imageBuffer) {
  const image = sharp(imageBuffer).rotate();
  const meta = await image.metadata();
  const width = meta.width ?? 1024;
  const height = meta.height ?? 1024;

  const fontSize = Math.max(20, Math.round(width * 0.024));
  const paddingX = Math.round(fontSize * 1.1);
  const paddingY = Math.round(fontSize * 1.4);
  const text = "小時光 Little Moments · 預覽";

  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <text
        x="${width - paddingX}"
        y="${height - paddingY}"
        text-anchor="end"
        font-family="'Noto Sans TC','PingFang TC',sans-serif"
        font-size="${fontSize}"
        font-weight="600"
        fill="rgba(255,255,255,0.82)"
        stroke="rgba(30,20,10,0.55)"
        stroke-width="${Math.max(2, Math.round(fontSize * 0.09))}"
        paint-order="stroke"
      >${text}</text>
    </svg>`;

  return image
    .composite([{ input: Buffer.from(svg) }])
    .jpeg({ quality: 85 })
    .toBuffer();
}

// ---------- Supabase Storage ----------
async function cacheExists(supabase, path) {
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
  return Boolean(data?.signedUrl);
}

async function uploadCache(supabase, path, buffer) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: "image/jpeg", upsert: true });
  if (error) throw error;
}

// ---------- main ----------
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

  console.log("\n=== 示範空間模擬圖預熱 ===\n");

  log("讀取正式環境 active artwork…");
  const { data: artworks, error } = await supabase
    .from("products")
    .select("id, slug, name, images")
    .eq("product_type", "artwork")
    .eq("status", "active")
    .order("slug");
  if (error) {
    fail(`讀取作品清單失敗:${error.message}`);
    process.exitCode = 1;
    return;
  }
  ok(`共 ${artworks.length} 件 active artwork × ${DEMO_ROOMS.length} 個示範空間 = ${artworks.length * DEMO_ROOMS.length} 組`);

  let succeeded = 0;
  let skipped = 0;
  let failed = 0;
  const failedCombos = [];

  for (const product of artworks) {
    for (const roomSlug of DEMO_ROOMS) {
      const label = `${product.slug} × ${roomSlug}`;
      try {
        const sourceKey = await artworkImageSourceKey(product.slug, product);
        const cachePath = demoMockupCachePath(product.slug, roomSlug, sourceKey);

        if (await cacheExists(supabase, cachePath)) {
          ok(`已存在,跳過:${label}`);
          skipped++;
          continue;
        }

        log(`生成中:${label} → ${cachePath}`);
        const artworkImage = await resolveArtworkImageBytes(product.slug, product);
        const roomImage = await readRoomImage(roomSlug);
        const raw = await generateRoomMockupWithRetry({
          roomPhoto: roomImage,
          artwork: artworkImage,
          artworkName: product.name,
        });
        const watermarked = await watermarkMockup(raw);
        await uploadCache(supabase, cachePath, watermarked);
        ok(`完成:${label}`);
        succeeded++;
      } catch (err) {
        fail(`失敗:${label} — ${err.message}`);
        failed++;
        failedCombos.push(label);
      }
    }
  }

  console.log("\n=== 預熱結果 ===");
  console.log(`成功:${succeeded}　跳過(已存在):${skipped}　失敗:${failed}`);
  if (failedCombos.length) {
    console.log("失敗組合:");
    for (const c of failedCombos) console.log(`  - ${c}`);
    process.exitCode = 1;
  }
}

main();
