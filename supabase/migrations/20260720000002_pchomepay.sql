-- 小時光:PChomePay 支付連(信用卡/ATM/超商代碼)金流
-- 沿用既有風格(裸 alter/create + RLS;由 provision 的 _migrations 表去重,不需 IF NOT EXISTS)。

-- ========== orders:金流欄位 ==========
alter table public.orders add column gateway text; -- 金流商代碼,如 'pchomepay'(NULL = 站內流程,無外部金流)
alter table public.orders add column gateway_tx_id text; -- 對應金流商的訂單編號(PChomePay 即 order_no 本身)

-- 同一筆金流訂單編號只會對到一筆 interval 訂單;NULL(非 card 付款)不受此限制。
create unique index orders_gateway_tx_id_idx on public.orders (gateway_tx_id) where gateway_tx_id is not null;

-- ========== webhook_events:金流 webhook 標記 ==========
-- event_key 慣例:目前只寫 failed_<order_no> —— 供 /api/orders/status 判斷付款失敗
-- (interval 的 orders.status 沒有獨立的 failed 狀態,不能直接寫回 orders,見 webhook route 註解)。
-- 付款成功的冪等改由 markOrderPaid 的條件式 update(CAS on status='pending')保證,不再用
-- 本表做預佔式去重(舊設計會被偽造通知搶佔 key 卡單,已於 2026-07-19 安全稽核後移除)。
-- unique(gateway,event_key) 仍保留,讓並發的 failed marker 寫入自然去重。
create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  gateway text not null,
  event_key text not null,
  created_at timestamptz not null default now(),
  unique (gateway, event_key)
);

alter table public.webhook_events enable row level security;
-- 僅供後台除錯查閱;寫入一律經由 service role(webhook / server action),繞過 RLS。
create policy "webhook_events_admin_read" on public.webhook_events
  for select using (public.is_admin());
