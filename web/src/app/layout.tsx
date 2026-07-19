import type { Metadata, Viewport } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ChatWidget from "@/components/ChatWidget";
import CartFlyout from "@/components/CartFlyout";
import { getShippingConfig } from "@/lib/settings";

export const metadata: Metadata = {
  title: {
    default: "小時光 Little Moments — 為懂得生活的人，典藏值得停留的時光",
    template: "%s | 小時光 Little Moments",
  },
  description:
    "小時光 Little Moments — 獨家 AI 藝術畫作租賃與買斷、量身訂製的私人旅程，以及三級會員點數禮遇。線下書店門市 × 線上藝術與旅程。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#faf6ee",
};

// 字體:採用與設計稿(dc.html)相同的 Google Fonts <link> 載入方式,
// 而非 next/font/google — 這三個 CJK 家族(Noto Serif/Sans TC)在目前
// next/font 的子集清單中不含 chinese-traditional,無法用 next/font 保證中文字形。
const FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Noto+Serif+TC:wght@300;400;500;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Noto+Sans+TC:wght@300;400;500&display=swap";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const shippingConfig = await getShippingConfig();

  return (
    <html lang="zh-Hant-TW">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={FONTS_URL} rel="stylesheet" />
      </head>
      <body className="flex min-h-dvh flex-col antialiased">
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
      </body>
    </html>
  );
}
