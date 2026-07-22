-- 報價 email 英文化的資料層:quotes 加 locale 欄位
--
-- 只加欄位、default 'zh'、不動任何既有資料——對中文站與後台零風險:
--   * quotes.locale:報價草稿建立當下的客戶介面語系('zh'|'en')。AI 對話觸發
--     createQuoteDraftFromSession 時,依 /api/chat 收到的 locale 寫入;未帶值一律 'zh'。
--     既有報價全部自動補為 'zh',寄信行為與現在完全相同。
--
-- 客戶信(報價備妥通知 sendQuoteToCustomer、接受報價後的訂單成立信 acceptQuoteByToken)
-- 依此欄位決定 subject/body 中英文分支;notifyAdmin(給店主的信)固定中文,不讀這個欄位。
--
-- 用 add column if not exists 確保重跑此檔冪等。

alter table public.quotes add column if not exists locale text not null default 'zh';
