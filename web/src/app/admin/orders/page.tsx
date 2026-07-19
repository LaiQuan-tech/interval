import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatTWD, ORDER_STATUS_LABEL } from "@/lib/format";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

const FILTERS = ["all", "pending", "paid", "processing", "shipped", "completed", "cancelled"];

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const db = createAdminClient();

  let query = db.from("orders").select("*").order("created_at", { ascending: false }).limit(100);
  if (status && status !== "all") query = query.eq("status", status);
  const { data } = await query;
  const orders = (data ?? []) as Order[];

  return (
    <div>
      <h2 className="mb-4 font-bold">訂單管理</h2>

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "all" ? "/admin/orders" : `/admin/orders?status=${f}`}
            className={`iv-chip whitespace-nowrap !px-4 !py-2 ${
              (status ?? "all") === f ? "bg-ink text-white" : "border border-line bg-card"
            }`}
          >
            {f === "all" ? "全部" : ORDER_STATUS_LABEL[f]}
          </Link>
        ))}
      </div>

      <div className="iv-table-wrap">
        <table className="w-full min-w-140 border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-soft">
              <th className="py-2.5 font-medium">訂單</th>
              <th className="py-2.5 font-medium">客戶</th>
              <th className="py-2.5 text-right font-medium">金額</th>
              <th className="py-2.5 text-right font-medium">狀態</th>
              <th className="py-2.5 text-right font-medium">日期</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-line/60 hover:bg-card">
                <td className="py-3">
                  <Link href={`/admin/orders/${o.id}`} className="font-medium hover:text-accent">
                    {o.order_no}
                  </Link>
                </td>
                <td className="py-3">
                  {o.contact_name}
                  <span className="block text-xs text-ink-soft">{o.contact_email}</span>
                </td>
                <td className="py-3 text-right font-semibold">{formatTWD(o.total)}</td>
                <td className="py-3 text-right">
                  <span className="iv-chip bg-accent-soft text-accent">
                    {ORDER_STATUS_LABEL[o.status] ?? o.status}
                  </span>
                </td>
                <td className="py-3 text-right text-ink-soft">{formatDate(o.created_at)}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-ink-soft">
                  沒有符合條件的訂單
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
