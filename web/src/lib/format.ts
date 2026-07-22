import type { Locale } from "@/lib/i18n/config";

export function formatTWD(amount: number, locale: Locale = "zh") {
  return `NT$ ${amount.toLocaleString(locale === "en" ? "en-US" : "zh-TW")}`;
}

export function formatDate(
  value: string | Date | null | undefined,
  locale: Locale = "zh",
) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString(locale === "en" ? "en-US" : "zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatDateTime(
  value: string | Date | null | undefined,
  locale: Locale = "zh",
) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString(locale === "en" ? "en-US" : "zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 存取器:locale === "en" 回英文 map 值,否則(含未知 locale)一律回中文。
// admin 呼叫點永遠不傳 locale(或傳 "zh")→ 保證後台永遠中文。
function label<T extends string>(
  zhMap: Record<T, string>,
  enMap: Record<T, string>,
  key: T,
  locale: Locale = "zh",
): string {
  return locale === "en" ? (enMap[key] ?? zhMap[key]) : zhMap[key];
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "待付款",
  paid: "已付款",
  processing: "備貨中",
  shipped: "已出貨",
  completed: "已完成",
  cancelled: "已取消",
};

export const ORDER_STATUS_LABEL_EN: Record<string, string> = {
  pending: "Pending Payment",
  paid: "Paid",
  processing: "Processing",
  shipped: "Shipped",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function getOrderStatusLabel(key: string, locale: Locale = "zh") {
  return label(ORDER_STATUS_LABEL, ORDER_STATUS_LABEL_EN, key, locale);
}

export const QUOTE_STATUS_LABEL: Record<string, string> = {
  draft: "AI 草稿",
  sent: "已寄出",
  viewed: "已查看",
  accepted: "已接受",
  declined: "已婉拒",
  expired: "已過期",
  converted: "已轉訂單",
};

export const QUOTE_STATUS_LABEL_EN: Record<string, string> = {
  draft: "AI Draft",
  sent: "Sent",
  viewed: "Viewed",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
  converted: "Converted to Order",
};

export function getQuoteStatusLabel(key: string, locale: Locale = "zh") {
  return label(QUOTE_STATUS_LABEL, QUOTE_STATUS_LABEL_EN, key, locale);
}

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  bank_transfer: "銀行轉帳",
  cod: "貨到付款",
  card: "信用卡",
  other: "其他",
};

export const PAYMENT_METHOD_LABEL_EN: Record<string, string> = {
  bank_transfer: "Bank Transfer",
  cod: "Cash on Delivery",
  card: "Credit Card",
  other: "Other",
};

export function getPaymentMethodLabel(key: string, locale: Locale = "zh") {
  return label(PAYMENT_METHOD_LABEL, PAYMENT_METHOD_LABEL_EN, key, locale);
}

export const PURCHASE_MODE_LABEL: Record<string, string> = {
  buyout: "買斷",
  rental: "月租",
  journey: "私人旅程",
  membership: "會員方案",
};

export const PURCHASE_MODE_LABEL_EN: Record<string, string> = {
  buyout: "Buyout",
  rental: "Monthly Rental",
  journey: "Private Journey",
  membership: "Membership",
};

export function getPurchaseModeLabel(key: string, locale: Locale = "zh") {
  return label(PURCHASE_MODE_LABEL, PURCHASE_MODE_LABEL_EN, key, locale);
}

export const SHIPPING_METHOD_LABEL: Record<string, string> = {
  home: "宅配到府",
  pickup: "門市自取",
  none: "無需配送",
};

export const SHIPPING_METHOD_LABEL_EN: Record<string, string> = {
  home: "Home Delivery",
  pickup: "Store Pickup",
  none: "No Shipping Required",
};

export function getShippingMethodLabel(key: string, locale: Locale = "zh") {
  return label(SHIPPING_METHOD_LABEL, SHIPPING_METHOD_LABEL_EN, key, locale);
}

export const INVOICE_TYPE_LABEL: Record<string, string> = {
  personal: "個人(雲端發票)",
  company: "公司(統編發票)",
};

export const INVOICE_TYPE_LABEL_EN: Record<string, string> = {
  personal: "Individual (E-Invoice)",
  company: "Company (Tax ID Invoice)",
};

export function getInvoiceTypeLabel(key: string, locale: Locale = "zh") {
  return label(INVOICE_TYPE_LABEL, INVOICE_TYPE_LABEL_EN, key, locale);
}

export const BOOKING_STATUS_LABEL: Record<string, string> = {
  new: "待處理",
  confirmed: "已確認",
  done: "已完成",
  cancelled: "已取消",
};

export const BOOKING_STATUS_LABEL_EN: Record<string, string> = {
  new: "Pending",
  confirmed: "Confirmed",
  done: "Completed",
  cancelled: "Cancelled",
};

export function getBookingStatusLabel(key: string, locale: Locale = "zh") {
  return label(BOOKING_STATUS_LABEL, BOOKING_STATUS_LABEL_EN, key, locale);
}

export function formatPoints(points: number, locale: Locale = "zh") {
  return locale === "en"
    ? `${points.toLocaleString("en-US")} pts`
    : `${points.toLocaleString("zh-TW")} 點`;
}
