import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";

export const metadata = { title: "登入 / 註冊" };

export default function LoginPage() {
  return (
    <div className="iv-container flex max-w-md flex-col py-10 sm:py-16">
      <h1 className="text-center text-2xl font-bold">會員登入</h1>
      <p className="mt-2 text-center text-sm text-ink-soft">
        登入後可追蹤訂單、快速結帳、查看專屬報價
      </p>
      <Suspense>
        <AuthForm />
      </Suspense>
    </div>
  );
}
