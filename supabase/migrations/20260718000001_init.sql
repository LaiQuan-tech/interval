-- interval 初始 schema:會員、商品、訂單、AI 報價、設定
-- 設計原則(仿 gather-landing / realreal):
--  * 全部資料表開 RLS;公開頁面一律經由 server(service role)以 token 讀取
--  * 會員(profiles)綁 Supabase Auth;admin 以 profiles.role 判斷
--  * AI 報價:AI 只產草稿(status=draft),管理員核准後寄出 token 連結

-- ========== 會員 ==========
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  name text,
  phone text,
  line_id text,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 註冊時自動建立 profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- admin 判斷(security definer 避免 RLS 遞迴)
create or replace function public.is_admin()
returns boolean
language sql
security definer set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ========== 商品 ==========
create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  price integer not null check (price >= 0),          -- TWD 整數
  compare_at_price integer check (compare_at_price >= 0),
  currency text not null default 'TWD',
  images jsonb not null default '[]'::jsonb,           -- [{url, alt}]
  category text not null default '',
  stock integer not null default 0 check (stock >= 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ========== 訂單 ==========
create sequence public.order_no_seq;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique
    default 'IV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.order_no_seq')::text, 5, '0'),
  user_id uuid references public.profiles (id) on delete set null,
  quote_id uuid,                                       -- 由 AI 報價轉單時回填
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'processing', 'shipped', 'completed', 'cancelled')),
  subtotal integer not null default 0,
  shipping_fee integer not null default 0,
  total integer not null default 0,
  contact_name text not null default '',
  contact_email text not null default '',
  contact_phone text not null default '',
  shipping_address text not null default '',
  payment_method text not null default 'bank_transfer'
    check (payment_method in ('bank_transfer', 'cod', 'card', 'other')),
  note text not null default '',
  public_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  paid_at timestamptz,
  shipped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  name text not null,                                  -- 下單當下的商品名快照
  unit_price integer not null,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create index order_items_order_id_idx on public.order_items (order_id);
create index orders_user_id_idx on public.orders (user_id);

-- ========== AI 報價 ==========
create sequence public.quote_no_seq;

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_no text not null unique
    default 'Q-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.quote_no_seq')::text, 4, '0'),
  session_id text,
  user_id uuid references public.profiles (id) on delete set null,
  contact_name text not null default '',
  contact_email text not null default '',
  contact_phone text not null default '',
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired', 'converted')),
  line_items jsonb not null default '[]'::jsonb,       -- [{name, unit_price, quantity, note}]
  subtotal integer not null default 0,
  tax integer not null default 0,
  total integer not null default 0,
  valid_until date,
  note text not null default '',
  created_by text not null default 'ai' check (created_by in ('ai', 'manual')),
  public_token text not null unique default encode(gen_random_bytes(24), 'hex'),
  order_id uuid references public.orders (id) on delete set null,
  sent_at timestamptz,
  viewed_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders
  add constraint orders_quote_id_fkey
  foreign key (quote_id) references public.quotes (id) on delete set null;

-- AI 對話紀錄(每個 session 一列,upsert)
create table public.ai_chat_logs (
  session_id text primary key,
  user_id uuid references public.profiles (id) on delete set null,
  messages jsonb not null default '[]'::jsonb,
  message_count integer not null default 0,
  contact_name text not null default '',
  contact_email text not null default '',
  contact_phone text not null default '',
  intent text not null default '',
  quote_id uuid references public.quotes (id) on delete set null,
  ip text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- AI 用量限流(仿 gather 的 ai_rate_check)
create table public.ai_usage (
  ip text not null,
  day date not null default current_date,
  count integer not null default 0,
  primary key (ip, day)
);

create or replace function public.ai_rate_check(p_ip text, p_ip_limit int, p_global_limit int)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  ip_count int;
  global_count int;
begin
  insert into public.ai_usage (ip, day, count)
  values (p_ip, current_date, 1)
  on conflict (ip, day) do update set count = public.ai_usage.count + 1
  returning count into ip_count;

  select coalesce(sum(count), 0) into global_count
  from public.ai_usage where day = current_date;

  return ip_count <= p_ip_limit and global_count <= p_global_limit;
end;
$$;

-- ========== 設定(費率卡、公司資訊、追蹤參數) ==========
create table public.settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into public.settings (key, value) values
  ('company_profile', '{"name": "interval", "tagline": "賣到全世界", "email": "", "phone": ""}'::jsonb),
  ('rate_card', '{"note": "AI 報價依此費率卡計算,請在後台維護", "items": []}'::jsonb),
  ('quote_config', '{"valid_days": 14, "tax_rate": 0.05, "followup_days": 3}'::jsonb);

-- ========== RLS ==========
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.quotes enable row level security;
alter table public.ai_chat_logs enable row level security;
alter table public.ai_usage enable row level security;
alter table public.settings enable row level security;

-- profiles:本人可讀寫自己;admin 全部
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id or public.is_admin());
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id or public.is_admin());

-- products:上架商品公開可讀;admin 全部
create policy "products_public_read" on public.products
  for select using (status = 'active' or public.is_admin());
create policy "products_admin_write" on public.products
  for all using (public.is_admin());

-- orders:本人可讀自己的;admin 全部(建立一律走 server service role)
create policy "orders_select_own" on public.orders
  for select using (auth.uid() = user_id or public.is_admin());
create policy "orders_admin_write" on public.orders
  for all using (public.is_admin());

create policy "order_items_select_own" on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())
    )
  );
create policy "order_items_admin_write" on public.order_items
  for all using (public.is_admin());

-- quotes / ai_chat_logs / ai_usage / settings:僅 admin(公開讀取走 server token 查詢)
create policy "quotes_select_own" on public.quotes
  for select using (auth.uid() = user_id or public.is_admin());
create policy "quotes_admin_write" on public.quotes
  for all using (public.is_admin());
create policy "chat_logs_admin" on public.ai_chat_logs
  for all using (public.is_admin());
create policy "ai_usage_admin" on public.ai_usage
  for all using (public.is_admin());
create policy "settings_admin" on public.settings
  for all using (public.is_admin());

-- ========== updated_at 自動更新 ==========
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_profiles before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger touch_products before update on public.products
  for each row execute function public.touch_updated_at();
create trigger touch_orders before update on public.orders
  for each row execute function public.touch_updated_at();
create trigger touch_quotes before update on public.quotes
  for each row execute function public.touch_updated_at();
create trigger touch_chat_logs before update on public.ai_chat_logs
  for each row execute function public.touch_updated_at();
