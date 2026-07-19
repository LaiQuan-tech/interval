// 付款供應商介面:銀行轉帳/貨到付款走現行流程(createPayment 回 null,不轉導);
// 信用卡/ATM/超商代碼由 PChomePay 支付連處理(見 ./pchomepay.ts)。
export type PaymentOrder = {
  id: string;
  order_no: string;
  total: number;
  contact_name: string;
  contact_email: string;
  public_token: string;
  /** 顯示在 PChomePay 收銀台的品項名稱;未提供時退化為「小時光訂單 ${order_no}」 */
  itemName?: string;
};

export type PaymentResult = { redirectUrl: string };

// 刷卡選項是否可用:APP_ID/SECRET 之外,WEBHOOK_SECRET 也必須設定才算可用。
// 少了 WEBHOOK_SECRET,客戶會被收款成功、但 webhook 因驗不到密鑰一律 503,訂單永遠卡 pending
// (錢進金流商、點數/確認信全不發)——寧可整個不開放刷卡,也不要開放一個會卡單的刷卡。
export function isCardPaymentAvailable(): boolean {
  return Boolean(
    process.env.PCHOMEPAY_APP_ID &&
      process.env.PCHOMEPAY_SECRET &&
      process.env.PCHOMEPAY_WEBHOOK_SECRET
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

  const { createPchomePayment, pchomepayReturnUrl } = await import("./pchomepay");
  const { siteUrl } = await import("@/lib/resend");

  const { paymentUrl } = await createPchomePayment({
    orderNo: order.order_no,
    amount: order.total,
    buyerEmail: order.contact_email,
    itemName: order.itemName ?? `小時光訂單 ${order.order_no}`,
    returnUrl: pchomepayReturnUrl(order.order_no),
    // notify_url 帶上伺服器產生的密鑰(?k=),webhook route 進任何業務邏輯前先驗證這把
    // 密鑰 —— 沒有它,任何人都能對 webhook 端點偽造 order_paid 通知(見該檔開頭註解)。
    // 2026-07-19 沙盒實測:PChomePay 接受帶 query string 的 notify_url。
    notifyUrl: `${siteUrl()}/api/webhooks/pchomepay?k=${process.env.PCHOMEPAY_WEBHOOK_SECRET ?? ""}`,
  });
  return { redirectUrl: paymentUrl };
}
