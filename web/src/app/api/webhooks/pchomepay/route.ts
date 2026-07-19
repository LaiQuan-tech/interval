import { timingSafeEqual } from "node:crypto";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { queryPchomePayment } from "@/lib/payments/pchomepay";
import { markOrderPaid } from "@/lib/orders";

export const dynamic = "force-dynamic";

// 常數時間比對,避免以回應時間逐字元還原密鑰(密鑰非金流權威,但零成本防禦)。
function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * POST /api/webhooks/pchomepay — PChomePay 支付連 notify_url callback.
 *
 * PChomePay POSTs form-urlencoded:
 *   notify_type = order_confirm | order_paid | order_audit | order_expired
 *                 refund_pending | refund_success | refund_fail
 *   notify_message = <JSON string: { order_id, pay_type, status_code, payment_info, ... }>
 *
 * 安全性(兩層):
 *   1. 密鑰閘門 —— notify_url 建立時就附上 ?k=<PCHOMEPAY_WEBHOOK_SECRET>(見
 *      lib/payments/index.ts createPayment)。缺密鑰或不符,直接 404/503,連
 *      formData 都不解析,擋掉所有偽造/掃描式 POST。
 *   2. 反查 —— 密鑰只證明「來自我們自己核發的 notify_url」,notify body 本身依然
 *      沒有簽章欄位,金額/付款狀態一律以伺服器端反查 GET /v1/payment/<order_id>
 *      為準,不可用 notify body 的欄位直接判斷付款成功或失敗。
 *
 * PChomePay 要求回應 body 字面是 "success" 才不會重送;非 2xx 或非 success 內容都可能觸發重試。
 *
 * 冪等設計(不用預佔式 dedupe insert):
 *   - 訂單一旦是終態(paid/processing/shipped/completed)就直接 ack,不再打上游反查。
 *   - 真正的「恰好一次」保證來自 markOrderPaid 內建的條件式 update(CAS on
 *     status='pending')—— 並發的兩則 paid 通知都會通過終態短路(此時都還是
 *     pending)、都反查到 S、都呼叫 markOrderPaid,但只有第一個成功轉移狀態,
 *     第二個的條件式 update 落空,回傳 alreadyPaid 視為成功,不重複執行副作用。
 *   - webhook_events 表只用來存 `failed_<order_no>` marker,供 /api/orders/status
 *     判斷「確認中」還是「付款失敗」;不再用它做預佔式去重。
 *
 * interval 的 orders 表跟 realreal 不同,沒有獨立的 payments 表也沒有 payment_status 欄位
 * (訂單生命週期就是 orders.status 本身,pending/paid/processing/shipped/completed/cancelled,
 * 不含 "failed")。因此:
 *   - isPaid:直接對 orders 做條件式更新(經由 markOrderPaid,CAS + 冪等)。
 *   - isFailed:不去動 orders.status(沒有對應狀態可寫,寫了會違反 CHECK constraint),
 *     只在 webhook_events 留一筆正規化的 `failed_<order_no>` marker。訂單維持
 *     pending,等客戶重新導向付款或後台人工處理 —— 與現行 bank_transfer 逾期未繳
 *     的行為一致。
 */
export async function POST(req: Request) {
  // ---------- 密鑰閘門(在任何 body 解析或資料庫存取之前) ----------
  const webhookSecret = process.env.PCHOMEPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return new Response("service unavailable", { status: 503 });
  }
  const k = new URL(req.url).searchParams.get("k");
  if (!secretMatches(k, webhookSecret)) {
    return new Response("not found", { status: 404 });
  }

  const supabase = tryCreateAdminClient();
  if (!supabase) {
    return new Response("service unavailable", { status: 503 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return new Response("bad request", { status: 400 });
  }

  const notifyType = String(form.get("notify_type") ?? "");
  const notifyMessageRaw = String(form.get("notify_message") ?? "");
  if (!notifyType || !notifyMessageRaw) {
    return new Response("missing notify fields", { status: 400 });
  }

  let notifyMessage: { order_id?: string };
  try {
    notifyMessage = JSON.parse(notifyMessageRaw);
  } catch {
    return new Response("bad notify_message json", { status: 400 });
  }
  const orderNo = notifyMessage.order_id;
  if (!orderNo) {
    return new Response("missing order_id", { status: 400 });
  }

  // 用 gateway_tx_id(= PChomePay 的 order_id,建單時就已寫入)精確比對找單。
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_no, total, status")
    .eq("gateway_tx_id", orderNo)
    .maybeSingle();

  if (!order) {
    // 找不到對應訂單(測試通知、order_id 打錯,或密鑰外洩後的偽造 order_id):直接
    // ack,不打上游反查 —— 避免把反查端點當成可被利用的放大攻擊入口。
    return new Response("success");
  }

  const TERMINAL_STATUSES = new Set(["paid", "processing", "shipped", "completed"]);
  if (TERMINAL_STATUSES.has(order.status)) {
    // 訂單已是終態:這通常是同一筆付款的重送通知,直接 ack,不再打上游反查。
    return new Response("success");
  }

  // 反查(防偽造核心):notify body 本身沒有簽章,一律以此結果為準。
  let authoritative: { status?: string; statusCode?: string; amount?: number };
  try {
    authoritative = await queryPchomePayment(orderNo);
  } catch (err) {
    console.error("[webhooks/pchomepay] queryPayment failed:", err);
    // fail-closed:反查失敗就回 5xx 逼 PChomePay 重送,不能靜默 ack 放過
    // (否則真正完成的付款會卡在 pending 永遠沒人知道)。
    return new Response("queryPayment failed; please retry", { status: 500 });
  }

  const { status, statusCode, amount } = authoritative;
  // 2026-07-19 沙盒實測:未付款訂單反查 status 是 "W"(waiting),不是文件寫的 "P"。
  // isPaidSignal 刻意只認列出的明確值,W 或任何其他未知值一律不動作,讓後續 notify
  // (或客戶重新整理輪詢)有機會拿到最終結果。
  const isPaidNotifyType = notifyType === "order_paid" || notifyType === "order_confirm";
  const isPaidSignal = (s?: string) => s === "S" || s === "00" || s === "1";
  const isPaid = isPaidNotifyType && (isPaidSignal(status) || isPaidSignal(statusCode));
  // isFailed 只信反查權威結果,不信 notify_type(notify_type="order_expired" 本身可
  // 偽造,密鑰只證明來源是我們核發的 notify_url,不保證 body 欄位真實)。
  const isFailed = status === "F" || statusCode === "F";

  if (isPaid) {
    // amount 缺失(理論上反查一定會回,這裡是防禦性處理):不知道實收金額就不能放行,
    // fail-closed 記錄待人工對帳,不標 paid、也不佔用任何 key(下一次 notify 或反查
    // 仍能正常處理這筆訂單)。
    if (amount == null) {
      console.error(
        `[webhooks/pchomepay] order=${orderNo} isPaid 但反查未回傳 amount — 待對帳,暫不標 paid`
      );
      return new Response("success");
    }

    // 金額比對:反查金額與訂單應付金額不符(對到不同筆訂單、被竄改、或 gateway 資料
    // 異常)一律不標 paid,只記錄供人工對帳,並回 success 讓 PChomePay 不要一直重送。
    const collected = Math.round(Number(amount));
    const expected = Math.round(Number(order.total));
    if (collected !== expected) {
      console.error(
        `[webhooks/pchomepay] AMOUNT MISMATCH order=${orderNo} collected=${collected} expected=${expected} — NOT marking paid, needs reconcile`
      );
      return new Response("success");
    }

    const result = await markOrderPaid(order.id);
    if (!result.ok) {
      console.error("[webhooks/pchomepay] markOrderPaid failed:", result.error);
      return new Response("order update failed; please retry", { status: 500 });
    }
  } else if (isFailed) {
    // 已付款訂單不會被這裡動到(上面 TERMINAL_STATUSES 已經短路)。這裡完全不碰
    // orders.status(interval 的訂單狀態機沒有 failed,寫了會違反 CHECK constraint),
    // 只留一個正規化 marker 給 /api/orders/status 判斷「確認中」還是「付款失敗」。
    // order.status !== "paid" 是保險(理論上走到這裡不會是 paid,但多一層防呆)。
    if (order.status !== "paid") {
      const { error: markErr } = await supabase
        .from("webhook_events")
        .insert({ gateway: "pchomepay", event_key: `failed_${orderNo}` });
      if (markErr && markErr.code !== "23505") {
        console.error("[webhooks/pchomepay] failed-marker insert failed:", markErr);
      }
    }
  }
  // refund_* / order_audit 等其餘 notify_type,或反查結果是 "W"(等待中)等未決狀態:
  // 不做任何動作,單純 ack,等後續通知或狀態變化再處理。

  return new Response("success");
}
