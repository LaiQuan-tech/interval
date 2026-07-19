-- 小時光 Little Moments 改造:商品三模式(藝術/旅程/會員)、點數帳本、會員等級、預約參訪
-- 沿用既有風格(裸 alter/create + RLS 全開;由 provision 的 _migrations 表去重,不需 IF NOT EXISTS)

-- ========== products 擴充(藝術品 / 旅程 / 會員方案 三模式) ==========
alter table public.products add column product_type text not null default 'artwork'
  check (product_type in ('artwork', 'journey', 'membership'));
alter table public.products add column price_rental_monthly integer; -- 月租價(僅 artwork)
alter table public.products add column points_price integer;          -- 可折抵點數(journey 用)
alter table public.products add column metadata jsonb not null default '{}'::jsonb;

-- ========== order_items 購買模式 ==========
alter table public.order_items add column purchase_mode text not null default 'buyout'
  check (purchase_mode in ('buyout', 'rental', 'journey', 'membership'));
alter table public.order_items add column tier_slug text; -- membership 商品對應等級

-- ========== orders 點數 ==========
alter table public.orders add column points_used integer not null default 0 check (points_used >= 0);
alter table public.orders add column points_earned integer not null default 0 check (points_earned >= 0);

-- ========== profiles 會員等級 ==========
alter table public.profiles add column tier_slug text;
alter table public.profiles add column tier_expires_at timestamptz;

-- ========== 會員等級表 ==========
create table public.membership_tiers (
  slug text primary key,
  name text not null,
  price_yearly integer not null check (price_yearly >= 0), -- 年費(TWD)
  rebate_rate numeric not null check (rebate_rate >= 0),    -- 消費回饋 %(每消費 NT$100 累點數 = rebate_rate)
  perks jsonb not null default '[]'::jsonb,
  sort int not null default 0
);

-- ========== 點數帳本(仿 realreal points_ledger) ==========
create table public.points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  delta integer not null,
  source text not null check (source in ('earn', 'redeem', 'expire', 'refund', 'manual_adjust', 'promo')),
  source_ref_id text,
  note text,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- 冪等關鍵:同一 (user, source, source_ref_id) 只能存在一筆(earn 對應訂單、expire 對應原 earn id 等)
create unique index points_ledger_dedupe on public.points_ledger (user_id, source, source_ref_id)
  where source_ref_id is not null;
create index points_ledger_user_id_idx on public.points_ledger (user_id, created_at desc);

create view public.v_user_points_balance as
  select user_id, coalesce(sum(delta), 0)::int as balance
  from public.points_ledger
  group by user_id;

-- 可到期沖銷的 earn 批次(尚未寫過對應 expire 的):worker 排程用,避免每次全表掃描已處理過的紀錄
create view public.v_expirable_earn_points as
  select e.id, e.user_id, e.delta
  from public.points_ledger e
  where e.source = 'earn'
    and e.expires_at is not null
    and e.expires_at < now()
    and not exists (
      select 1 from public.points_ledger x
      where x.source = 'expire' and x.source_ref_id = e.id::text
    );

-- ========== 預約參訪 ==========
create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  visit_date date,
  purpose text,
  message text,
  status text not null default 'new' check (status in ('new', 'confirmed', 'done', 'cancelled')),
  created_at timestamptz not null default now()
);

create index bookings_created_at_idx on public.bookings (created_at desc);

-- ========== 跨表外鍵(等 membership_tiers 建立後補上,仿既有 orders_quote_id_fkey 寫法) ==========
alter table public.order_items
  add constraint order_items_tier_slug_fkey
  foreign key (tier_slug) references public.membership_tiers (slug) on delete set null;
alter table public.profiles
  add constraint profiles_tier_slug_fkey
  foreign key (tier_slug) references public.membership_tiers (slug) on delete set null;

-- ========== RLS ==========
alter table public.membership_tiers enable row level security;
alter table public.points_ledger enable row level security;
alter table public.bookings enable row level security;

-- membership_tiers:公開讀,admin 寫
create policy "membership_tiers_public_read" on public.membership_tiers
  for select using (true);
create policy "membership_tiers_admin_write" on public.membership_tiers
  for all using (public.is_admin());

-- points_ledger:本人(或 admin)可讀;寫入一律走 service role(不開放任何角色的 insert/update/delete policy)
create policy "points_ledger_select_own" on public.points_ledger
  for select using (auth.uid() = user_id or public.is_admin());

-- bookings:任何人(含匿名)可 insert,admin 可全部操作
create policy "bookings_public_insert" on public.bookings
  for insert with check (true);
create policy "bookings_admin_all" on public.bookings
  for all using (public.is_admin());

-- ========== 種子資料 ==========
-- 資料來源:design_handoff_littlemoments/design/小時光官網.dc.html 的 `const works` 陣列(9 筆作品)、
-- 私人旅程三列、會員沙龍三級卡片文案。價格/文案取自設計稿;年費、rate_card 單價、作品簡介與漸層色
-- 為設計稿未提供之欄位,由本次實作者依品牌調性合理擬定(見交接說明)。

-- ---------- 9 件藝術作品(product_type='artwork') ----------
insert into public.products
  (slug, name, description, price, currency, category, stock, status, featured, sort_order,
   product_type, price_rental_monthly, metadata)
values
  ('misty-harbor-morning', '晨霧中的港灣', '薄霧未散的港灣,光影在水面緩緩甦醒。',
   12800, 'TWD', '風景', 5, 'active', true, 1,
   'artwork', 680, '{"tag":"landscape","medium":"Giclée","gradient":["#ece1cd","#bfa06a"]}'::jsonb),
  ('afternoon-botanical-garden', '午後的植物園', '溫室裡的靜謐光線,葉脈間流動著午後的閒適。',
   9600, 'TWD', '植物', 5, 'active', true, 2,
   'artwork', 580, '{"tag":"botanical","medium":"Giclée","gradient":["#e2d7c4","#7a6b52"]}'::jsonb),
  ('distant-clouds', '遠行的雲層', '層疊雲影向遠方鋪展,像一段尚未啟程的旅途。',
   14200, 'TWD', '風景', 5, 'active', true, 3,
   'artwork', 720, '{"tag":"landscape","medium":"Canvas","gradient":["#d8c9a8","#8a7259"]}'::jsonb),
  ('still-life-and-light', '靜物與光', '器物與光影的對話,日常之中見永恆。',
   8800, 'TWD', '靜物', 5, 'active', false, 4,
   'artwork', 540, '{"tag":"still life","medium":"Giclée","gradient":["#f4ede0","#9a7d47"]}'::jsonb),
  ('abstract-midnight', '抽象的午夜', '深夜色階的流動筆觸,收藏一場無聲的夢境。',
   15600, 'TWD', '抽象', 5, 'active', false, 5,
   'artwork', 760, '{"tag":"abstract","medium":"Canvas","gradient":["#2e2519","#a2854a"]}'::jsonb),
  ('coastline-memory', '海岸線的記憶', '潮汐反覆書寫的海岸線,封存成一幅溫柔的記憶。',
   11400, 'TWD', '風景', 5, 'active', false, 6,
   'artwork', 640, '{"tag":"landscape","medium":"Giclée","gradient":["#e3c98f","#5a4d3b"]}'::jsonb),
  ('lily-by-the-window', '窗邊的百合', '晨光穿過百合花瓣,落在窗邊安靜的一角。',
   9200, 'TWD', '植物', 5, 'active', false, 7,
   'artwork', 560, '{"tag":"botanical","medium":"Giclée","gradient":["#ece1cd","#a2854a"]}'::jsonb),
  ('golden-fields', '金色的原野', '夕陽為原野鍍上一層溫暖的金色餘暉。',
   13600, 'TWD', '風景', 5, 'active', false, 8,
   'artwork', 700, '{"tag":"landscape","medium":"Canvas","gradient":["#e2d7c4","#bfa06a"]}'::jsonb),
  ('flowing-forms', '流動的形狀', '色彩與線條自由流動,捕捉瞬間的抽象詩意。',
   10800, 'TWD', '抽象', 5, 'active', false, 9,
   'artwork', 620, '{"tag":"abstract","medium":"Giclée","gradient":["#2a2016","#e3c98f"]}'::jsonb)
on conflict (slug) do nothing;

-- ---------- 3 條私人旅程(product_type='journey') ----------
insert into public.products
  (slug, name, description, price, currency, category, stock, status, featured, sort_order,
   product_type, points_price, metadata)
values
  ('journey-kyoto', '京都．侘寂與慢時光', '私人茶室、寺院庭園與職人工坊,四天三夜的靜謐策展之旅。',
   128000, 'TWD', '私人旅程', 999, 'active', true, 1,
   'journey', 6400, '{"duration":"四天三夜"}'::jsonb),
  ('journey-tuscany', '托斯卡尼．莊園與油畫光影', '私人莊園住宿、酒莊晚宴與文藝復興藝術導覽,六天五夜。',
   268000, 'TWD', '私人旅程', 999, 'active', false, 2,
   'journey', 13400, '{"duration":"六天五夜"}'::jsonb),
  ('journey-hokkaido', '北海道．雪原與留白美學', '溫泉私邸、雪景攝影與在地食材餐桌,五天四夜的療癒行旅。',
   156000, 'TWD', '私人旅程', 999, 'active', false, 3,
   'journey', 7800, '{"duration":"五天四夜"}'::jsonb)
on conflict (slug) do nothing;

-- ---------- 3 個會員等級(表格資料,供顯示與回饋率計算) ----------
insert into public.membership_tiers (slug, name, price_yearly, rebate_rate, perks, sort)
values
  ('silver', '緻銀會員', 3600, 1,
   '["消費每 NT$100 累積 1 點","藝術品買斷 95 折","生日禮遇雙倍點數","專屬電子選畫刊物"]'::jsonb, 1),
  ('gold', '璀金會員', 8800, 1.5,
   '["消費每 NT$100 累積 1.5 點","藝術品買斷 9 折、租賃 95 折","每季私人鑑賞會邀請","旅程體驗點數兌換優先"]'::jsonb, 2),
  ('platinum', '典藏會員', 18800, 2,
   '["消費每 NT$100 累積 2 點","藝術品買斷 85 折、租賃 9 折","專屬藝術顧問一對一","私人旅程年度禮遇席位"]'::jsonb, 3)
on conflict (slug) do nothing;

-- ---------- 3 個會員方案商品(product_type='membership',metadata.tier_slug 對應 membership_tiers) ----------
insert into public.products
  (slug, name, description, price, currency, category, stock, status, featured, sort_order,
   product_type, metadata)
values
  ('membership-silver', '緻銀會員', '消費每 NT$100 累積 1 點、藝術品買斷 95 折、生日禮遇雙倍點數、專屬電子選畫刊物。',
   3600, 'TWD', '會員方案', 999, 'active', false, 1,
   'membership', '{"tier_slug":"silver"}'::jsonb),
  ('membership-gold', '璀金會員', '消費每 NT$100 累積 1.5 點、藝術品買斷 9 折租賃 95 折、每季私人鑑賞會邀請、旅程點數兌換優先。',
   8800, 'TWD', '會員方案', 999, 'active', true, 2,
   'membership', '{"tier_slug":"gold"}'::jsonb),
  ('membership-platinum', '典藏會員', '消費每 NT$100 累積 2 點、藝術品買斷 85 折租賃 9 折、專屬藝術顧問一對一、私人旅程年度禮遇席位。',
   18800, 'TWD', '會員方案', 999, 'active', false, 3,
   'membership', '{"tier_slug":"platinum"}'::jsonb)
on conflict (slug) do nothing;

-- ---------- settings:改為小時光品牌(此處刻意 on conflict do update,蓋掉 init.sql 種下的 interval 預設值) ----------
insert into public.settings (key, value) values
  ('company_profile', '{
    "name": "小時光 Little Moments",
    "tagline": "為懂得生活的人，典藏值得停留的時光",
    "email": "salon@littlemoments.tw",
    "phone": "+886 2 0000 0000",
    "address": "台北市大安區　小時光書店",
    "hours": "週二至週日 11:00–20:00",
    "about": "結合線下書店門市與線上藝術銷售的品牌：提供 AI 藝術畫作（月租／先租後買／買斷）、量身訂製的私人旅程，以及三級會員點數禮遇。"
  }'::jsonb),
  ('rate_card', '{
    "note": "AI 報價依此費率卡計算,請在後台維護",
    "items": [
      {"name": "客製 AI 創作畫作", "unit_price": 15000, "unit": "幅", "min_quantity": 1, "note": "依尺寸與裝裱材質調整,此為基準價"},
      {"name": "私人旅程規劃－國內", "unit_price": 45000, "unit": "趟", "min_quantity": 1, "note": "2-4人小型客製行程起始價"},
      {"name": "私人旅程規劃－海外", "unit_price": 150000, "unit": "趟", "min_quantity": 1, "note": "依目的地與天數調整"},
      {"name": "藝術顧問到府", "unit_price": 3000, "unit": "次", "min_quantity": 1, "note": "含選畫建議與空間評估,車馬費另計"},
      {"name": "企業空間藝術租賃方案", "unit_price": 8000, "unit": "月", "min_quantity": 3, "note": "依坪數與作品數量報價,最低承租 3 個月"}
    ]
  }'::jsonb)
on conflict (key) do update set value = excluded.value, updated_at = now();
