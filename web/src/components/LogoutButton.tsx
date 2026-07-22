"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/lib/i18n/config";
import { localeHref } from "@/lib/i18n/href";

// 共用元件:storefront /account 與 admin(AdminSidebar/AdminBottomNav)都會 render。
// admin 目前沒有包 I18nProvider,所以這裡刻意不用 useTranslations() context(呼叫會拋錯),
// 改用獨立的最小 locale map,由呼叫端自行決定 locale——admin 呼叫端不傳(預設 "zh"),
// 保證後台永遠中文;storefront /account 由 server component 算好 locale 後傳入。
const LABEL: Record<Locale, string> = { zh: "登出", en: "Log Out" };

export default function LogoutButton({ locale = "zh" }: { locale?: Locale }) {
  const router = useRouter();

  return (
    <button
      className="iv-btn-ghost !min-h-9 !px-4 !py-1.5 text-sm"
      onClick={async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push(localeHref("/", locale));
        router.refresh();
      }}
    >
      {LABEL[locale]}
    </button>
  );
}
