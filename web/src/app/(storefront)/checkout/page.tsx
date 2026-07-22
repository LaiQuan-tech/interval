import type { Metadata } from "next";
import CheckoutForm from "@/components/CheckoutForm";
import { createClient } from "@/lib/supabase/server";
import { getPointsBalance } from "@/lib/points";
import { getCompanyProfile, getShippingConfig } from "@/lib/settings";
import { isCardPaymentAvailable } from "@/lib/payments";
import { getLocale, getMessages } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const messages = getMessages(await getLocale());
  return { title: messages.checkout.title };
}

export default async function CheckoutPage() {
  let isLoggedIn = false;
  let pointsBalance = 0;
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      isLoggedIn = true;
      const { balance } = await getPointsBalance(data.user.id);
      pointsBalance = balance;
    }
  } catch {
    /* env 未設定 */
  }

  const [company, shippingConfig] = await Promise.all([getCompanyProfile(), getShippingConfig()]);

  return (
    <CheckoutForm
      isLoggedIn={isLoggedIn}
      pointsBalance={pointsBalance}
      company={company}
      shippingConfig={shippingConfig}
      cardPaymentAvailable={isCardPaymentAvailable()}
    />
  );
}
