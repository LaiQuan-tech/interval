import { tryCreateAdminClient } from "@/lib/supabase/admin";

// 對話圖片(客戶空間照 / AI 擺放模擬圖)的簽名網址單一來源。
// 前台(ChatWidget 上傳當下)與後台(報價詳情頁渲染歷史紀錄)都走這裡,避免邏輯漂移。
//
// 背景:chat-uploads bucket 已轉私密(見 migration 20260720000003),不能再用 getPublicUrl。
// 新資料存 imagePath;2026-07-20 之前的舊資料只有公開 imageUrl,由 pathFromLegacyUrl 反推路徑,
// 讓 bucket 轉私密後舊圖仍看得到。

const BUCKET = "chat-uploads";
const DEFAULT_EXPIRES_IN_SEC = 60 * 60; // 1 小時:後台看圖夠用,前台客戶當下就會看到

// 從舊格式的 chat-uploads 公開網址反推 storage 內路徑。
// 例:https://xxx.supabase.co/storage/v1/object/public/chat-uploads/rooms/uuid.jpg
//   -> rooms/uuid.jpg
// 取不出來(非這個 bucket 的公開網址格式)回 null。
export function pathFromLegacyUrl(url: string): string | null {
  const marker = `/object/public/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  const path = url.slice(idx + marker.length).split(/[?#]/)[0];
  return path || null;
}

// 用 service role 產生短期簽名網址。失敗一律回 null(不 throw)——
// 呼叫端(前台上傳流程、後台渲染歷史)都要能容忍缺圖,不可讓整頁/整個請求爆掉。
export async function signChatImage(
  path: string,
  expiresInSec: number = DEFAULT_EXPIRES_IN_SEC
): Promise<string | null> {
  const supabase = tryCreateAdminClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, expiresInSec);
    if (error || !data?.signedUrl) {
      if (error) console.error("[chat-images] createSignedUrl failed:", error.message);
      return null;
    }
    return data.signedUrl;
  } catch (err) {
    console.error("[chat-images] signChatImage failed:", err);
    return null;
  }
}

// 解析單則對話訊息附圖的可顯示網址。
// 優先順序:imagePath(新資料,直接簽名) → imageUrl 反推路徑後簽名(舊資料) → null(無圖或都失敗)。
//
// 前瞻相容:未來「示範空間」功能的訊息 imageUrl 會是相對路徑(如 /rooms/living-nordic.jpg),
// 不是 chat-uploads 的公開網址、也不需要簽名——原樣回傳即可,不要送進 pathFromLegacyUrl/signChatImage。
export async function resolveChatImageUrl(m: {
  imagePath?: string;
  imageUrl?: string;
}): Promise<string | null> {
  if (m.imagePath) {
    return signChatImage(m.imagePath);
  }
  if (m.imageUrl) {
    if (m.imageUrl.startsWith("/")) {
      // 相對路徑(如未來的示範空間圖):非 chat-uploads 網址,不簽名,原樣回傳。
      return m.imageUrl;
    }
    const legacyPath = pathFromLegacyUrl(m.imageUrl);
    if (legacyPath) return signChatImage(legacyPath);
  }
  return null;
}
