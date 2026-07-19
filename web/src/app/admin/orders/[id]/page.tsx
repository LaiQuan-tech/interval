import { notFound } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  formatDateTime,
  formatTWD,
  ORDER_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
} from "@/lib/format";
import OrderStatusButtons from "@/components/admin/OrderStatusButtons";
import type { Order, OrderItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = createAdminClient();

  const { data: order } = await db.from("orders").select("*").eq("id", id).maybeSingle();
  if (!order) notFound();
  const typedOrder = order as Order;

  const { data: items } = await db
    .from("order_items")
    .select("*")
    .eq("order_id", id)
    .order("created_at");
  const typedItems = (items ?? []) as OrderItem[];

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold">
          訂單 {typedOrder.order_no}
          <span className="iv-chip ml-3 bg-accent-soft text-accent">
            {ORDER_STATUS_LABEL[typedOrder.status] ?? typedOrder.status}
          </span>
        </h2>
        <Link
          href={`/orders/${typedOrder.public_token}`}
          target="_blank"
          className="text-sm text-accent"
        >
          客戶頁面 ↗
        </Link>
      </div>

      <section className="iv-card text-sm">
        <h3 className="mb-3 font-bold">客戶資訊</h3>
        <div className="space-y-1.5">
          <p><span className="text-ink-soft">姓名:</span>{typedOrder.contact_name}</p>
          <p><span className="text-ink-soft">Email:</span>{typedOrder.contact_email}</p>
          <p><span className="text-ink-soft">電話:</span>{typedOrder.contact_phone}</p>
          <p><span className="text-ink-soft">地址:</span>{typedOrder.shipping_address || "—"}</p>
          <p><span className="text-ink-soft">付款方式:</span>{PAYMENT_METHOD_LABEL[typedOrder.payment_method]}</p>
          <p><span className="text-ink-soft">成立時間:</span>{formatDateTime(typedOrder.created_at)}</p>
          {typedOrder.paid_at && (
            <p><span className="text-ink-soft">付款時間:</span>{formatDateTime(typedOrder.paid_at)}</p>
          )}
          {typedOrder.note && (
            <p><span className="text-ink-soft">備註:</span>{typedOrder.note}</p>
          )}
        </div>
      </section>

      <section className="iv-card text-sm">
        <h3 className="mb-3 font-bold">商品明細</h3>
        <ul className="space-y-2">
          {typedItems.map((i) => (
            <li key={i.id} className="flex justify-between gap-3">
              <span>{i.name} × {i.quantity}</span>
              <span>{formatTWD(i.unit_price * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-1.5 border-t border-line pt-3">
          <div className="flex justify-between">
            <span className="text-ink-soft">小計</span>
            <span>{formatTWD(typedOrder.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-soft">運費</span>
            <span>{formatTWD(typedOrder.shipping_fee)}</span>
          </div>
          <div className="flex justify-between font-bold">
            <span>合計</span>
            <span className="text-accent">{formatTWD(typedOrder.total)}</span>
          </div>
        </div>
      </section>

      <section className="iv-card">
        <h3 className="mb-3 font-bold">變更狀態</h3>
        <OrderStatusButtons orderId={typedOrder.id} status={typedOrder.status} />
        <p className="mt-3 text-xs text-ink-soft">
          變更狀態會自動寄通知信給客戶(已付款 / 已出貨 / 完成 / 取消)。
        </p>
      </section>
    </div>
  );
}
