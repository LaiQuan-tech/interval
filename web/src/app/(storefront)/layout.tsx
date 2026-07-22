import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ChatWidget from "@/components/ChatWidget";
import CartFlyout from "@/components/CartFlyout";
import { getShippingConfig } from "@/lib/settings";
import { getLocale } from "@/lib/i18n/server";
import { I18nProvider } from "@/lib/i18n/context";

export default async function StorefrontLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [shippingConfig, locale] = await Promise.all([
    getShippingConfig(),
    getLocale(),
  ]);

  // I18nProvider 只提供 React context,不輸出任何 DOM 節點;locale 現階段
  // 必為 "zh"(見 lib/i18n/server.ts),所以以下渲染結構與文字與改動前逐字元相同。
  return (
    <I18nProvider locale={locale}>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <ChatWidget />
      <CartFlyout
        shippingConfig={{
          fee_home: shippingConfig.fee_home,
          free_threshold_home: shippingConfig.free_threshold_home,
        }}
      />
    </I18nProvider>
  );
}
