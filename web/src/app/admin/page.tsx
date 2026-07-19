import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatTWD, ORDER_STATUS_LABEL, QUOTE_STATUS_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const db = createAdminClient();

  const [
    { count: memberCount },
    { count: pendingOrders },
    { count: draftQuotes },
    { data: paidOrders },
    { data: recentOrders },
    { data: recentQuotes },
  ] = await Promise.all([
    db.from("profiles").select("id", { count: "exact", head: true }),
    db
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    db
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .eq("status", "draft"),
    db.from("orders").select("total").in("status", ["paid", "processing", "shipped", "completed"]),
    db
      .from("orders")
      .select("id, order_no, contact_name, total, status, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
    db
      .from("quotes")
      .select("id, quote_no, contact_email, total, status, created_at")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const revenue = (paidOrders ?? []).reduce((s, o) => s + (o.total ?? 0), 0);

  const stats = [
    { label: "累計營收(已付款)", value: formatTWD(revenue) },
    { label: "待處理訂單", value: String(pendingOrders ?? 0), href: "/admin/orders" },
    { label: "待審核 AI 報價", value: String(draftQuotes ?? 0), href: "/admin/quotes" },
    { label: "會員數", value: String(memberCount ?? 0), href: "/admin/members" },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href ?? "/admin"} className="iv-card !p-4">
            <div className="text-xs text-ink-soft">{s.label}</div>
            <div className="mt-1 text-xl font-bold">{s.value}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">最新訂單</h2>
            <Link href="/admin/orders" className="text-sm text-accent">全部 →</Link>
          </div>
          <div className="space-y-2">
            {(recentOrders ?? []).map((o) => (
              <Link
                key={o.id}
                href={`/admin/orders/${o.id}`}
                className="iv-card flex items-center justify-between !p-3.5 text-sm hover:shadow-sm"
              >
                <span>
                  <span className="font-semibold">{o.order_no}</span>
                  <span className="ml-2 text-ink-soft">{o.contact_name}</span>
                </span>
                <span className="text-right">
                  <span className="font-bold">{formatTWD(o.total)}</span>
                  <span className="ml-2 text-xs text-ink-soft">
                    {ORDER_STATUS_LABEL[o.status] ?? o.status}
                  </span>
                </span>
              </Link>
            ))}
            {(recentOrders ?? []).length === 0 && (
              <div className="iv-card text-sm text-ink-soft">還沒有訂單</div>
            )}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold">最新報價</h2>
            <Link href="/admin/quotes" className="text-sm text-accent">全部 →</Link>
          </div>
          <div className="space-y-2">
            {(recentQuotes ?? []).map((q) => (
              <Link
                key={q.id}
                href={`/admin/quotes/${q.id}`}
                className="iv-card flex items-center justify-between !p-3.5 text-sm hover:shadow-sm"
              >
                <span>
                  <span className="font-semibold">{q.quote_no}</span>
                  <span className="ml-2 text-ink-soft">{q.contact_email}</span>
                </span>
                <span className="text-right">
                  <span className="font-bold">{formatTWD(q.total)}</span>
                  <span className="ml-2 text-xs text-ink-soft">
                    {QUOTE_STATUS_LABEL[q.status] ?? q.status}
                  </span>
                </span>
              </Link>
            ))}
            {(recentQuotes ?? []).length === 0 && (
              <div className="iv-card text-sm text-ink-soft">還沒有報價單</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
