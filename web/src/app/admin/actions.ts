"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendQuoteToCustomer, computeTotals } from "@/lib/quote";
import { getQuoteConfig } from "@/lib/settings";
import { emailShell, sendMail, siteUrl } from "@/lib/resend";
import type { QuoteLineItem } from "@/lib/types";

// 每個 action 都先驗證 admin 身分,再用 service role 寫入
async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("未登入");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") throw new Error("權限不足");
  return user;
}

// ---------- 商品 ----------
export async function upsertProduct(formData: FormData) {
  await requireAdmin();
  const db = createAdminClient();

  const id = String(formData.get("id") ?? "");
  const imagesRaw = String(formData.get("images") ?? "").trim();
  const images = imagesRaw
    ? imagesRaw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((url) => ({ url }))
    : [];

  const payload = {
    name: String(formData.get("name") ?? "").trim(),
    slug: String(formData.get("slug") ?? "").trim().toLowerCase(),
    description: String(formData.get("description") ?? ""),
    price: Math.max(0, parseInt(String(formData.get("price") ?? "0"), 10) || 0),
    compare_at_price:
      parseInt(String(formData.get("compare_at_price") ?? ""), 10) || null,
    category: String(formData.get("category") ?? "").trim(),
    stock: Math.max(0, parseInt(String(formData.get("stock") ?? "0"), 10) || 0),
    status: ["draft", "active", "archived"].includes(String(formData.get("status")))
      ? String(formData.get("status"))
      : "draft",
    featured: formData.get("featured") === "on",
    images,
  };

  if (!payload.name || !payload.slug) throw new Error("名稱與網址代稱必填");

  if (id) {
    const { error } = await db.from("products").update(payload).eq("id", id);
    if (error) throw new Error(`儲存失敗:${error.message}`);
  } else {
    const { error } = await db.from("products").insert(payload);
    if (error) throw new Error(`建立失敗:${error.message}`);
  }
  revalidatePath("/admin/products");
  revalidatePath("/products");
}

export async function archiveProduct(id: string) {
  await requireAdmin();
  const db = createAdminClient();
  await db.from("products").update({ status: "archived" }).eq("id", id);
  revalidatePath("/admin/products");
  revalidatePath("/products");
}

// ---------- 訂單 ----------
const ORDER_TRANSITIONS: Record<string, string[]> = {
  pending: ["paid", "cancelled"],
  paid: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["completed"],
  completed: [],
  cancelled: [],
};

export async function updateOrderStatus(orderId: string, next: string) {
  await requireAdmin();
  const db = createAdminClient();

  const { data: order } = await db
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) throw new Error("找不到訂單");
  if (!ORDER_TRANSITIONS[order.status]?.includes(next)) {
    throw new Error(`不允許從 ${order.status} 變更為 ${next}`);
  }

  const patch: Record<string, unknown> = { status: next };
  if (next === "paid") patch.paid_at = new Date().toISOString();
  if (next === "shipped") patch.shipped_at = new Date().toISOString();

  const { error } = await db.from("orders").update(patch).eq("id", orderId);
  if (error) throw new Error(error.message);

  // 通知客戶
  const STATUS_MAIL: Record<string, { subject: string; body: string }> = {
    paid: {
      subject: "已收到您的款項",
      body: "我們已確認收到款項,將盡快為您安排出貨。",
    },
    shipped: {
      subject: "商品已出貨",
      body: "您的商品已出貨,請留意收件!",
    },
    completed: {
      subject: "訂單完成",
      body: "訂單已完成,感謝您的支持,期待再次為您服務!",
    },
    cancelled: {
      subject: "訂單已取消",
      body: "您的訂單已取消。若有疑問請與我們聯繫。",
    },
  };
  const mail = STATUS_MAIL[next];
  if (mail && order.contact_email) {
    await sendMail({
      to: order.contact_email,
      subject: `【interval】${mail.subject} ${order.order_no}`,
      html: emailShell(
        `${mail.subject}`,
        `<p>${order.contact_name} 您好,</p><p>${mail.body}</p>
         <p><a href="${siteUrl()}/orders/${order.public_token}">查看訂單 ${order.order_no}</a></p>`
      ),
    });
  }

  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
}

// ---------- 報價 ----------
export async function saveQuote(formData: FormData) {
  await requireAdmin();
  const db = createAdminClient();
  const config = await getQuoteConfig();

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("缺少報價單 ID");

  let lineItems: QuoteLineItem[] = [];
  try {
    const parsed = JSON.parse(String(formData.get("line_items") ?? "[]"));
    if (!Array.isArray(parsed)) throw new Error();
    lineItems = parsed
      .filter((i) => i && i.name)
      .map((i) => ({
        name: String(i.name).slice(0, 200),
        unit_price: Math.max(0, parseInt(String(i.unit_price), 10) || 0),
        quantity: Math.max(1, parseInt(String(i.quantity), 10) || 1),
        note: String(i.note ?? "").slice(0, 300),
      }));
  } catch {
    throw new Error("品項格式錯誤");
  }

  const taxEnabled = formData.get("tax_enabled") === "on";
  const totals = computeTotals(lineItems, taxEnabled ? config.tax_rate : 0);

  const { error } = await db
    .from("quotes")
    .update({
      contact_name: String(formData.get("contact_name") ?? "").slice(0, 100),
      contact_email: String(formData.get("contact_email") ?? "").slice(0, 200),
      contact_phone: String(formData.get("contact_phone") ?? "").slice(0, 50),
      note: String(formData.get("note") ?? "").slice(0, 2000),
      line_items: lineItems,
      ...totals,
    })
    .eq("id", id)
    .in("status", ["draft", "sent", "viewed"]);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/quotes/${id}`);
  revalidatePath("/admin/quotes");
}

export async function approveAndSendQuote(quoteId: string) {
  await requireAdmin();
  const result = await sendQuoteToCustomer(quoteId);
  if (!result.ok) throw new Error(result.error ?? "寄送失敗");
  revalidatePath(`/admin/quotes/${quoteId}`);
  revalidatePath("/admin/quotes");
}

export async function deleteQuote(quoteId: string) {
  await requireAdmin();
  const db = createAdminClient();
  await db.from("quotes").delete().eq("id", quoteId).eq("status", "draft");
  revalidatePath("/admin/quotes");
}

// ---------- 會員 ----------
export async function setMemberRole(userId: string, role: "customer" | "admin") {
  const me = await requireAdmin();
  if (me.id === userId && role !== "admin") {
    throw new Error("不能移除自己的管理員權限");
  }
  const db = createAdminClient();
  await db.from("profiles").update({ role }).eq("id", userId);
  revalidatePath("/admin/members");
}

// ---------- 設定 ----------
export async function saveSetting(key: string, jsonValue: string) {
  await requireAdmin();
  if (!["company_profile", "rate_card", "quote_config"].includes(key)) {
    throw new Error("不允許的設定鍵");
  }
  let value: unknown;
  try {
    value = JSON.parse(jsonValue);
  } catch {
    throw new Error("JSON 格式錯誤");
  }
  const db = createAdminClient();
  const { error } = await db
    .from("settings")
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/settings");
}
