import { NextRequest, NextResponse } from "next/server";
import { acceptQuoteByToken } from "@/lib/quote";

export async function POST(req: NextRequest) {
  let token = "";
  try {
    const body = await req.json();
    token = String(body.token ?? "");
  } catch {
    return NextResponse.json({ error: "格式錯誤" }, { status: 400 });
  }
  if (!token) return NextResponse.json({ error: "缺少 token" }, { status: 400 });

  let result: Awaited<ReturnType<typeof acceptQuoteByToken>>;
  try {
    result = await acceptQuoteByToken(token);
  } catch (err) {
    console.error("[quote/accept] failed:", err);
    return NextResponse.json({ error: "系統尚未完成設定,請稍後再試" }, { status: 503 });
  }
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json({ orderToken: result.orderToken });
}
