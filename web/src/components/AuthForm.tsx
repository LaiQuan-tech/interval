"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "@/lib/i18n/context";
import { localeHref } from "@/lib/i18n/href";

// 此元件文案本身尚未 i18n(既有狀態,Phase G 範圍外);但 login/page.tsx 在
// (storefront) layout 底下,已包在 I18nProvider 內,呼叫 useTranslations() 安全——
// 這裡只借 locale 修正下面兩處 router.push,不動任何顯示文字。
export default function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useTranslations();
  // redirect 若來自 middleware 的未登入導轉,本身已經是帶 /en 前綴的完整路徑
  // (見 middleware.ts:login.searchParams.set("redirect", pathname));localeHref
  // 對已有 /en 前綴的路徑會原樣放行,不會疊加成 /en/en/...。
  const redirect = localeHref(searchParams.get("redirect") ?? "/account", locale);

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
      <div className="mb-5 grid grid-cols-2 bg-panel p-1 text-sm font-medium">
        {(["login", "register"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setError("");
            }}
            className={`min-h-10 transition-colors ${
              mode === m ? "bg-ink-deep text-cream-text" : "text-ink-soft"
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
