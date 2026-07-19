# 技術棧、資料模型與部署 — 小時光官網

> 目標平台：**GitHub**（版控）→ **Vercel**（前端 / SSR）→ **Supabase**（Postgres + Auth + Storage）→ **Railway**（背景服務 / 排程 / 通知 worker）。本文件讓 Claude Code 能從零把 `design/` 的設計還原成可上線的網站。

---

## 一、建議技術棧

| 層 | 選型 | 原因 |
|---|---|---|
| 前端框架 | **Next.js 14+（App Router）+ TypeScript** | 與 Vercel 原生整合、SSR/SEO、路由清楚 |
| 樣式 | **Tailwind CSS** + CSS 變數（見下方 token 對應） | 快速像素還原、好維護 |
| UI 狀態 | React Server Components + 少量 client component | 表單、chip、導覽 active |
| 資料庫 / 認證 / 儲存 | **Supabase**（Postgres、Auth、Storage、RLS） | 會員系統、畫作圖、預約單 |
| 背景工作 | **Railway**（Node worker / cron） | 寄送預約通知、點數結算、租賃到期提醒 |
| 版控 / CI | **GitHub** → Vercel 自動部署 | PR 預覽、main 上 production |

> 若你（Claude Code）判斷有更合適選型可調整，但請維持「像素級還原設計 + 四平台部署」兩大前提。

### 建議 Repo 結構
```
littlemoments/
├── app/
│   ├── layout.tsx                # 全域字體、header、footer
│   ├── page.tsx                  # 首頁 Home
│   ├── gallery/page.tsx          # 藝術典藏（Server：讀 artworks）
│   ├── journeys/page.tsx         # 私人旅程
│   ├── rental/page.tsx           # 租賃 · 買斷
│   ├── membership/page.tsx       # 會員沙龍
│   ├── booking/page.tsx          # 預約參訪（含表單 client component）
│   └── api/booking/route.ts      # 收預約 → 寫 Supabase → 觸發通知
├── components/                   # Header, Footer, ArtworkCard, PlanCard...
├── lib/supabase/                 # client / server helpers
├── styles/                       # tailwind + tokens
├── supabase/
│   ├── migrations/               # schema SQL（見第三節）
│   └── seed.sql                  # 作品 / 旅程 / 方案 seed
├── worker/                       # Railway 背景服務（通知、cron）
├── .env.example
└── README.md
```

---

## 二、設計 Token → Tailwind

在 `tailwind.config` 的 `theme.extend.colors` 對應 README 第七節：
```js
colors: {
  paper:   '#faf6ee', panel: '#f4ede0',
  ink:     '#2e2519', 'ink-strong': '#2a2016',
  nav:     '#4d4132', body: '#5a4d3b',
  muted:   '#7a6b52', 'muted-2': '#8a7259',
  gold:    '#bfa06a', 'gold-deep': '#9a7d47', 'gold-warm': '#a2854a', 'gold-lite': '#e3c98f',
  line:    '#d8c9a8', 'line-2': '#e2d7c4', placeholder: '#ece1cd',
  cream:   '#f7f1e5',
}
```
字體：`fontFamily.serif = ['"Noto Serif TC"', 'serif']`、`fontFamily.display = ['"Cormorant Garamond"', 'serif']`、`fontFamily.sans = ['"Noto Sans TC"', 'sans-serif']`。斷點沿用 Tailwind（`xl≈1024`, `lg≈820` 用 custom、`sm≈520` 用 custom）— 或自訂 `screens: { sm:'520px', md:'820px', lg:'1024px' }` 對齊 README 斷點。整體圓角趨近 0（`rounded-[2px]`）。

---

## 三、Supabase 資料模型

> 以下為建議 schema（`supabase/migrations/0001_init.sql`）。啟用 RLS，會員資料綁 `auth.users`。

```sql
-- 會員（延伸 auth.users）
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  title text,                       -- 稱謂（王夫人…）
  phone text,
  tier text not null default 'silver',   -- silver | gold | platinum
  points integer not null default 0,
  created_at timestamptz default now()
);

-- 藝術畫作
create table artworks (
  id uuid primary key default gen_random_uuid(),
  title text not null,              -- 晨霧中的港灣
  category text not null,           -- landscape | abstract | still_life | botanical
  medium text,                      -- Giclée | Canvas
  image_url text,                   -- Supabase Storage
  rent_monthly integer,             -- 月租價（NT$）
  buyout_price integer,             -- 買斷價（NT$）
  status text not null default 'available',  -- available | rented | sold
  featured boolean default false,
  created_at timestamptz default now()
);

-- 租賃合約（含先租後買）
create table rentals (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references profiles(id),
  artwork_id uuid references artworks(id),
  plan text not null,               -- monthly | rent_to_own
  monthly_price integer not null,
  started_at date not null,
  next_swap_date date,              -- 每季換畫
  ends_at date,
  converted_to_buyout boolean default false,
  status text not null default 'active',  -- active | ended | converted
  created_at timestamptz default now()
);

-- 買斷 / 訂單
create table purchases (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references profiles(id),
  artwork_id uuid references artworks(id),
  price integer not null,
  discount_pct integer default 0,   -- 會員折扣
  certificate_no text,              -- 收藏證書編號
  created_at timestamptz default now()
);

-- 客製旅程
create table journeys (
  id uuid primary key default gen_random_uuid(),
  title text not null,              -- 京都．侘寂與慢時光
  summary text,
  image_url text,
  price_from integer,               -- NT$
  points_price integer,             -- 可用點數
  duration text,                    -- 四天三夜
  active boolean default true
);

-- 點數異動（累點 / 兌換）
create table point_transactions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references profiles(id),
  delta integer not null,           -- +累點 / -兌換
  reason text,                      -- purchase | rental | visit | redeem_journey | redeem_discount | birthday
  ref_id uuid,                      -- 關聯訂單/旅程
  created_at timestamptz default now()
);

-- 預約參訪 / 到府顧問
create table bookings (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references profiles(id),   -- 可為 null（非會員）
  name text not null,
  phone text not null,
  party_size integer,
  purpose text,                     -- 鑑賞畫作 | 租賃·買斷 | 規劃旅程 | 入會諮詢 | 到府顧問
  preferred_date date,
  preferred_slot text,              -- 上午 | 下午 | 傍晚
  note text,
  status text not null default 'new',  -- new | confirmed | done | cancelled
  created_at timestamptz default now()
);
```

**會員分級規則（供 worker / API 計算）**
- 累點率：Silver 1 點 / NT$100；Gold 1.5；Platinum 2。
- 折扣：Silver 買斷 95 折；Gold 買斷 9 折、租賃 95 折；Platinum 買斷 85 折、租賃 9 折。
- 兌換範例：500pt→租賃折 NT$500、1,200pt→私人鑑賞午茶席、6,400pt→京都旅程、13,400pt→托斯卡尼旅程。

**RLS 重點**：`profiles / rentals / purchases / point_transactions` 只允許本人讀寫；`artworks / journeys` 公開讀；`bookings` 允許 insert（含匿名），僅後台讀。

**Storage**：bucket `artworks`、`journeys`、`store`（門市照）。資料表存公開 URL。

**Seed**：把 README 提到的 9 幅作品、3 條旅程、3 種租賃方案數值寫入 `seed.sql`（作品與旅程數值見 `design/小時光官網.dc.html` 的 logic 區）。

---

## 四、Railway 背景服務（worker/）

Railway 跑一個 Node 服務，負責前端不該做的事：
1. **預約通知**：`api/booking` 寫入後，worker 監聽（Supabase Realtime 或 webhook）→ 寄 email / 通知門市。
2. **點數結算**：訂單完成後依會員分級累點，寫 `point_transactions` 並更新 `profiles.points`。
3. **Cron**：租賃到期 / 每季換畫提醒、生日雙倍點數。
4. 建議用 Supabase **service role key**（僅存在 Railway 環境變數，切勿進前端）。

---

## 五、環境變數（.env.example）

```
# Supabase（Vercel 前端）
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Supabase（Railway worker，勿放前端）
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_URL=

# 通知（擇一）
RESEND_API_KEY=            # 或 SMTP_*
STORE_NOTIFY_EMAIL=
```

---

## 六、部署步驟

**1. GitHub**
```bash
git init && git add . && git commit -m "init: 小時光官網"
git branch -M main
git remote add origin git@github.com:<you>/littlemoments.git
git push -u origin main
```

**2. Supabase**
- 建立 project → 於 SQL Editor 執行 `supabase/migrations/*.sql` 與 `seed.sql`。
- 建立 Storage buckets（`artworks`/`journeys`/`store`），上傳圖片。
- 複製 `Project URL` / `anon key` / `service_role key`。
- 設定 Auth（Email/OTP 或社群登入）供會員系統。

**3. Vercel（前端）**
- Import GitHub repo → Framework 選 Next.js。
- 填入 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`。
- Deploy。之後每次 push main 自動部署，PR 有預覽網址。

**4. Railway（worker）**
- New Project → Deploy from GitHub repo（root 指到 `worker/`，或 monorepo 設 root directory）。
- 填 `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / 通知變數。
- 若需排程，設定 Railway Cron。

**5. 網域**：於 Vercel 綁定自訂網域（例如 littlemoments.tw）。

---

## 七、給 Claude Code 的起手 Prompt（可直接貼）

> 我要把 `design_handoff_littlemoments/design/小時光官網.dc.html` 這份高擬真設計稿，**像素級還原**成正式網站。技術棧：Next.js 14 App Router + TypeScript + Tailwind，資料用 Supabase（Postgres/Auth/Storage），背景服務用 Railway，版控 GitHub、前端部署 Vercel。
>
> 請依 `README.md`（設計規格與 token）與 `STACK_AND_DEPLOY.md`（schema 與部署）：
> 1. 建立 Next.js 專案與 `tailwind.config`（對應 token 顏色 / 字體 / 斷點）。
> 2. 實作六個頁面（首頁 / 藝術典藏 / 私人旅程 / 租賃買斷 / 會員沙龍 / 預約參訪）與共用 Header/Footer，改用真實路由，桌機像素還原、並保留三個 RWD 斷點。
> 3. 建 Supabase migrations + seed（作品 / 旅程 / 方案數值取自設計稿 logic）。
> 4. 預約表單串 `api/booking` 寫入 Supabase；會員系統接 Supabase Auth；點數規則照 README。
> 5. 準備 Railway worker 骨架（預約通知 / 點數結算 / cron）與 `.env.example`。
>
> 先產出檔案結構與 `app/layout.tsx`、首頁，讓我確認視覺還原度，再往後做。所有圖片先用 placeholder，之後替換為 Supabase Storage URL。
