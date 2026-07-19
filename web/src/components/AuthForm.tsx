"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/account";

  const [mode, setMode] = useState<"login" | "register">("login");
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError("");
    setInfo("");
    setLoading(true);
    const supabase = createClient();

    try {
      if (mode === "register") {
        if (form.password.length < 8) {
          throw new Error("密碼至少 8 碼");
        }
        const { data, error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: { data: { name: form.name } },
        });
        if (error) throw new Error(mapAuthError(error.message));
        if (data.session) {
          router.push(redirect);
          router.refresh();
        } else {
          setInfo("註冊成功!請到信箱點擊確認連結後再登入。");
          setMode("login");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });
        if (error) throw new Error(mapAuthError(error.message));
        router.push(redirect);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "發生錯誤,請再試一次");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="iv-card mt-6">
      <div className="mb-5 grid grid-cols-2 rounded-full bg-paper p-1 text-sm font-semibold">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setError("");
            }}
            className={`min-h-10 rounded-full transition-colors ${
              mode === m ? "bg-ink text-white" : "text-ink-soft"
            }`}
          >
            {m === "login" ? "登入" : "註冊"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-4">
        {mode === "register" && (
          <div>
            <label className="iv-label" htmlFor="auth-name">姓名</label>
            <input
              id="auth-name"
              required
              className="iv-input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
        )}
        <div>
          <label className="iv-label" htmlFor="auth-email">Email</label>
          <input
            id="auth-email"
            required
            type="email"
            autoComplete="email"
            className="iv-input"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label className="iv-label" htmlFor="auth-password">
            密碼{mode === "register" && <span className="text-xs">(至少 8 碼)</span>}
          </label>
          <input
            id="auth-password"
            required
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="iv-input"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>

        {error && (
          <p className="rounded-lg bg-danger-soft p-3 text-sm text-danger">{error}</p>
        )}
        {info && <p className="rounded-lg bg-ok-soft p-3 text-sm text-ok">{info}</p>}

        <button type="submit" disabled={loading} className="iv-btn-primary w-full">
          {loading ? "處理中…" : mode === "login" ? "登入" : "建立帳號"}
        </button>
      </form>
    </div>
  );
}

function mapAuthError(message: string) {
  if (/invalid login credentials/i.test(message)) return "帳號或密碼錯誤";
  if (/already registered/i.test(message)) return "此 email 已註冊過,請直接登入";
  if (/email not confirmed/i.test(message)) return "請先到信箱完成 email 確認";
  if (/rate limit/i.test(message)) return "嘗試次數過多,請稍後再試";
  return message;
}
