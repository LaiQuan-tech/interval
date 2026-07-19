export function formatTWD(amount: number) {
  return `NT$ ${amount.toLocaleString("zh-TW")}`;
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "待付款",
  paid: "已付款",
  processing: "備貨中",
  shipped: "已出貨",
  completed: "已完成",
  cancelled: "已取消",
};

export const QUOTE_STATUS_LABEL: Record<string, string> = {
  draft: "AI 草稿",
  sent: "已寄出",
  viewed: "已查看",
  accepted: "已接受",
  declined: "已婉拒",
  expired: "已過期",
  converted: "已轉訂單",
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  bank_transfer: "銀行轉帳",
  cod: "貨到付款",
  card: "信用卡",
  other: "其他",
};
