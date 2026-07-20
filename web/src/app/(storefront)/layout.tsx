import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ChatWidget from "@/components/ChatWidget";
import CartFlyout from "@/components/CartFlyout";
import { getShippingConfig } from "@/lib/settings";

export default async function StorefrontLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const shippingConfig = await getShippingConfig();

  return (
    <>
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
    </>
  );
}
