import { Suspense } from "react";
import type { Metadata } from "next";
import AuthForm from "@/components/AuthForm";
import { getLocale, getMessages } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const messages = getMessages(await getLocale());
  return { title: messages.nav.loginRegister };
}

export default async function LoginPage() {
  const messages = getMessages(await getLocale());

  return (
    <div className="lm-container flex max-w-120 flex-col py-14 sm:py-20">
      <div className="text-center">
        <div className="lm-eyebrow text-[18px]">Welcome back</div>
        <h1 className="mt-3 font-serif text-[28px] font-normal text-ink">{messages.login.title}</h1>
        <p className="mt-2 text-sm text-ink-soft">{messages.login.desc}</p>
      </div>
      <Suspense>
        <AuthForm />
      </Suspense>
    </div>
  );
}
