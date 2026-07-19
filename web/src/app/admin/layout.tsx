import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "總覽" },
  { href: "/admin/orders", label: "訂單" },
  { href: "/admin/quotes", label: "報價" },
  { href: "/admin/products", label: "商品" },
  { href: "/admin/members", label: "會員" },
  { href: "/admin/settings", label: "設定" },
];

// 後台守衛:必須登入且 profiles.role = 'admin'(仿 realreal 的 layout 守衛)
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

  return (
    <div className="iv-container py-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">後台管理</h1>
        <span className="text-xs text-ink-soft">{user.email}</span>
      </div>

      <nav className="-mx-4 mb-6 flex gap-2 overflow-x-auto border-b border-line px-4 pb-3 sm:mx-0 sm:px-0">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="whitespace-nowrap rounded-full border border-line bg-card px-4 py-2 text-sm font-medium hover:border-accent hover:text-accent"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {children}
    </div>
  );
}
