import type { PaymentOrder, PaymentResult } from "./index";

// ECPay(綠界)AIO 金流 stub——尚未取得正式商店代號/金鑰前只預留介面,不做任何外部呼叫。
// 拿到 ECPAY_MERCHANT_ID / ECPAY_HASH_KEY / ECPAY_HASH_IV 後,依 ecpay skill(CheckMacValue 計算、
// AIO 訂單建立 API、webhook 驗簽)在此實作即可,結帳頁與 /api/orders 都已就緒,不需再動架構。
export async function createEcpayPayment(order: PaymentOrder): Promise<PaymentResult | null> {
  const merchantId = process.env.ECPAY_MERCHANT_ID;
  const hashKey = process.env.ECPAY_HASH_KEY;
  const hashIv = process.env.ECPAY_HASH_IV;
  if (!merchantId || !hashKey || !hashIv) return null;

  // TODO(ECPay 正式串接):以 order.id / order.total 建立 AIO 訂單,計算 CheckMacValue,
  // 回傳 { redirectUrl } 供前端轉導至綠界收銀台;webhook 另建 /api/payments/ecpay/notify。
  void order;
  return null;
}
