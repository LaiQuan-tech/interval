import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate } from "@/lib/format";
import RoleToggle from "@/components/admin/RoleToggle";
import type { Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminMembersPage() {
  const db = createAdminClient();
  const { data } = await db
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  const members = (data ?? []) as Profile[];

  return (
    <div>
      <h2 className="mb-4 font-bold">會員管理</h2>
      <div className="iv-table-wrap">
        <table className="w-full min-w-130 border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left text-ink-soft">
              <th className="py-2.5 font-medium">會員</th>
              <th className="py-2.5 font-medium">電話</th>
              <th className="py-2.5 font-medium">註冊日</th>
              <th className="py-2.5 text-right font-medium">身分</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-line/60">
                <td className="py-3">
                  {m.name || "—"}
                  <span className="block text-xs text-ink-soft">{m.email}</span>
                </td>
                <td className="py-3">{m.phone || "—"}</td>
                <td className="py-3 text-ink-soft">{formatDate(m.created_at)}</td>
                <td className="py-3 text-right">
                  <RoleToggle userId={m.id} role={m.role} />
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-ink-soft">
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
