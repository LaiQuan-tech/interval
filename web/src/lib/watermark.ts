import sharp from "sharp";

// 為 AI 擺放模擬圖疊上浮水印:右下角半透明文字(白字深色描邊,深淺底皆可辨識),
// 輸出統一轉為 jpeg 以縮小檔案。
export async function watermarkMockup(imageBuffer: Buffer): Promise<Buffer> {
  const image = sharp(imageBuffer).rotate(); // 依 EXIF 校正方向,避免合成後歪斜
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
