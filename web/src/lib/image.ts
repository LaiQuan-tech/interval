export type PendingImage = { dataUrl: string; base64: string; mime: string };

// client 端縮圖:最長邊 1536、jpeg 0.85,轉 base64(上傳量小、生成也快)
export async function resizeToJpeg(file: File): Promise<PendingImage> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("圖片載入失敗"));
      el.src = objectUrl;
    });
    const maxEdge = 1536;
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("此瀏覽器不支援圖片處理");
    ctx.drawImage(img, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    const base64 = dataUrl.split(",")[1] ?? "";
    if (!base64) throw new Error("圖片轉換失敗");
    return { dataUrl, base64, mime: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
