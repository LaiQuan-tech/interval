import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateMockupFollowup, generateRoomMockup } from "@/lib/ai";
import { watermarkMockup } from "@/lib/watermark";
import { getCompanyProfile } from "@/lib/settings";
import { signChatImage } from "@/lib/chat-images";
import type { ChatMessage } from "@/lib/types";

export const maxDuration = 60;

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 8 * 1024 * 1024; // 8MB(client 已先縮圖到最長邊 1536)
const MAX_MOCKUPS_PER_SESSION = 3;

function friendly(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

async function readArtworkJpg(slug: string): Promise<Buffer> {
  // 優先走本機檔案系統(Vercel build 會把 public/ 一併打進函式產物);
  // 讀不到就 fallback 用 fetch 打自己的網域,確保 serverless 環境也能拿到圖檔。
  const localPath = path.join(process.cwd(), "public", "artworks", `${slug}.jpg`);
  try {
    return await fs.readFile(localPath);
  } catch {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const res = await fetch(`${base}/artworks/${slug}.jpg`);
    if (!res.ok) {
      throw new Error(`無法讀取作品圖檔:${slug}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}

export async function POST(req: NextRequest) {
  let body: {
    sessionId?: string;
    artworkSlug?: string;
    image?: { mime?: string; base64?: string };
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

  if (!sessionId) return friendly("缺少 sessionId");
  if (!artworkSlug) return friendly("請選擇要模擬的作品");
  if (!ALLOWED_MIME.has(mime)) return friendly("圖片格式需為 JPEG/PNG/WebP");
  if (!base64) return friendly("缺少圖片內容");

  let roomBuffer: Buffer;
  try {
    roomBuffer = Buffer.from(base64, "base64");
  } catch {
    return friendly("圖片內容無法解析");
  }
  if (roomBuffer.length === 0) return friendly("圖片內容無法解析");
  if (roomBuffer.length > MAX_BYTES) {
    return friendly("圖片檔案太大,請重新上傳(上限 8MB)");
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
    .select("name, price, price_rental_monthly")
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
  const mockupCount = existingMessages.filter(
    (m) => m.role === "assistant" && Boolean(m.imageUrl || m.imagePath)
  ).length;
  if (mockupCount >= MAX_MOCKUPS_PER_SESSION) {
    return friendly(
      "這次對話已經幫您生成過幾張擺放模擬圖了,想看更多歡迎直接留下聯絡方式,我們安排專人為您服務!",
      429
    );
  }

  // 生成 + 浮水印
  let mockupBuffer: Buffer;
  try {
    const artworkJpg = await readArtworkJpg(artworkSlug);
    const rawMockup = await generateRoomMockup({
      roomPhoto: { mime, base64 },
      artworkJpg,
      artworkName: product.name,
    });
    mockupBuffer = await watermarkMockup(rawMockup);
  } catch (err) {
    console.error("[chat/mockup] generation failed:", err);
    return friendly("模擬圖生成失敗,可能是網路忙碌,請稍後再試一次", 502);
  }

  // 上傳原圖與模擬圖(路徑用 uuid;bucket 已轉私密,讀取一律走簽名網址)
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const roomPath = `rooms/${uuid}.jpg`;
  const mockupPath = `mockups/${uuid}.jpg`;

  try {
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
  } catch (err) {
    console.error("[chat/mockup] upload failed:", err);
    return friendly("圖片上傳失敗,請稍後再試一次", 502);
  }

  // bucket 已轉私密,不能再用 getPublicUrl——即時簽出短期網址讓客戶當下看得到圖。
  // 簽名失敗時回傳 null 是可接受的降級(訊息內容/導購話術仍照常回覆),不讓整支請求爆掉。
  const [roomUrl, mockupUrl] = await Promise.all([
    signChatImage(roomPath),
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
    followupText = `這是《${product.name}》掛在您空間裡的模擬效果,喜歡這樣的氛圍嗎?想直接下單或需要正式報價單都歡迎告訴我。`;
  }

  // 落庫:append 兩則訊息進 ai_chat_logs.messages(存路徑不存網址,避免簽名網址過期後破圖)
  const nextMessages: ChatMessage[] = [
    ...existingMessages,
    { role: "user", content: "(上傳了空間照片)", imagePath: roomPath },
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

  return NextResponse.json({ ok: true, roomUrl, mockupUrl, followupText });
}
