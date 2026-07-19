"use client";

// 直接觸發右下角 ChatWidget 的 FAB(以 DOM 事件解耦)
export default function OpenChatButton() {
  return (
    <button
      className="iv-btn-primary"
      onClick={() => {
        const fab = document.querySelector<HTMLButtonElement>(
          'button[aria-label="開啟智慧客服"]'
        );
        fab?.click();
        fab?.scrollIntoView({ behavior: "smooth", block: "end" });
      }}
    >
      開始詢價 →
    </button>
  );
}
