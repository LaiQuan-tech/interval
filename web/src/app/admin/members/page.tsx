import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatPoints } from "@/lib/format";
import RoleToggle from "@/components/admin/RoleToggle";
import AdjustPointsForm from "@/components/admin/AdjustPointsForm";
import type { MembershipTier, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminMembersPage() {
  const db = createAdminClient();
  const { data } = await db
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  const members = (data ?? []) as Profile[];

  const [{ data: tiersData }, { data: balancesData }] = await Promise.all([
    db.from("membership_tiers").select("*"),
    db.from("v_user_points_balance").select("user_id, balance"),
  ]);
  const tierMap = new Map(((tiersData ?? []) as MembershipTier[]).map((t) => [t.slug, t]));
  const balanceMap = new Map(
    ((balancesData ?? []) as { user_id: string; balance: number }[]).map((b) => [
      b.user_id,
      b.balance,
    ])
  );

  return (
    <div>
      <h2 className="mb-4 font-bold">會員管理</h2>
      <div className="iv-table-wrap">
        <table className="w-full min-w-160 border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-soft">
              <th className="py-2.5 font-medium">會員</th>
              <th className="py-2.5 font-medium">電話</th>
              <th className="py-2.5 font-medium">會員等級</th>
              <th className="py-2.5 font-medium">點數餘額</th>
              <th className="py-2.5 font-medium">註冊日</th>
              <th className="py-2.5 text-right font-medium">身分</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const tier = m.tier_slug ? tierMap.get(m.tier_slug) : null;
              const expired = m.tier_expires_at ? new Date(m.tier_expires_at) < new Date() : false;
              const balance = balanceMap.get(m.id) ?? 0;
              return (
                <tr key={m.id} className="border-b border-line/60 align-top">
                  <td className="py-3">
                    {m.name || "—"}
                    <span className="block text-xs text-ink-soft">{m.email}</span>
                  </td>
                  <td className="py-3">{m.phone || "—"}</td>
                  <td className="py-3">
                    {tier ? (
                      <>
                        <span className="iv-chip bg-accent-soft text-accent">{tier.name}</span>
                        {expired && <span className="ml-1.5 text-xs text-danger">(已過期)</span>}
                        {!expired && m.tier_expires_at && (
                          <span className="ml-1.5 block text-xs text-ink-soft">
                            至 {formatDate(m.tier_expires_at)}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-ink-soft">一般會員</span>
                    )}
                  </td>
                  <td className="py-3">
                    <div className="flex flex-col items-start gap-2">
                      <span className="font-semibold">{formatPoints(balance)}</span>
                      <AdjustPointsForm userId={m.id} />
                    </div>
                  </td>
                  <td className="py-3 text-ink-soft">{formatDate(m.created_at)}</td>
                  <td className="py-3 text-right">
                    <RoleToggle userId={m.id} role={m.role} />
                  </td>
                </tr>
              );
            })}
            {members.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-ink-soft">
                  還沒有會員
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
