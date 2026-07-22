// i18n 骨架:語系清單與預設值。
// 目前 middleware 尚未注入 x-locale(A2 才會做),所以 DEFAULT_LOCALE 是全站唯一
// 實際生效的語系——這保證 A1 對中文站完全 inert。

export type Locale = "zh" | "en";

export const LOCALES: Locale[] = ["zh", "en"];

export const DEFAULT_LOCALE: Locale = "zh";

export function isLocale(value: string): value is Locale {
  return (LOCALES as string[]).includes(value);
}
