import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPointsBalance, getPointsLedger, getMemberTier } from "@/lib/points";
import {
  formatDate,
  formatDateTime,
  formatTWD,
  formatPoints,
  ORDER_STATUS_LABEL,
  QUOTE_STATUS_LABEL,
} from "@/lib/format";
import ProfileForm from "@/components/ProfileForm";
import LogoutButton from "@/components/LogoutButton";
import type { Order, Profile, Quote } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "會員中心" };

const POINTS_SOURCE_LABEL: Record<string, string> = {
  earn: "消費回饋",
  redeem: "訂單折抵",
  expire: "點數到期",
  refund: "取消退回",
  manual_adjust: "後台調整",
  promo: "活動贈點",
};

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/account");

  const admin = createAdminClient();
  const [{ data: profile }, { data: orders }, { data: quotes }, points, ledger, tier] =
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
      getPointsBalance(user.id),
      getPointsLedger(user.id, { limit: 8 }),
      getMemberTier(user.id),
    ]);

  const typedProfile = profile as Profile | null;
  const typedOrders = (orders ?? []) as Order[];
  const typedQuotes = (quotes ?? []) as Quote[];

  return (
    <div className="lm-container max-w-190 py-10 sm:py-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-serif text-[26px] font-normal text-ink sm:text-[32px]">會員中心</h1>
          <p className="mt-1 text-sm text-ink-soft">{user.email}</p>
        </div>
        <LogoutButton />
      </div>

      {/* 會員等級與點數 */}
      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="border border-gold bg-ink-deep p-6 text-panel">
          <div className="lm-caption text-[12px]">Membership</div>
          <div className="mt-2 font-serif text-[24px]">{tier?.name ?? "尚未入會"}</div>
          {tier ? (
            <p className="mt-2 text-[13px] text-cream-soft">
              每消費 NT$100 累積 {tier.rebate_rate} 點
            </p>
          ) : (
            <Link href="/membership" className="mt-3 inline-block text-[13px] tracking-[0.06em] text-gold-bright border-b border-gold pb-0.5">
              了解會員方案 →
            </Link>
          )}
        </div>
        <div className="border border-line bg-card p-6">
          <div className="lm-caption text-[12px]">Points Balance</div>
          <div className="mt-2 font-cormorant text-[34px] text-gold">{points.balance.toLocaleString("zh-TW")}</div>
          <p className="mt-1 text-[13px] text-ink-soft">
            {points.expiringSoon > 0
              ? `其中 ${formatPoints(points.expiringSoon)} 將於 30 天內到期`
              : "目前無即將到期的點數"}
          </p>
        </div>
      </section>

      {/* 點數明細 */}
      {ledger.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-3 font-serif text-lg text-ink">點數明細</h2>
          <div className="iv-card divide-y divide-line !p-0">
            {ledger.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between gap-3 px-5 py-3.5 text-sm">
                <div>
                  <div className="text-ink">{POINTS_SOURCE_LABEL[entry.source] ?? entry.source}</div>
                  <div className="mt-0.5 text-xs text-muted-2">{formatDateTime(entry.created_at)}</div>
                </div>
                <div className={`font-cormorant text-[17px] ${entry.delta >= 0 ? "text-accent" : "text-ink-soft"}`}>
                  {entry.delta >= 0 ? "+" : ""}
                  {entry.delta.toLocaleString("zh-TW")}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 訂單 */}
      <section className="mt-8">
        <h2 className="mb-3 font-serif text-lg text-ink">我的訂單</h2>
        {typedOrders.length === 0 ? (
          <div className="iv-card flex items-center justify-between text-sm text-ink-soft">
            <span>還沒有訂單</span>
            <Link href="/gallery" className="font-semibold text-accent">
              去逛逛 →
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {typedOrders.map((o) => (
              <Link
                key={o.id}
                href={`/orders/${o.public_token}`}
                className="iv-card flex items-center justify-between gap-3 !p-4 transition-colors hover:border-gold"
              >
                <div>
                  <div className="font-semibold text-ink">{o.order_no}</div>
                  <div className="mt-0.5 text-xs text-ink-soft">{formatDate(o.created_at)}</div>
                </div>
                <div className="text-right">
                  <div className="font-serif text-ink">{formatTWD(o.total)}</div>
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
          <h2 className="mb-3 font-serif text-lg text-ink">我的報價單</h2>
          <div className="space-y-3">
            {typedQuotes.map((q) => (
              <Link
                key={q.id}
                href={`/quote/${q.public_token}`}
                className="iv-card flex items-center justify-between gap-3 !p-4 transition-colors hover:border-gold"
              >
                <div>
                  <div className="font-semibold text-ink">{q.quote_no}</div>
                  <div className="mt-0.5 text-xs text-ink-soft">{formatDate(q.created_at)}</div>
                </div>
                <div className="text-right">
                  <div className="font-serif text-ink">{formatTWD(q.total)}</div>
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
        <h2 className="mb-3 font-serif text-lg text-ink">個人資料</h2>
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
