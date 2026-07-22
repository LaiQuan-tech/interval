-- Phase F1:orders 加 locale 欄位(通知信英文化的資料層)
--
-- 只加欄位、default 'zh'、不動任何既有資料——對中文站與後台零風險:
--   * orders.locale:下單當下的買家介面語系('zh'|'en',checkout API 依 useTranslations()
--     取得的 locale 寫入,未帶值一律 'zh')。既有訂單全部自動補為 'zh',行為與現在完全相同。
--
-- 通知信(訂單確認/付款確認/出貨等)依此欄位決定 subject/body 中英文分支;
-- notifyAdmin(給店主的信)固定中文,不讀這個欄位。
--
-- 用 add column if not exists 確保重跑此檔冪等。

alter table public.orders add column if not exists locale text not null default 'zh';
