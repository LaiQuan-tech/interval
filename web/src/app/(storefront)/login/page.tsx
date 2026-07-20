import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";

export const metadata = { title: "登入 / 註冊" };

export default function LoginPage() {
  return (
    <div className="lm-container flex max-w-120 flex-col py-14 sm:py-20">
      <div className="text-center">
        <div className="lm-eyebrow text-[18px]">Welcome back</div>
        <h1 className="mt-3 font-serif text-[28px] font-normal text-ink">會員登入</h1>
        <p className="mt-2 text-sm text-ink-soft">登入後可追蹤訂單、快速結帳、查看專屬報價與點數</p>
      </div>
      <Suspense>
        <AuthForm />
      </Suspense>
    </div>
  );
}
