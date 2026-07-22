import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Locale } from "@/lib/i18n/config";

// Supabase session 自動刷新;/account 與 /admin 需登入。
// /en 前綴:rewrite 到去掉前綴的 basePath 並注入 x-locale request header,
// auth 判斷吃 basePath——所以 /en/account 與 /account 一樣需要登入,不會繞過。
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isEn = pathname === "/en" || pathname.startsWith("/en/");
  const locale: Locale = isEn ? "en" : "zh";
  const basePath = isEn ? pathname.slice(3) || "/" : pathname;

  // 每次要組 response 前都重新從(可能已被 cookie 刷新 mutate 過的)request.headers
  // 建一份新 Headers 並蓋上 x-locale——request.cookies.set() 會直接改寫同一個
  // Headers 物件的 Cookie 值,所以這裡永遠讀得到最新的 cookie 狀態,不會用到舊快照。
  const withLocaleHeaders = () => {
    const headers = new Headers(request.headers);
    headers.set("x-locale", locale);
    return headers;
  };

  let response = NextResponse.next({ request: { headers: withLocaleHeaders() } });

  // /en 案例最終要 rewrite 到 basePath;/zh 案例維持原本的 response 不變。
  // rewrite 前把 response 上(可能由 supabase setAll 剛設好的)cookie 原封轉貼過去,
  // 不會弄丟 session 刷新的 Set-Cookie。
  const finalize = () => {
    if (!isEn) return response;
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = basePath;
    const rewritten = NextResponse.rewrite(rewriteUrl, {
      request: { headers: withLocaleHeaders() },
    });
    response.cookies.getAll().forEach((cookie) => rewritten.cookies.set(cookie));
    return rewritten;
  };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return finalize();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request: { headers: withLocaleHeaders() } });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const needsAuth = basePath.startsWith("/account") || basePath.startsWith("/admin");
  if (needsAuth && !user) {
    const login = request.nextUrl.clone();
    login.pathname = isEn ? "/en/login" : "/login";
    login.searchParams.set("redirect", pathname);
    return NextResponse.redirect(login);
  }

  return finalize();
}

export const config = {
  matcher: ["/account/:path*", "/admin/:path*", "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
