"use client";

import { useTranslations } from "@/lib/i18n/context";

// 直接觸發右下角 ChatWidget 的 FAB(以 DOM 事件解耦)。
// 用 data-chat-fab(與翻譯無關的穩定屬性)選取,不要用 aria-label——
// aria-label 會依語言 i18n,/en 頁面上找不到會導致這顆按鈕靜默失效。
export default function OpenChatButton() {
  const { messages } = useTranslations();

  return (
    <button
      className="iv-btn-primary"
      onClick={() => {
        const fab = document.querySelector<HTMLButtonElement>("[data-chat-fab]");
        fab?.click();
        fab?.scrollIntoView({ behavior: "smooth", block: "end" });
      }}
    >
      {messages.chat.startEnquiry}
    </button>
  );
}
