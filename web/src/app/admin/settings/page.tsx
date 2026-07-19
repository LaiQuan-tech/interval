import { createAdminClient } from "@/lib/supabase/admin";
import SettingsForm from "@/components/admin/SettingsForm";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const db = createAdminClient();
  const { data } = await db.from("settings").select("key, value");
  const settings = Object.fromEntries((data ?? []).map((s) => [s.key, s.value]));

  return (
    <div className="max-w-2xl">
      <h2 className="mb-4 font-bold">網站設定</h2>
      <SettingsForm
        companyProfile={JSON.stringify(settings.company_profile ?? {}, null, 2)}
        rateCard={JSON.stringify(settings.rate_card ?? {}, null, 2)}
        quoteConfig={JSON.stringify(settings.quote_config ?? {}, null, 2)}
      />
    </div>
  );
}
