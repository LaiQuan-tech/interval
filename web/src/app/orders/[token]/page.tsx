import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCompanyProfile } from "@/lib/settings";
import {
  formatDateTime,
  formatTWD,
  ORDER_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  PURCHASE_MODE_LABEL,
} from "@/lib/format";
import type { Order, OrderItem } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_CHIP: Record<string, string> = {
  pending: "bg-warn-soft text-warn",
  paid: "bg-ok-soft text-ok",
  processing: "bg-panel text-accent",
  shipped: "bg-panel text-accent",
  completed: "bg-ok-soft text-ok",
  cancelled: "bg-danger-soft text-danger",
};

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { token } = await params;
  const { created } = await searchParams;

  let order: Order | null = null;
  let items: OrderItem[] = [];
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("public_token", token)
      .maybeSingle();
    order = data as Order | null;
    if (order) {
      const { data: itemData } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", order.id)
        .order("created_at");
      items = (itemData ?? []) as OrderItem[];
    }
  } catch {
    /* env 未設定 */
  }

  if (!order) notFound();

  const company = await getCompanyProfile();

  return (
    <div className="lm-container max-w-135 py-10 sm:py-16">
      {created && (
        <div className="mb-6 border border-gold bg-panel p-4 text-center font-medium text-ink">
          訂單成立！我們已寄出確認信到 {order.contact_email}
        </div>
      )}

      <div className="iv-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-ink-soft">訂單編號</div>
            <h1 className="font-serif text-xl text-ink">{order.order_no}</h1>
          </div>
          <span className={`iv-chip ${STATUS_CHIP[order.status] ?? ""}`}>
            {ORDER_STATUS_LABEL[order.status] ?? order.status}
          </span>
        </div>

        <div className="mt-5 space-y-1.5 border-t border-line pt-5 text-sm">
          <p><span className="text-ink-soft">訂購時間：</span>{formatDateTime(order.created_at)}</p>
          <p><span className="text-ink-soft">收件人：</span>{order.contact_name}</p>
          <p><span className="text-ink-soft">收件地址：</span>{order.shipping_address || "—"}</p>
          <p><span className="text-ink-soft">付款方式：</span>{PAYMENT_METHOD_LABEL[order.payment_method] ?? order.payment_method}</p>
        </div>

        <div className="mt-5 border-t border-line pt-5">
          <h2 className="mb-3 font-serif text-ink">商品明細</h2>
          <ul className="space-y-2 text-sm">
            {items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3">
                <span>
                  {i.name}
                  <span className="ml-1 text-[11px] text-accent">
                    ({PURCHASE_MODE_LABEL[i.purchase_mode] ?? i.purchase_mode})
                  </span>
                  {" "}× {i.quantity}
                </span>
                <span className="shrink-0">{formatTWD(i.unit_price * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-ink-soft">小計</span>
              <span>{formatTWD(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-soft">運費</span>
              <span>{order.shipping_fee === 0 ? "免運" : formatTWD(order.shipping_fee)}</span>
            </div>
            {order.points_used > 0 && (
              <div className="flex justify-between text-accent">
                <span>點數折抵</span>
                <span>-{formatTWD(order.points_used)}</span>
              </div>
            )}
            <div className="flex justify-between pt-1 text-base font-medium">
              <span>合計</span>
              <span className="font-serif text-[18px] text-ink">{formatTWD(order.total)}</span>
            </div>
          </div>
        </div>

        {order.status === "pending" &&
          order.payment_method === "bank_transfer" &&
          company.bank_info && (
            <div className="mt-5 border border-line bg-panel p-4 text-sm leading-relaxed">
              <p className="font-medium text-ink">匯款資訊</p>
              <p className="mt-1 whitespace-pre-wrap text-ink-soft">{company.bank_info}</p>
              <p className="mt-2 text-ink-soft">
                完成匯款後我們會盡快確認並安排出貨。
              </p>
            </div>
          )}
      </div>

      <p className="mt-6 text-center text-sm text-ink-soft">
        有任何問題，歡迎使用右下角智慧客服{company.email ? `或來信 ${company.email}` : ""}。
      </p>
    </div>
  );
}
