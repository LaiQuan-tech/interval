import { NextRequest, NextResponse } from "next/server";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { emailShell, notifyAdmin, sendMail, siteUrl } from "@/lib/resend";
import { getCompanyProfile } from "@/lib/settings";
import { formatTWD, PAYMENT_METHOD_LABEL } from "@/lib/format";

type CheckoutBody = {
  items: { productId: string; quantity: number }[];
  contact: {
    name: string;
    email: string;
    phone: string;
    address: string;
    payment_method: string;
    note: string;
  };
};

export async function POST(req: NextRequest) {
  let body: CheckoutBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "格式錯誤" }, { status: 400 });
  }

  const items = (body.items ?? []).filter(
    (i) => i?.productId && Number.isInteger(i.quantity) && i.quantity > 0 && i.quantity <= 999
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
    .select("id, name, price, stock, status")
    .in("id", ids);
  if (prodErr) {
    console.error("[orders] product load failed:", prodErr);
    return NextResponse.json({ error: "系統忙碌,請稍後再試" }, { status: 500 });
  }

  const productMap = new Map((products ?? []).map((p) => [p.id, p]));
  for (const item of items) {
    const p = productMap.get(item.productId);
    if (!p || p.status !== "active") {
      return NextResponse.json({ error: "部分商品已下架,請重新整理購物車" }, { status: 409 });
    }
    if (p.stock < item.quantity) {
      return NextResponse.json(
        { error: `「${p.name}」庫存不足(剩 ${p.stock} 件)` },
        { status: 409 }
      );
    }
  }

  const lineItems = items.map((i) => {
    const p = productMap.get(i.productId)!;
    return {
      product_id: p.id,
      name: p.name,
      unit_price: p.price,
      quantity: i.quantity,
    };
  });
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

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      user_id: userId,
      status: "pending",
      subtotal,
      shipping_fee: shippingFee,
      total: subtotal + shippingFee,
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

  const { error: itemsErr } = await supabase.from("order_items").insert(
    lineItems.map((i) => ({ ...i, order_id: order.id }))
  );
  if (itemsErr) {
    console.error("[orders] items insert failed:", itemsErr);
    await supabase.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: "訂單建立失敗" }, { status: 500 });
  }

  // 扣庫存(簡化版:逐筆條件更新)
  for (const item of items) {
    const p = productMap.get(item.productId)!;
    await supabase
      .from("products")
      .update({ stock: p.stock - item.quantity })
      .eq("id", p.id)
      .gte("stock", item.quantity);
  }

  // 通知信
  const company = await getCompanyProfile();
  const itemRows = lineItems
    .map(
      (i) =>
        `<tr><td style="padding:6px 0;">${i.name} × ${i.quantity}</td><td style="text-align:right;">${formatTWD(i.unit_price * i.quantity)}</td></tr>`
    )
    .join("");
  const bankInfo =
    paymentMethod === "bank_transfer" && company.bank_info
      ? `<p style="background:#eef0fe;border-radius:12px;padding:12px;margin-top:16px;">匯款資訊:<br/>${company.bank_info.replace(/\n/g, "<br/>")}</p>`
      : "";

  await sendMail({
    to: order.contact_email,
    subject: `【interval】訂單成立 ${order.order_no}`,
    html: emailShell(
      `訂單 ${order.order_no} 已成立`,
      `<p>${order.contact_name} 您好,感謝您的訂購!</p>
       <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:8px;">${itemRows}</table>
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
       <table style="width:100%;border-collapse:collapse;font-size:14px;">${itemRows}</table>
       <p style="font-weight:700;">合計 ${formatTWD(order.total)}(${PAYMENT_METHOD_LABEL[paymentMethod]})</p>
       <p><a href="${siteUrl()}/admin/orders/${order.id}">前往後台處理</a></p>`
    )
  );

  return NextResponse.json({ orderToken: order.public_token });
}
