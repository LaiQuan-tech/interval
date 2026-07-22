-- Phase D1:商品內容英文欄位(AI 翻譯管線的資料層)
--
-- 只加欄位、default null,不動任何既有資料——對中文站與後台零風險:
--   * products.name_en / description_en:作品/旅程/會員方案商品的英文名稱與描述
--     (product_type='artwork'|'journey'|'membership' 共用同一張表)。
--   * membership_tiers.name_en / perks_en:會員等級英文名稱與英文權益陣列
--     (perks_en 陣列順序需與中文 perks 一一對應,由 scripts/translate-products.mjs 保證)。
--   * journey 的天數(如「四天三夜」)不需改 schema,英文版寫進既有 products.metadata
--     jsonb 的 duration_en 鍵,與 duration 平行存放。
--
-- 渲染端一律 `locale === 'en' ? (name_en ?? name) : name`:未翻譯時自動 fallback 中文,
-- 中文站(locale=zh)永遠走 name/description/perks 原欄位,逐字不變。
--
-- 用 add column if not exists 確保重跑此檔冪等(即使 provision 的 _migrations 表去重機制
-- 之外被重複執行,也不會因欄位已存在而報錯)。

alter table public.products add column if not exists name_en text;
alter table public.products add column if not exists description_en text;

alter table public.membership_tiers add column if not exists name_en text;
alter table public.membership_tiers add column if not exists perks_en jsonb;
