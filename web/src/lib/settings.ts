import { createAdminClient } from "@/lib/supabase/admin";
import type { RateCardItem } from "@/lib/types";

export type CompanyProfile = {
  name: string;
  tagline: string;
  email: string;
  phone: string;
  bank_info?: string; // 匯款資訊,顯示在銀行轉帳訂單頁
  about?: string;
  address?: string; // 門市地址(預約參訪頁用)
  hours?: string;   // 營業時間(預約參訪頁用)
};

export type QuoteConfig = {
  valid_days: number;
  tax_rate: number;
  followup_days: number;
};

export type ShippingConfig = {
  fee_home: number; // 宅配運費(NT$)
  free_threshold_home: number; // 宅配免運門檻(以實體商品小計計算)
  deadline_days: number; // 銀行轉帳訂單的繳費期限(天)
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
    name: "小時光 Little Moments",
    tagline: "為懂得生活的人，典藏值得停留的時光",
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

export async function getShippingConfig(): Promise<ShippingConfig> {
  return getSetting<ShippingConfig>("shipping", {
    fee_home: 200,
    free_threshold_home: 10000,
    deadline_days: 3,
  });
}
