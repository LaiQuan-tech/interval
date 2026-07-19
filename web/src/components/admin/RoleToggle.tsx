"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setMemberRole } from "@/app/admin/actions";

export default function RoleToggle({
  userId,
  role,
}: {
  userId: string;
  role: "customer" | "admin";
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = role === "admin" ? "customer" : "admin";
    if (!confirm(`確定將此會員設為「${next === "admin" ? "管理員" : "一般會員"}」?`)) return;
    setBusy(true);
    try {
      await setMemberRole(userId, next);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "操作失敗");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`iv-chip cursor-pointer ${
        role === "admin" ? "bg-ink text-white" : "border border-line bg-card text-ink-soft"
      }`}
    >
      {role === "admin" ? "管理員" : "會員"}
    </button>
  );
}
