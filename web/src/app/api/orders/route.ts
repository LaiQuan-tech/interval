import { NextRequest, NextResponse } from "next/server";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { emailShell, notifyAdmin, sendMail, siteUrl } from "@/lib/resend";
import { getCompanyProfile, getShippingConfig } from "@/lib/settings";
import {
  formatDate,
  formatTWD,
  PAYMENT_METHOD_LABEL,
  PURCHASE_MODE_LABEL,
  SHIPPING_METHOD_LABEL,
} from "@/lib/format";
import { getPointsBalance, redeemPointsForOrder } from "@/lib/points";
import { createPayment, isCardPaymentAvailable } from "@/lib/payments";
import type { InvoiceType, PurchaseMode, ShippingMethod } from "@/lib/types";

const PHONE_RE = /^09\d{8}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CARRIER_RE = /^\/[0-9A-Z.+-]{7}$/;
const TAX_ID_RE = /^\d{8}$/;
const UNIQUE_VIOLATION = "23505";

type CheckoutItem = {
  productId: string;
  quantity: number;
  mode?: PurchaseMode;
};

type CheckoutBody = {
  items: CheckoutItem[];
  contact: {
    name: string;
    email: string;
    phone: string;
    note: string;
  };
  shipping?: {
    method?: string;
    county?: string;
    district?: string;
    postal?: string;
    detail?: string;
  };
  invoice?: {
    type?: string;
    carrier?: string;
    tax_id?: string;
    title?: string;
  };
  payment_method: string;
  pointsUsed?: number;
};

const VALID_MODES: PurchaseMode[] = ["buyout", "rental", "journey", "membership"];

// 依商品的 product_type 決定允許的購買模式與預設模式
function resolveMode(productType: string, requested?: PurchaseMode): PurchaseMode | null {
  if (productType === "artwork") {
    const mode = requested ?? "buyout";
    return mode === "buyout" || mode === "rental" ? mode : null;
  }
  if (productType === "journey") return "journey";
  if (productType === "membership") return "membership";
  return null;
}

export async function POST(req: NextRequest) {
  let body: CheckoutBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "格式錯誤" }, { status: 400 });
  }

  const supabase = tryCreateAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "系統尚未完成設定,請稍後再試" }, { status: 503 });
  }

  // Idempotency-Key:同一 key 已有訂單就直接回傳既有訂單,不重複建單、不報錯
  const idempotencyKey = req.headers.get("Idempotency-Key")?.trim().slice(0, 100) || null;
  if (idempotencyKey) {
    const { data: existing } = await supabase
      .from("orders")
      .select("public_token")
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ orderToken: existing.public_token });
    }
  }

  const items = (body.items ?? []).filter(
    (i) =>
      i?.productId &&
      Number.isInteger(i.quantity) &&
      i.quantity > 0 &&
      i.quantity <= 999 &&
      (i.mode === undefined || VALID_MODES.includes(i.mode))
  );
  const contact = body.contact;
  if (
    items.length === 0 ||
    !contact?.name?.trim() ||
    !EMAIL_RE.test(contact?.email?.trim() ?? "") ||
    !PHONE_RE.test(contact?.phone?.trim() ?? "")
  ) {
    return NextResponse.json({ error: "缺少必要欄位或格式錯誤" }, { status: 400 });
  }

  // 價格一律以資料庫為準,不信任前端
  const ids = items.map((i) => i.productId);
  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select(
      "id, name, price, price_rental_monthly, stock, status, product_type, metadata"
    )
    .in("id", ids);
  if (prodErr) {
    console.error("[orders] product load failed:", prodErr);
    return NextResponse.json({ error: "系統忙碌,請稍後再試" }, { status: 500 });
  }

  const productMap = new Map((products ?? []).map((p) => [p.id, p]));

  type ResolvedLine = {
    product_id: string;
    name: string;
    unit_price: number;
    quantity: number;
    purchase_mode: PurchaseMode;
    tier_slug: string | null;
  };
  const lineItems: ResolvedLine[] = [];

  for (const item of items) {
    const p = productMap.get(item.productId);
    if (!p || p.status !== "active") {
      return NextResponse.json({ error: "部分商品已下架,請重新整理購物車" }, { status: 409 });
    }
    const mode = resolveMode(p.product_type, item.mode);
    if (!mode) {
      return NextResponse.json({ error: `「${p.name}」不支援此購買模式` }, { status: 400 });
    }

    // 會員方案一次只能買一份(非計量商品)
    const quantity = mode === "membership" ? 1 : item.quantity;

    let unitPrice: number;
    if (mode === "rental") {
      if (p.price_rental_monthly == null) {
        return NextResponse.json({ error: `「${p.name}」尚未提供月租價` }, { status: 400 });
      }
      unitPrice = p.price_rental_monthly;
    } else {
      unitPrice = p.price;
    }

    // 庫存只對實體藝術品(買斷/月租)有意義;旅程與會員方案是服務類商品,不受庫存限制
    if (p.product_type === "artwork") {
      if (p.stock < quantity) {
        return NextResponse.json(
          { error: `「${p.name}」庫存不足(剩 ${p.stock} 件)` },
          { status: 409 }
        );
      }
    }

    const metadata = (p.metadata ?? {}) as Record<string, unknown>;
    const tierSlug = mode === "membership" ? (metadata.tier_slug as string | undefined) ?? null : null;

    lineItems.push({
      product_id: p.id,
      name: p.name,
      unit_price: unitPrice,
      quantity,
      purchase_mode: mode,
      tier_slug: tierSlug,
    });
  }

  const subtotal = lineItems.reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const hasPhysical = lineItems.some(
    (i) => i.purchase_mode === "buyout" || i.purchase_mode === "rental"
  );

  const [company, shippingConfig] = await Promise.all([getCompanyProfile(), getShippingConfig()]);

  // ---------- 收件方式 + 運費(伺服器算,不信任前端) ----------
  let shippingMethod: ShippingMethod;
  let shippingAddress = "";
  let shippingFee = 0;

  if (!hasPhysical) {
    shippingMethod = "none";
  } else {
    const requestedMethod = body.shipping?.method;
    if (requestedMethod !== "home" && requestedMethod !== "pickup") {
      return NextResponse.json({ error: "請選擇收件方式" }, { status: 400 });
    }
    shippingMethod = requestedMethod;

    if (shippingMethod === "pickup") {
      shippingAddress = company.address ?? "";
      shippingFee = 0;
    } else {
      const county = (body.shipping?.county ?? "").trim().slice(0, 20);
      const district = (body.shipping?.district ?? "").trim().slice(0, 30);
      const postal = (body.shipping?.postal ?? "").trim().slice(0, 10);
      const detail = (body.shipping?.detail ?? "").trim().slice(0, 200);
      if (!county || !district || !detail) {
        return NextResponse.json({ error: "請填寫完整收件地址" }, { status: 400 });
      }
      shippingAddress = `${postal ? postal + " " : ""}${county}${district}${detail}`.slice(0, 300);

      const physicalSubtotal = lineItems
        .filter((i) => i.purchase_mode === "buyout" || i.purchase_mode === "rental")
        .reduce((s, i) => s + i.unit_price * i.quantity, 0);
      shippingFee =
        physicalSubtotal >= shippingConfig.free_threshold_home ? 0 : shippingConfig.fee_home;
    }
  }

  // ---------- 發票(收欄位先存檔不開立) ----------
  const requestedInvoiceType: InvoiceType =
    body.invoice?.type === "company" ? "company" : "personal";
  let invoice: { type: InvoiceType; carrier?: string; tax_id?: string; title?: string };
  if (requestedInvoiceType === "company") {
    const taxId = (body.invoice?.tax_id ?? "").trim();
    const title = (body.invoice?.title ?? "").trim().slice(0, 100);
    if (!TAX_ID_RE.test(taxId) || !title) {
      return NextResponse.json({ error: "請填寫正確的統一編號與公司抬頭" }, { status: 400 });
    }
    invoice = { type: "company", tax_id: taxId, title };
  } else {
    const carrier = (body.invoice?.carrier ?? "").trim().slice(0, 20);
    if (carrier && !CARRIER_RE.test(carrier)) {
      return NextResponse.json({ error: "手機條碼格式錯誤" }, { status: 400 });
    }
    invoice = { type: "personal", ...(carrier ? { carrier } : {}) };
  }

  // ---------- 付款方式 ----------
  const requestedPayment = body.payment_method;
  let paymentMethod: string;
  if (requestedPayment === "card") {
    if (!isCardPaymentAvailable()) {
      return NextResponse.json({ error: "刷卡功能尚未開放,請選擇其他付款方式" }, { status: 400 });
    }
    paymentMethod = "card";
  } else if (["bank_transfer", "cod"].includes(requestedPayment)) {
    paymentMethod = requestedPayment;
  } else {
    paymentMethod = "bank_transfer";
  }

  // 登入使用者綁定訂單
  let userId: string | null = null;
  try {
    const userClient = await createClient();
    const { data } = await userClient.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    /* 未登入照樣可下單 */
  }

  // 點數折抵(1 點 = NT$1,僅登入會員可用,上限為 min(餘額, 商品小計))
  const requestedPoints = Number(body.pointsUsed ?? 0);
  let pointsUsed = 0;
  if (requestedPoints > 0) {
    if (!Number.isInteger(requestedPoints)) {
      return NextResponse.json({ error: "點數格式錯誤" }, { status: 400 });
    }
    if (!userId) {
      return NextResponse.json({ error: "登入後才能使用點數折抵" }, { status: 400 });
    }
    const { balance } = await getPointsBalance(userId);
    if (requestedPoints > balance) {
      return NextResponse.json({ error: "點數餘額不足" }, { status: 400 });
    }
    if (requestedPoints > subtotal) {
      return NextResponse.json({ error: "折抵點數不可超過商品小計" }, { status: 400 });
    }
    pointsUsed = requestedPoints;
  }

  const total = Math.max(0, subtotal + shippingFee - pointsUsed);

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      user_id: userId,
      status: "pending",
      subtotal,
      shipping_fee: shippingFee,
      total,
      points_used: pointsUsed,
      contact_name: contact.name.slice(0, 100),
      contact_email: contact.email.slice(0, 200),
      contact_phone: contact.phone.slice(0, 50),
      shipping_address: shippingAddress,
      shipping_method: shippingMethod,
      invoice,
      payment_method: paymentMethod,
      note: (contact.note ?? "").slice(0, 1000),
      idempotency_key: idempotencyKey,
    })
    .select("*")
    .single();

  if (orderErr || !order) {
    // 併發下同一 Idempotency-Key 兩個請求都通過了前面的預查 → 其中一個會撞 unique 衝突,
    // 回傳既有訂單而不是報錯,確保重試/雙擊永遠拿到同一張訂單
    if (orderErr?.code === UNIQUE_VIOLATION && idempotencyKey) {
      const { data: raced } = await supabase
        .from("orders")
        .select("public_token")
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (raced) {
        return NextResponse.json({ orderToken: raced.public_token });
      }
    }
    console.error("[orders] insert failed:", orderErr);
    return NextResponse.json({ error: "訂單建立失敗" }, { status: 500 });
  }

  const { error: itemsErr } = await supabase
    .from("order_items")
    .insert(lineItems.map((i) => ({ ...i, order_id: order.id })));
  if (itemsErr) {
    console.error("[orders] items insert failed:", itemsErr);
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: "訂單建立失敗" }, { status: 500 });
  }

  // 扣點數(server 端已驗證餘額;冪等靠 points_ledger unique index)
  if (pointsUsed > 0 && userId) {
    const redeemResult = await redeemPointsForOrder(userId, order.id, pointsUsed);
    if (!redeemResult.ok) {
      console.error("[orders] points redeem failed after order created:", redeemResult.error);
    }
  }

  // 扣庫存(僅實體藝術品;簡化版:逐筆條件更新)
  for (const line of lineItems) {
    const p = productMap.get(line.product_id)!;
    if (p.product_type !== "artwork") continue;
    await supabase
      .from("products")
      .update({ stock: p.stock - line.quantity })
      .eq("id", p.id)
      .gte("stock", line.quantity);
  }

  // ECPay 介面預留:bank_transfer/cod 一律回 null,走現行流程;card 目前金鑰未設定同樣回 null
  const paymentResult = await createPayment(paymentMethod, {
    id: order.id,
    order_no: order.order_no,
    total: order.total,
    contact_name: order.contact_name,
    contact_email: order.contact_email,
    public_token: order.public_token,
  });

  // 通知信
  const itemRows = lineItems
    .map(
      (i) =>
        `<tr><td style="padding:6px 0;">${i.name}(${PURCHASE_MODE_LABEL[i.purchase_mode]}) × ${i.quantity}</td><td style="text-align:right;">${formatTWD(i.unit_price * i.quantity)}</td></tr>`
    )
    .join("");
  const shippingRow =
    shippingFee > 0
      ? `<tr><td style="padding:6px 0;">運費(${SHIPPING_METHOD_LABEL[shippingMethod]})</td><td style="text-align:right;">${formatTWD(shippingFee)}</td></tr>`
      : "";
  const pointsRow =
    pointsUsed > 0
      ? `<tr><td style="padding:6px 0;">點數折抵</td><td style="text-align:right;">-${formatTWD(pointsUsed)}</td></tr>`
      : "";
  const deadline = new Date(order.created_at);
  deadline.setDate(deadline.getDate() + shippingConfig.deadline_days);
  const bankInfo =
    paymentMethod === "bank_transfer" && company.bank_info
      ? `<p style="background:#f4ede0;border-radius:4px;padding:12px;margin-top:16px;">匯款資訊:<br/>${company.bank_info.replace(/\n/g, "<br/>")}
         <br/>應付金額:${formatTWD(order.total)}<br/>匯款期限:${formatDate(deadline)} 前</p>`
      : "";

  await sendMail({
    to: order.contact_email,
    subject: `【小時光】訂單成立 ${order.order_no}`,
    html: emailShell(
      `訂單 ${order.order_no} 已成立`,
      `<p>${order.contact_name} 您好,感謝您的訂購!</p>
       <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:8px;">${itemRows}${shippingRow}${pointsRow}</table>
       <p style="font-weight:700;margin-top:12px;">合計 ${formatTWD(order.total)}(${PAYMENT_METHOD_LABEL[paymentMethod]})</p>
       ${bankInfo}
       <p style="margin-top:16px;"><a href="${siteUrl()}/orders/${order.public_token}">查看訂單狀態</a></p>`
    ),
  });
  await notifyAdmin(
    `新訂單 ${order.order_no}(${formatTWD(order.total)})`,
    emailShell(
      "收到新訂單",
      `<p>${order.contact_name} / ${order.contact_email} / ${order.contact_phone}</p>
       <table style="width:100%;border-collapse:collapse;font-size:14px;">${itemRows}${shippingRow}${pointsRow}</table>
       <p style="font-weight:700;">合計 ${formatTWD(order.total)}(${PAYMENT_METHOD_LABEL[paymentMethod]})</p>
       <p><a href="${siteUrl()}/admin/orders/${order.id}">前往後台處理</a></p>`
    )
  );

  return NextResponse.json({
    orderToken: order.public_token,
    ...(paymentResult ? { redirectUrl: paymentResult.redirectUrl } : {}),
  });
}
