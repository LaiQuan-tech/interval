import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import dns from "dns";
import net from "net";
import { createHash } from "crypto";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  generateMockupFollowup,
  generateRoomMockup,
  type ArtworkImage,
  type RoomPhoto,
} from "@/lib/ai";
import { watermarkMockup } from "@/lib/watermark";
import { getCompanyProfile } from "@/lib/settings";
import { signChatImage } from "@/lib/chat-images";
import type { ChatMessage } from "@/lib/types";

export const maxDuration = 60;
// 函式釘在東京(hnd1),與 Supabase(ap-northeast-1)同地。預設跑在美東(iad1),
// 快取命中要做的每次 DB/storage 往返都橫渡太平洋,實測讓 <1s 的命中變 2.6~4.3s。
export const preferredRegion = "hnd1";

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 8 * 1024 * 1024; // 8MB(client 已先縮圖到最長邊 1536)
const MAX_MOCKUPS_PER_SESSION = 6;
// 每 IP 每日模擬圖專屬額度:與 ai_rate_check 的文字聊天額度(每 IP 每日 60 次)分離。
// 一次模擬圖要呼叫 Gemini 影像模型,成本是文字聊天的數十倍;入口變顯眼(商品頁按鈕)後
// 必須另外把關,見下方 POST 內「每 IP 每日模擬圖上限」區塊。
const MAX_MOCKUPS_PER_IP_PER_DAY = 15;
const EXTERNAL_FETCH_TIMEOUT_MS = 10_000;

function friendly(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

// SSRF 基本防護:擋 loopback/私有網段/link-local,只讓外部圖片 URL 打到公開主機。
// 輸入來源是後台管理員填的圖片網址(非終端使用者直接輸入),風險本來就低,這裡是保底防護。
function isDisallowedIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
    if (a === 0) return true; // 0.0.0.0/8
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::1") return true; // loopback
    if (lower.startsWith("fe80:")) return true; // link-local
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // unique-local
    if (lower.startsWith("::ffff:")) {
      const v4 = lower.split(":").pop() ?? "";
      if (net.isIPv4(v4)) return isDisallowedIp(v4);
    }
    return false;
  }
  return true; // 認不得的格式一律擋
}

async function assertPublicHttpsUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("圖片網址格式錯誤");
  }
  if (url.protocol !== "https:") {
    throw new Error("圖片網址須為 https");
  }
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error("不允許的圖片網址");
  }
  if (net.isIP(hostname)) {
    if (isDisallowedIp(hostname)) throw new Error("不允許的圖片網址");
  } else {
    const records = await dns.promises.lookup(hostname, { all: true });
    if (records.length === 0 || records.some((r) => isDisallowedIp(r.address))) {
      throw new Error("不允許的圖片網址");
    }
  }
  return url;
}

// 讀後台填的圖片網址(product.images[0].url)。拒絕重新導向,避免繞過上面的主機檢查。
async function fetchExternalArtworkImage(rawUrl: string): Promise<ArtworkImage> {
  const url = await assertPublicHttpsUrl(rawUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXTERNAL_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal, redirect: "error" });
    if (!res.ok) throw new Error(`圖片下載失敗:${res.status}`);
    const mime = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!ALLOWED_MIME.has(mime)) {
      throw new Error(`圖片格式不支援:${mime || "unknown"}`);
    }
    const declaredLength = Number(res.headers.get("content-length") ?? "0");
    if (declaredLength > MAX_BYTES) {
      throw new Error("圖片檔案過大");
    }
    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_BYTES) {
      throw new Error("圖片檔案過大");
    }
    return { mime, base64: Buffer.from(arrayBuffer).toString("base64") };
  } finally {
    clearTimeout(timer);
  }
}

// 三層 fallback 取得作品原圖(供合成用):
//  1) 本機 public/artworks/<slug>.jpg(9 件種子作品,建置時打包進函式產物)
//  2) 後台填的 product.images[0].url(管理員新增的作品都走這層,可能是任何 mime)
//  3) 既有 fallback:fetch 自己網域的 /artworks/<slug>.jpg(理論上只有本機檔案系統失效時的保險)
async function readArtworkImage(
  slug: string,
  product: { images: { url: string }[] }
): Promise<ArtworkImage> {
  const localPath = path.join(process.cwd(), "public", "artworks", `${slug}.jpg`);
  try {
    const buf = await fs.readFile(localPath);
    return { mime: "image/jpeg", base64: buf.toString("base64") };
  } catch {
    /* 找不到本機檔,繼續往下層 */
  }

  const externalUrl = product.images?.[0]?.url;
  if (externalUrl) {
    try {
      return await fetchExternalArtworkImage(externalUrl);
    } catch (err) {
      console.error(`[chat/mockup] external artwork image failed (${slug}):`, err);
      /* 繼續 fallback 到自家網域 */
    }
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/artworks/${slug}.jpg`);
  if (!res.ok) {
    throw new Error(`無法讀取作品圖檔:${slug}`);
  }
  const arrayBuffer = await res.arrayBuffer();
  return { mime: "image/jpeg", base64: Buffer.from(arrayBuffer).toString("base64") };
}

// 示範空間白名單:客戶手邊沒有自家照片時可先選一張現成的室內照看效果。
// slug 一律比對這份白名單(Set.has 是精確字串相等,不做任何路徑拼接判斷),
// 不接受白名單以外的任何值 —— 避免 demoRoom 淪為可讀任意檔案的路徑穿越入口。
const DEMO_ROOMS = new Set([
  "living-nordic",
  "dining-warm-wood",
  "bedroom-minimal",
  "study-quiet",
]);

// 讀示範空間圖:隨 repo 進版控(public/rooms/<slug>.jpg,build 時打包進函式產物),不做 runtime 生成。
// 呼叫前 slug 必須已通過 DEMO_ROOMS.has() 檢查。
async function readDemoRoomImage(slug: string): Promise<RoomPhoto> {
  const localPath = path.join(process.cwd(), "public", "rooms", `${slug}.jpg`);
  const buf = await fs.readFile(localPath);
  return { mime: "image/jpeg", base64: buf.toString("base64") };
}

// ---------- 示範空間模擬圖預生成快取 ----------
// 示範空間組合有限(作品 × 4 個示範空間):同一組合先前已生成過就直接複用簽名網址,
// 不再呼叫 Gemini(單次呼叫實測 15~18 秒)。只影響 demoRoom 分支,上傳自家照片的路徑不受影響
// (每張都是新輸入,天生無法快取)。

// 快取鍵之一:作品圖來源字串的短 hash。判斷邏輯刻意對齊 readArtworkImage() 的前兩層
// (本機檔優先、其次後台填的網址)——只需要「這次會用哪個來源」的字串,不需要真的讀取內容。
// 管理員換了作品圖(不論是換本機檔案還是改後台網址)時,來源字串跟著變、雜湊值跟著變,
// 快取鍵自動失效,不會端出舊圖。
async function artworkImageSourceKey(
  slug: string,
  product: { images: { url: string }[] }
): Promise<string> {
  const localPath = path.join(process.cwd(), "public", "artworks", `${slug}.jpg`);
  try {
    await fs.access(localPath);
    return `local:${slug}`;
  } catch {
    /* 本機無此檔,往下看後台填的網址 */
  }
  const externalUrl = product.images?.[0]?.url;
  return externalUrl ? `url:${externalUrl}` : `local:${slug}`;
}

// 示範空間模擬圖的確定性快取路徑:同一(作品, 空間, 作品圖來源)組合永遠算出同一個路徑,
// 存在 chat-uploads bucket(與其他對話圖片同一個私密 bucket,讀取一律走簽名網址)。
function demoMockupCachePath(artworkSlug: string, roomSlug: string, sourceKey: string): string {
  const hash = createHash("sha1").update(sourceKey).digest("hex").slice(0, 8);
  return `demo-mockups/${artworkSlug}--${roomSlug}--${hash}.jpg`;
}

// 快取命中時的接續導購文案:刻意不呼叫 AI——gemma 一次文字呼叫要 1~3 秒,會吃掉「命中直接
// 回應」的意義。文字內容比照 generateMockupFollowup()(web/src/lib/ai.ts)裡無 AI key 時的
// fallback 模板;兩處各自維護一份是刻意的(避免這支 route 依賴 ai.ts 近期正在變動的其他區塊),
// 改一處記得回頭同步另一處。
function mockupFollowupFallback(params: {
  artworkName: string;
  monthlyPrice: number | null;
  buyoutPrice: number;
}): string {
  const { artworkName, monthlyPrice, buyoutPrice } = params;
  const priceLine = monthlyPrice
    ? `月租 NT$${monthlyPrice}、買斷 NT$${buyoutPrice}`
    : `買斷 NT$${buyoutPrice}`;
  return `這是《${artworkName}》掛在您空間裡的模擬效果,喜歡這樣的氛圍嗎?這件作品目前${priceLine},喜歡的話可以直接到藝術典藏頁加入購物車,選擇月租或買斷都很方便。`;
}

export async function POST(req: NextRequest) {
  let body: {
    sessionId?: string;
    artworkSlug?: string;
    image?: { mime?: string; base64?: string };
    demoRoom?: string;
  };
  try {
    body = await req.json();
  } catch {
    return friendly("格式錯誤");
  }

  const sessionId = String(body.sessionId ?? "").slice(0, 64);
  const artworkSlug = String(body.artworkSlug ?? "").slice(0, 200);
  const mime = String(body.image?.mime ?? "");
  const base64 = String(body.image?.base64 ?? "");
  const demoRoomSlug = String(body.demoRoom ?? "").slice(0, 100);

  if (!sessionId) return friendly("缺少 sessionId");
  if (!artworkSlug) return friendly("請選擇要模擬的作品");
  if (!base64 && !demoRoomSlug) return friendly("請上傳空間照片或選擇示範空間");

  // image(客戶實際上傳的居家照)與 demoRoom(示範空間白名單 slug)二擇一。
  // 兩者都給時以 image 為準:demoRoom 只是「手邊沒照片」時的替代方案,客戶既然已經上傳了
  // 自己的空間照片,代表更明確、更個人化的意圖,理應優先合成他自己的家。
  const useDemoRoom = Boolean(demoRoomSlug) && !base64;

  let roomPhoto: RoomPhoto;
  let roomBuffer: Buffer | null = null;

  if (useDemoRoom) {
    if (!DEMO_ROOMS.has(demoRoomSlug)) {
      return friendly("找不到這個示範空間,請重新選擇");
    }
    try {
      roomPhoto = await readDemoRoomImage(demoRoomSlug);
    } catch (err) {
      console.error(`[chat/mockup] demo room read failed (${demoRoomSlug}):`, err);
      return friendly("示範空間暫時無法使用,請稍後再試", 502);
    }
  } else {
    if (!ALLOWED_MIME.has(mime)) return friendly("圖片格式需為 JPEG/PNG/WebP");
    if (!base64) return friendly("缺少圖片內容");
    try {
      roomBuffer = Buffer.from(base64, "base64");
    } catch {
      return friendly("圖片內容無法解析");
    }
    if (roomBuffer.length === 0) return friendly("圖片內容無法解析");
    if (roomBuffer.length > MAX_BYTES) {
      return friendly("圖片檔案太大,請重新上傳(上限 8MB)");
    }
    roomPhoto = { mime, base64 };
  }

  const supabase = tryCreateAdminClient();
  if (!supabase) {
    return friendly("系統尚未完成設定,請稍後再試", 503);
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  // 限流:與聊天共用同一額度
  try {
    const { data: allowed } = await supabase.rpc("ai_rate_check", {
      p_ip: ip,
      p_ip_limit: 60,
      p_global_limit: 3000,
    });
    if (allowed === false) {
      return friendly("今日對話額度已用完,歡迎明天再來,或直接到商品頁逛逛!", 429);
    }
  } catch (err) {
    console.error("[chat/mockup] rate check failed:", err);
  }

  // 作品需為上架中的 artwork
  const { data: product } = await supabase
    .from("products")
    .select("id, name, price, price_rental_monthly, images")
    .eq("slug", artworkSlug)
    .eq("product_type", "artwork")
    .eq("status", "active")
    .maybeSingle();
  if (!product) {
    return friendly("找不到這件作品,請重新選擇");
  }

  // 登入使用者(可選,同 /api/chat)
  let userId: string | null = null;
  try {
    const userClient = await createClient();
    const { data } = await userClient.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    /* 未登入 */
  }

  // 讀既有對話紀錄,判斷此 session 是否已達每日模擬張數上限
  const { data: existingLog } = await supabase
    .from("ai_chat_logs")
    .select("messages")
    .eq("session_id", sessionId)
    .maybeSingle();
  const existingMessages = (existingLog?.messages ?? []) as ChatMessage[];

  // 示範空間快取命中檢查:必須放在下面兩道 mockup 專屬額度(session 6 張、IP 每日 15 張)之前——
  // 命中不花 AI 錢,不應該扣客戶額度。上面的 ai_rate_check(通用聊天防濫用)已照常執行過,不受影響。
  let demoCachePath: string | null = null;
  if (useDemoRoom) {
    const sourceKey = await artworkImageSourceKey(artworkSlug, product);
    demoCachePath = demoMockupCachePath(artworkSlug, demoRoomSlug, sourceKey);
    // 直接嘗試簽名網址當存在性檢查:物件不存在時 createSignedUrl 會回 error,這正是「快取未命中」
    // 的預期路徑,不當成錯誤記錄(避免每次未命中都在 log 灌一行雜訊)。
    const { data: cached } = await supabase.storage
      .from("chat-uploads")
      .createSignedUrl(demoCachePath, 60 * 60);
    if (cached?.signedUrl) {
      const roomUrl = `/rooms/${demoRoomSlug}.jpg`;
      const followupText = mockupFollowupFallback({
        artworkName: product.name,
        monthlyPrice: product.price_rental_monthly ?? null,
        buyoutPrice: product.price,
      });

      const nextMessages: ChatMessage[] = [
        ...existingMessages,
        { role: "user", content: "(選擇了示範空間)", imageUrl: roomUrl },
        { role: "assistant", content: followupText, imagePath: demoCachePath },
      ];
      try {
        await supabase.from("ai_chat_logs").upsert({
          session_id: sessionId,
          user_id: userId,
          messages: nextMessages,
          message_count: nextMessages.length,
          ip,
          user_agent: req.headers.get("user-agent") ?? "",
        });
      } catch (err) {
        console.error("[chat/mockup] log failed (cache hit):", err);
      }

      return NextResponse.json({
        ok: true,
        roomUrl,
        mockupUrl: cached.signedUrl,
        followupText,
        productId: product.id,
        price: product.price,
        priceRentalMonthly: product.price_rental_monthly,
      });
    }
  }

  const mockupCount = existingMessages.filter(
    (m) => m.role === "assistant" && Boolean(m.imageUrl || m.imagePath)
  ).length;
  if (mockupCount >= MAX_MOCKUPS_PER_SESSION) {
    return friendly(
      "這次對話已經幫您生成過幾張擺放模擬圖了,想看更多歡迎直接留下聯絡方式,我們安排專人為您服務!",
      429
    );
  }

  // 每 IP 每日模擬圖上限(獨立於前面 ai_rate_check 的文字聊天額度,不動那個 DB function 的
  // 簽名以免影響文字聊天)。計數來源是 ai_chat_logs:抓當日(row 的 created_at 落在今天 UTC)
  // 這個 IP 名下所有 session 的訊息,套用跟上面 mockupCount 一樣的判定邏輯
  // (role 為 assistant 且帶 imageUrl 或 imagePath——示範空間存 imageUrl、上傳自家照存
  // imagePath,兩種都要算,否則客戶能用示範空間無限刷)加總。
  const startOfTodayUtc = new Date();
  startOfTodayUtc.setUTCHours(0, 0, 0, 0);
  const { data: todayLogs, error: todayLogsError } = await supabase
    .from("ai_chat_logs")
    .select("messages")
    .eq("ip", ip)
    .gte("created_at", startOfTodayUtc.toISOString());
  if (todayLogsError) {
    console.error("[chat/mockup] daily mockup quota check failed:", todayLogsError);
  } else {
    const todayMockupCount = (todayLogs ?? []).reduce((sum, row) => {
      const rowMessages = (row.messages ?? []) as ChatMessage[];
      return (
        sum +
        rowMessages.filter((m) => m.role === "assistant" && Boolean(m.imageUrl || m.imagePath))
          .length
      );
    }, 0);
    if (todayMockupCount >= MAX_MOCKUPS_PER_IP_PER_DAY) {
      return friendly(
        "今天的居家擺放模擬額度已經用完囉,明天再來試試,或直接到商品頁逛逛先收藏喜歡的作品!",
        429
      );
    }
  }

  // 生成 + 浮水印
  let mockupBuffer: Buffer;
  try {
    const artwork = await readArtworkImage(artworkSlug, product);
    const rawMockup = await generateRoomMockup({
      roomPhoto,
      artwork,
      artworkName: product.name,
    });
    mockupBuffer = await watermarkMockup(rawMockup);
  } catch (err) {
    console.error("[chat/mockup] generation failed:", err);
    return friendly("模擬圖生成失敗,可能是網路忙碌,請稍後再試一次", 502);
  }

  // 上傳原圖與模擬圖(路徑用 uuid;bucket 已轉私密,讀取一律走簽名網址)
  // 示範空間圖本來就隨 repo 進版控、公開放在 public/rooms/ 底下,不是隱私資料,
  // 不需要(也不應該)再多存一份進私密 bucket——只上傳模擬合成結果即可。
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const roomPath = useDemoRoom ? null : `rooms/${uuid}.jpg`;
  // 示範空間:寫進上面快取檢查算出的確定性路徑(取代隨機 uuid 路徑),下一位客戶同組合才能命中。
  const mockupPath = useDemoRoom ? demoCachePath! : `mockups/${uuid}.jpg`;

  try {
    if (roomPath && roomBuffer) {
      const [roomUpload, mockupUpload] = await Promise.all([
        supabase.storage
          .from("chat-uploads")
          .upload(roomPath, roomBuffer, { contentType: mime, upsert: false }),
        supabase.storage
          .from("chat-uploads")
          .upload(mockupPath, mockupBuffer, { contentType: "image/jpeg", upsert: false }),
      ]);
      if (roomUpload.error) throw roomUpload.error;
      if (mockupUpload.error) throw mockupUpload.error;
    } else {
      // 這裡只會是 useDemoRoom 的情況(roomPath 才會是 null)。demoCachePath 是確定性路徑,
      // upsert:true 讓並發的兩個未命中請求(理論上少見但可能發生)不會互相踩到 409。
      const { error } = await supabase.storage
        .from("chat-uploads")
        .upload(mockupPath, mockupBuffer, { contentType: "image/jpeg", upsert: true });
      if (error) throw error;
    }
  } catch (err) {
    console.error("[chat/mockup] upload failed:", err);
    return friendly("圖片上傳失敗,請稍後再試一次", 502);
  }

  // bucket 已轉私密,不能再用 getPublicUrl——即時簽出短期網址讓客戶當下看得到圖。
  // 簽名失敗時回傳 null 是可接受的降級(訊息內容/導購話術仍照常回覆),不讓整支請求爆掉。
  // 示範空間圖是 public/ 底下的相對路徑,直接可用,不需要簽名。
  const [roomUrl, mockupUrl] = await Promise.all([
    useDemoRoom ? Promise.resolve(`/rooms/${demoRoomSlug}.jpg`) : signChatImage(roomPath!),
    signChatImage(mockupPath),
  ]);

  // 接續導購話術
  const company = await getCompanyProfile();
  let followupText: string;
  try {
    followupText = await generateMockupFollowup({
      artworkName: product.name,
      monthlyPrice: product.price_rental_monthly ?? null,
      buyoutPrice: product.price,
      company,
    });
  } catch (err) {
    console.error("[chat/mockup] followup generation failed:", err);
    followupText = `這是《${product.name}》掛在您空間裡的模擬效果,喜歡這樣的氛圍嗎?歡迎直接到藝術典藏頁把這件作品加入購物車,選擇月租或買斷下單。`;
  }

  // 落庫:append 兩則訊息進 ai_chat_logs.messages(存路徑不存網址,避免簽名網址過期後破圖)。
  // 示範空間例外:不是 chat-uploads 裡的私密路徑,直接存相對路徑進 imageUrl——
  // resolveChatImageUrl(見 lib/chat-images.ts)已原生支援「以 / 開頭就原樣回傳,不簽名」。
  const nextMessages: ChatMessage[] = [
    ...existingMessages,
    useDemoRoom
      ? { role: "user", content: "(選擇了示範空間)", imageUrl: `/rooms/${demoRoomSlug}.jpg` }
      : { role: "user", content: "(上傳了空間照片)", imagePath: roomPath! },
    { role: "assistant", content: followupText, imagePath: mockupPath },
  ];
  try {
    await supabase.from("ai_chat_logs").upsert({
      session_id: sessionId,
      user_id: userId,
      messages: nextMessages,
      message_count: nextMessages.length,
      ip,
      user_agent: req.headers.get("user-agent") ?? "",
    });
  } catch (err) {
    console.error("[chat/mockup] log failed:", err);
  }

  return NextResponse.json({
    ok: true,
    roomUrl,
    mockupUrl,
    followupText,
    productId: product.id,
    price: product.price,
    priceRentalMonthly: product.price_rental_monthly,
  });
}
