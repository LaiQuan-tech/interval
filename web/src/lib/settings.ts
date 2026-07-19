import { createAdminClient } from "@/lib/supabase/admin";
import type { RateCardItem } from "@/lib/types";

export type CompanyProfile = {
  name: string;
  tagline: string;
  email: string;
  phone: string;
  bank_info?: string; // 匯款資訊,顯示在銀行轉帳訂單頁
  about?: string;
};

export type QuoteConfig = {
  valid_days: number;
  tax_rate: number;
  followup_days: number;
};

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("settings")
      .select("value")
      .eq("key", key)
      .maybeSingle();
    return (data?.value as T) ?? fallback;
  } catch {
    return fallback;
  }
}

export async function getCompanyProfile(): Promise<CompanyProfile> {
  return getSetting<CompanyProfile>("company_profile", {
    name: "interval",
    tagline: "賣到全世界",
    email: "",
    phone: "",
  });
}

export async function getRateCard(): Promise<{ note: string; items: RateCardItem[] }> {
  return getSetting("rate_card", { note: "", items: [] as RateCardItem[] });
}

export async function getQuoteConfig(): Promise<QuoteConfig> {
  return getSetting<QuoteConfig>("quote_config", {
    valid_days: 14,
    tax_rate: 0.05,
    followup_days: 3,
  });
}
