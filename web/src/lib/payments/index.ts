// 付款供應商介面預留:銀行轉帳/貨到付款走現行流程(createPayment 回 null,不轉導);
// 之後拿到 ECPay 正式金鑰後,依 ecpay skill 在 ecpay.ts 實作即可,不需再動結帳架構。
export type PaymentOrder = {
  id: string;
  order_no: string;
  total: number;
  contact_name: string;
  contact_email: string;
  public_token: string;
};

export type PaymentResult = { redirectUrl: string };

// 刷卡選項是否可用:僅在三個 ECPay env 都設定時才視為可用(現在必然回 false,checkout 不顯示刷卡選項)
export function isCardPaymentAvailable(): boolean {
  return Boolean(
    process.env.ECPAY_MERCHANT_ID && process.env.ECPAY_HASH_KEY && process.env.ECPAY_HASH_IV
  );
}

// bank_transfer / cod 一律回傳 null(沿用現行「站內顯示匯款資訊」流程);
// card 在金鑰未設定時 isCardPaymentAvailable() 已為 false,理論上不會有人送出 card,這裡再防一層。
export async function createPayment(
  paymentMethod: string,
  order: PaymentOrder
): Promise<PaymentResult | null> {
  if (paymentMethod !== "card") return null;
  if (!isCardPaymentAvailable()) return null;
  const { createEcpayPayment } = await import("./ecpay");
  return createEcpayPayment(order);
}
