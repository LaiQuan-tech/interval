-- 小時光二期:購物車 flyout + 結帳強化(收件方式/發票/轉帳強化) + 運費設定 + Idempotency-Key
-- 沿用既有風格(裸 alter/create + RLS 全開;由 provision 的 _migrations 表去重,不需 IF NOT EXISTS)。
-- orders 既有 RLS policy(orders_admin_write 全靠 service role 寫入)已涵蓋新欄位,不需額外 RLS。

-- ========== orders 擴充 ==========
alter table public.orders add column shipping_method text not null default 'home'
  check (shipping_method in ('home', 'pickup', 'none'));
alter table public.orders add column invoice jsonb not null default '{}'::jsonb; -- {type:'personal'|'company', carrier?, tax_id?, title?}
alter table public.orders add column payment_report jsonb; -- {last5, reported_at}(客戶回報匯款末五碼)
alter table public.orders add column idempotency_key text unique; -- 防連點重複建單(NULL 不受 unique 限制)

-- ========== settings:運費規則(宅配運費 / 免運門檻 / 轉帳繳費期限天數) ==========
-- 全新 key,do update 只為了讓本檔可重複套用時保持冪等,不影響其他 settings key。
insert into public.settings (key, value) values
  ('shipping', '{"fee_home": 200, "free_threshold_home": 10000, "deadline_days": 3}'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();

-- ========== Storage:chat-uploads bucket ==========
-- 為下一棒的「AI 居家擺放模擬」預留:公開讀(路徑用 UUID 不可列舉)、僅 service role 寫。
insert into storage.buckets (id, name, public) values ('chat-uploads', 'chat-uploads', true)
on conflict (id) do nothing;
