import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminBottomNav from "@/components/admin/AdminBottomNav";
import AdminPageTitle from "@/components/admin/AdminPageTitle";
import type { AdminBadgeKey } from "@/components/admin/AdminNavItems";

export const dynamic = "force-dynamic";

// 後台守衛:必須登入且 profiles.role = 'admin'
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/admin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/");

  // 待處理數量。注意:Supabase 查詢失敗不會拋例外,錯誤在回傳值的 error 欄位,
  // 所以必須顯式檢查並記錄——否則欄位/權限一旦變動,徽章會永遠是 0 而無人察覺。
  // 外層 try/catch 只是防網路層等非預期例外,不讓輔助資訊拖垮整個後台。
  const badges: Record<AdminBadgeKey, number> = { orders: 0, quotes: 0 };
  try {
    const [pendingOrders, draftQuotes] = await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("quotes").select("id", { count: "exact", head: true }).eq("status", "draft"),
    ]);
    if (pendingOrders.error) console.error("[admin] 待付款訂單數查詢失敗", pendingOrders.error);
    if (draftQuotes.error) console.error("[admin] 草稿報價數查詢失敗", draftQuotes.error);
    badges.orders = pendingOrders.count ?? 0;
    badges.quotes = draftQuotes.count ?? 0;
  } catch (err) {
    console.error("[admin] 徽章查詢發生非預期例外", err);
  }

  const email = user.email ?? "";

  return (
    <div className="flex flex-1">
      <AdminSidebar email={email} badges={badges} />

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminPageTitle />

        {/* pb-20 讓最後一列不被手機底部分頁列蓋住 */}
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-20 pt-5 sm:px-6 lg:pb-10">
          {children}
        </main>
      </div>

      <AdminBottomNav email={email} badges={badges} />
    </div>
  );
}
