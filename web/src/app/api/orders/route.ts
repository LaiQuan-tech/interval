import { NextRequest, NextResponse } from "next/server";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { emailShell, notifyAdmin, sendMail, siteUrl } from "@/lib/resend";
import { getCompanyProfile } from "@/lib/settings";
import { formatTWD, PAYMENT_METHOD_LABEL, PURCHASE_MODE_LABEL } from "@/lib/format";
import { getPointsBalance, redeemPointsForOrder } from "@/lib/points";
import type { PurchaseMode } from "@/lib/types";

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
    address: string;
    payment_method: string;
    note: string;
  };
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

  const items = (body.items ?? []).filter(
    (i) =>
      i?.productId &&
      Number.isInteger(i.quantity) &&
      i.quantity > 0 &&
      i.quantity <= 999 &&
      (i.mode === undefined || VALID_MODES.includes(i.mode))
  );
  const contact = body.contact;
  if (items.length === 0 || !contact?.name || !contact?.email || !contact?.phone || !contact?.address) {
    return NextResponse.json({ error: "缺少必要欄位" }, { status: 400 });
  }
  const paymentMethod = ["bank_transfer", "cod"].includes(contact.payment_method)
    ? contact.payment_method
    : "bank_transfer";

  const supabase = tryCreateAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "系統尚未完成設定,請稍後再試" }, { status: 503 });
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
  const shippingFee = 0; // 政策:免運(之後可依 settings 調整)

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
      shipping_address: contact.address.slice(0, 300),
      payment_method: paymentMethod,
      note: (contact.note ?? "").slice(0, 1000),
    })
    .select("*")
    .single();

  if (orderErr || !order) {
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

  // 通知信
  const company = await getCompanyProfile();
  const itemRows = lineItems
    .map(
      (i) =>
        `<tr><td style="padding:6px 0;">${i.name}(${PURCHASE_MODE_LABEL[i.purchase_mode]}) × ${i.quantity}</td><td style="text-align:right;">${formatTWD(i.unit_price * i.quantity)}</td></tr>`
    )
    .join("");
  const pointsRow =
    pointsUsed > 0
      ? `<tr><td style="padding:6px 0;">點數折抵</td><td style="text-align:right;">-${formatTWD(pointsUsed)}</td></tr>`
      : "";
  const bankInfo =
    paymentMethod === "bank_transfer" && company.bank_info
      ? `<p style="background:#f4ede0;border-radius:4px;padding:12px;margin-top:16px;">匯款資訊:<br/>${company.bank_info.replace(/\n/g, "<br/>")}</p>`
      : "";

  await sendMail({
    to: order.contact_email,
    subject: `【小時光】訂單成立 ${order.order_no}`,
    html: emailShell(
      `訂單 ${order.order_no} 已成立`,
      `<p>${order.contact_name} 您好,感謝您的訂購!</p>
       <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:8px;">${itemRows}${pointsRow}</table>
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
       <table style="width:100%;border-collapse:collapse;font-size:14px;">${itemRows}${pointsRow}</table>
       <p style="font-weight:700;">合計 ${formatTWD(order.total)}(${PAYMENT_METHOD_LABEL[paymentMethod]})</p>
       <p><a href="${siteUrl()}/admin/orders/${order.id}">前往後台處理</a></p>`
    )
  );

  return NextResponse.json({ orderToken: order.public_token });
}
