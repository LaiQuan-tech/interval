// Server component 用的 i18n 存取入口。
//
// getLocale() 讀 middleware 注入的 `x-locale` request header。
// A1 階段 middleware 完全還沒被改動(那是 A2 的事),所以這個 header 現在一定不存在,
// getLocale() 必然 fallback 回 DEFAULT_LOCALE("zh")——這是 A1 對中文站 inert 的保證來源。
import { headers } from "next/headers";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";
import { en, zh, type Messages } from "./messages";

const MESSAGES: Record<Locale, Messages> = { zh, en };

export async function getLocale(): Promise<Locale> {
  const requestHeaders = await headers();
  const raw = requestHeaders.get("x-locale");
  if (raw && isLocale(raw)) return raw;
  return DEFAULT_LOCALE;
}

export function getMessages(locale: Locale): Messages {
  return MESSAGES[locale];
}
