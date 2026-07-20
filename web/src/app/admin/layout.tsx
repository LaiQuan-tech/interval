import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminBottomNav from "@/components/admin/AdminBottomNav";
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

  // 待處理數量:任一查詢失敗都不能讓整個後台掛掉,失敗即視為 0(不顯示徽章)
  const badges: Record<AdminBadgeKey, number> = { orders: 0, quotes: 0 };
  try {
    const [pendingOrders, draftQuotes] = await Promise.all([
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("quotes").select("id", { count: "exact", head: true }).eq("status", "draft"),
    ]);
    badges.orders = pendingOrders.count ?? 0;
    badges.quotes = draftQuotes.count ?? 0;
  } catch {
    /* 徽章是輔助資訊,查不到就不顯示 */
  }

  const email = user.email ?? "";

  return (
    <div className="flex flex-1">
      <AdminSidebar email={email} badges={badges} />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-line px-4 py-3 lg:hidden">
          <span className="font-serif text-[15px] text-ink">小時光後台</span>
        </div>

        {/* pb-20 讓最後一列不被手機底部分頁列蓋住 */}
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 pb-20 pt-5 sm:px-6 lg:pb-10">
          {children}
        </main>
      </div>

      <AdminBottomNav email={email} badges={badges} />
    </div>
  );
}
