import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  formatDate,
  formatTWD,
  ORDER_STATUS_LABEL,
  QUOTE_STATUS_LABEL,
} from "@/lib/format";
import ProfileForm from "@/components/ProfileForm";
import LogoutButton from "@/components/LogoutButton";
import type { Order, Profile, Quote } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "會員中心" };

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/account");

  const admin = createAdminClient();
  const [{ data: profile }, { data: orders }, { data: quotes }] =
    await Promise.all([
      admin.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      admin
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
      admin
        .from("quotes")
        .select("*")
        .eq("user_id", user.id)
        .neq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  const typedProfile = profile as Profile | null;
  const typedOrders = (orders ?? []) as Order[];
  const typedQuotes = (quotes ?? []) as Quote[];

  return (
    <div className="iv-container max-w-3xl py-8 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">會員中心</h1>
          <p className="mt-1 text-sm text-ink-soft">{user.email}</p>
        </div>
        <LogoutButton />
      </div>

      {/* 訂單 */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">我的訂單</h2>
        {typedOrders.length === 0 ? (
          <div className="iv-card flex items-center justify-between text-sm text-ink-soft">
            <span>還沒有訂單</span>
            <Link href="/products" className="font-semibold text-accent">
              去逛逛 →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {typedOrders.map((o) => (
              <Link
                key={o.id}
                href={`/orders/${o.public_token}`}
                className="iv-card flex items-center justify-between gap-3 !p-4 transition-shadow hover:shadow-md"
              >
                <div>
                  <div className="font-semibold">{o.order_no}</div>
                  <div className="mt-0.5 text-xs text-ink-soft">
                    {formatDate(o.created_at)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-accent">{formatTWD(o.total)}</div>
                  <div className="mt-0.5 text-xs text-ink-soft">
                    {ORDER_STATUS_LABEL[o.status] ?? o.status}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 報價 */}
      {typedQuotes.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold">我的報價單</h2>
          <div className="space-y-3">
            {typedQuotes.map((q) => (
              <Link
                key={q.id}
                href={`/quote/${q.public_token}`}
                className="iv-card flex items-center justify-between gap-3 !p-4 transition-shadow hover:shadow-md"
              >
                <div>
                  <div className="font-semibold">{q.quote_no}</div>
                  <div className="mt-0.5 text-xs text-ink-soft">
                    {formatDate(q.created_at)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-accent">{formatTWD(q.total)}</div>
                  <div className="mt-0.5 text-xs text-ink-soft">
                    {QUOTE_STATUS_LABEL[q.status] ?? q.status}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* 個人資料 */}
      <section className="mt-8">
        <h2 className="mb-3 text-lg font-bold">個人資料</h2>
        <ProfileForm
          initial={{
            name: typedProfile?.name ?? "",
            phone: typedProfile?.phone ?? "",
            line_id: typedProfile?.line_id ?? "",
          }}
        />
      </section>
    </div>
  );
}
