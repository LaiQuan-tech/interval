"use client";

// Client component 用的 i18n context。掛在 (storefront)/layout.tsx,供之後 phase
// 的 client 元件(ChatWidget/CartFlyout/CheckoutForm/MobileNav…)用 useTranslations()
// 取得目前 locale 與對應 messages。
//
// A1 階段 Provider 拿到的 locale 永遠是 server 端 getLocale() 算出的 "zh"(見 server.ts
// 的註解),所以這裡本身不影響任何現有渲染——只是提供 context,不輸出任何 DOM 節點。
import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { Locale } from "./config";
import { en, zh, type Messages } from "./messages";

const MESSAGES: Record<Locale, Messages> = { zh, en };

type I18nContextValue = {
  locale: Locale;
  messages: Messages;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const value = useMemo<I18nContextValue>(
    () => ({ locale, messages: MESSAGES[locale] }),
    [locale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// 用法:const { locale, messages } = useTranslations(); messages.nav.home
// 刻意在 Provider 外呼叫時直接拋錯(而非靜默 fallback 預設語系)——之後 phase 遷移
// client 元件到 i18n 時,忘記包 Provider 會在開發階段就爆出來,不會在 /en 上悄悄顯示錯語系。
export function useTranslations(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useTranslations() 必須在 <I18nProvider> 底下使用");
  }
  return ctx;
}
