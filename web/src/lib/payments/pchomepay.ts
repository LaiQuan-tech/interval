import { siteUrl } from "@/lib/resend";

// PChomePay 支付連 API client(正式串接;金鑰為 production key,呼叫此檔任何 exported
// function 都是真實動作,測試時請勿誤觸)。
//
// 認證是兩段式(不是單一 Bearer token):
//   1. POST /v1/token,header Authorization: Basic base64(APP_ID:SECRET)
//      → { token, expired_timestamp(unix 秒) }
//   2. 之後所有呼叫用自訂 header `pcpay-token: <token>`(不是 Authorization: Bearer)
// token 存記憶體快取,過期前 60 秒重新取得。
//
// 沒有 HMAC/簽章機制 —— webhook 的安全性完全靠伺服器端反查(見
// /api/webhooks/pchomepay),此檔的 queryPchomePayment 就是那個反查用的函式。
//
// 2026-07-19 沙盒實測校正(覆蓋舊文件值):
//   * 未付款訂單反查 status 實際是 "W"(waiting),不是 "P"。
//   * amount 有下限,實測 amount<=30 會被拒(“amount must be greater than 30”)。
//   * createPayment 回應實際只有 { order_id, payment_url } 兩欄。
//   * 反查回應除了 status/status_code/amount 外還有其他欄位,本檔只取用到的兩者。

function getCreds() {
  const appId = process.env.PCHOMEPAY_APP_ID;
  const secret = process.env.PCHOMEPAY_SECRET;
  const isSandbox = process.env.PCHOMEPAY_SANDBOX === "true";
  const payTypesRaw = process.env.PCHOMEPAY_PAY_TYPES ?? "CARD";
  return {
    appId,
    secret,
    baseUrl: isSandbox
      ? "https://sandbox-api.pchomepay.com.tw"
      : "https://api.pchomepay.com.tw",
    payTypes: payTypesRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

interface CachedToken {
  value: string;
  /** Unix ms 到期時間(伺服器回傳的 expired_timestamp 換算而來) */
  expiresAt: number;
}
let tokenCache: CachedToken | null = null;

async function getToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.value;
  }

  const { appId, secret, baseUrl } = getCreds();
  if (!appId || !secret) {
    throw new Error("Missing PCHOMEPAY_APP_ID / PCHOMEPAY_SECRET");
  }

  const basic = Buffer.from(`${appId}:${secret}`).toString("base64");
  const res = await fetch(`${baseUrl}/v1/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${basic}`,
    },
    body: "{}",
  });

  if (!res.ok) {
    tokenCache = null;
    throw new Error(
      `PChomePay token exchange failed (HTTP ${res.status}): ${await res.text()}`
    );
  }

  const data = (await res.json()) as { token?: string; expired_timestamp?: number };
  if (!data.token) {
    tokenCache = null;
    throw new Error(`PChomePay token endpoint returned no token: ${JSON.stringify(data)}`);
  }
  const expiresAt =
    typeof data.expired_timestamp === "number"
      ? data.expired_timestamp * 1000
      : Date.now() + 25 * 60 * 1000;
  tokenCache = { value: data.token, expiresAt };
  return data.token;
}

export interface CreatePchomePaymentParams {
  orderNo: string;
  /** 整數 TWD。PChomePay 實測下限:須 > 30。 */
  amount: number;
  buyerEmail?: string;
  itemName: string;
  returnUrl: string;
  notifyUrl: string;
}

export async function createPchomePayment(
  params: CreatePchomePaymentParams
): Promise<{ paymentUrl: string }> {
  if (!Number.isFinite(params.amount) || params.amount < 31) {
    // 防呆:PChomePay 沙盒實測 amount<=30 會被 API 拒絕("amount must be greater than
    // 30")。好日子現有商品(作品最低 8,800 / 會員最低 3,600 / 旅程 12 萬+)都遠高於此,
    // 這裡先擋掉是為了未來萬一新增低價商品時不要直接炸在 gateway 呼叫上。
    throw new Error(`PChomePay 金額需大於 30 元(收到 ${params.amount})`);
  }

  const token = await getToken();
  const { baseUrl, payTypes } = getCreds();
  const body = {
    order_id: params.orderNo,
    pay_type: payTypes.length > 0 ? payTypes : ["CARD"],
    amount: Math.round(params.amount),
    return_url: params.returnUrl,
    notify_url: params.notifyUrl,
    items: [{ name: params.itemName, url: params.returnUrl }],
    buyer_email: params.buyerEmail || "noreply@gathertaiwan.com",
    atm_info: { expire_days: 3 },
  };

  const res = await fetch(`${baseUrl}/v1/payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "pcpay-token": token,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // token 可能剛好在快取有效期內過期(伺服器提早失效);清快取讓下一次重取。
    if (res.status === 401) tokenCache = null;
    throw new Error(
      `PChomePay create-payment failed (HTTP ${res.status}): ${await res.text()}`
    );
  }

  const data = (await res.json()) as { order_id?: string; payment_url?: string };
  if (!data.payment_url) {
    throw new Error(`PChomePay create-payment returned no payment_url: ${JSON.stringify(data)}`);
  }
  // payment_url 的 host 由 API 回應決定(沙盒/正式不同網域),不在此硬編。
  return { paymentUrl: data.payment_url };
}

export interface QueryPchomePaymentResult {
  /** "S"=成功 "F"=失敗 "W"=等待中(沙盒實測值,非文件上的 "P") */
  status?: string;
  statusCode?: string;
  /** 金流實際收到的金額(整數 TWD) */
  amount?: number;
}

/** 伺服器對伺服器反查 —— webhook 安全驗證的核心,一律以此結果為準,不信任 notify body。 */
export async function queryPchomePayment(orderNo: string): Promise<QueryPchomePaymentResult> {
  const token = await getToken();
  const { baseUrl } = getCreds();
  const res = await fetch(`${baseUrl}/v1/payment/${encodeURIComponent(orderNo)}`, {
    headers: { "pcpay-token": token },
  });
  if (!res.ok) {
    throw new Error(`PChomePay query-payment failed (HTTP ${res.status}): ${await res.text()}`);
  }
  const data = (await res.json()) as {
    status?: string;
    status_code?: string;
    amount?: number;
  };
  return { status: data.status, statusCode: data.status_code, amount: data.amount };
}

/** checkout/confirm 頁的 return_url 建構 helper,附上 ?order= 供輪詢用(PChomePay 導回時不帶參數)。 */
export function pchomepayReturnUrl(orderNo: string) {
  return `${siteUrl()}/checkout/confirm?order=${encodeURIComponent(orderNo)}`;
}
