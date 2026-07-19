# interval — 賣到全世界

跨境電商全端應用:**官網 + 會員系統 + 電商後台 + AI 自動報價/引導下單**。

- **web/** — Next.js 15(App Router)→ 部署 **Vercel**
- **api/** — Hono 背景服務(報價/訂單追蹤排程)→ 部署 **Railway**
- **supabase/** — Postgres schema(RLS 全開)+ Auth 會員系統 → **Supabase**
- Email 通知 → **Resend**;AI → **Anthropic Claude**(未設 key 時自動退化為規則式,流程不中斷)

## 功能總覽

| 區塊 | 內容 |
|---|---|
| 店面 | 首頁 / 商品列表與詳情 / 購物車 / 結帳(銀行轉帳、貨到付款)/ 訂單查詢頁(token) |
| 會員 | Email 註冊登入(Supabase Auth)、會員中心(訂單、報價單、個人資料)|
| AI 報價 | 右下角智慧客服(串流回覆)→ 偵測報價意圖 → 依「費率卡」自動產生**報價草稿** → 管理員後台核准寄出 → 客戶一鍵接受 → **自動轉訂單** |
| 後台 `/admin` | 總覽儀表板 / 訂單管理(狀態流轉+自動通知信)/ 報價審核編輯 / 商品 CRUD / 會員管理 / 費率卡與公司設定 |
| 排程(Railway)| 報價過期處理、報價/訂單付款提醒(每小時檢查、單發不重複)|

設計參考:[gather-landing](https://github.com/Gathertaiwan-Group/gather-landing) 的 AI 報價流程(AI 絕不自行報價,人審後寄出)、[realreal](https://github.com/realreal919/realreal) 的會員/RLS/後台架構。

## 快速開始(一鍵佈建)

```bash
npm install

SUPABASE_ACCESS_TOKEN=sbp_xxx \
VERCEL_TOKEN=xxx \
RAILWAY_TOKEN=xxx \
RESEND_API_KEY=re_xxx \
ANTHROPIC_API_KEY=sk-ant-xxx \
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=一組安全密碼 \
node scripts/provision.mjs
```

腳本會自動(**冪等,可重複執行**):

1. 建立 Supabase 專案 → 套用 `supabase/migrations` → 開啟註冊自動確認 → 建立管理員帳號
2. 建立 Vercel 專案並**綁定本 GitHub repo**(push `main` 即自動部署)→ 寫入環境變數 → 觸發首次部署
3. 建立 Railway 專案 + `api` 服務(綁定 repo,依 `railway.toml` 建置)→ 寫入環境變數 → 產生網域

前置需求(各做一次):
- Vercel 帳號已安裝 [GitHub App](https://vercel.com/account/git) 並授權本 repo
- Railway 帳號已[連結 GitHub](https://railway.app/account) 並授權本 repo
- Resend 正式寄信需[驗證網域](https://resend.com/domains)(未驗證前用 `onboarding@resend.dev`,只能寄給自己)

完成後:**push 到 `main` → Vercel(網站)與 Railway(API)自動部署**;GitHub Actions 會先跑 lint / typecheck / build(見 `.github/workflows/ci.yml`)。

## 本地開發

```bash
npm install
cp .env.example web/.env.local   # 填入 Supabase 等值
npm run dev        # web → http://localhost:3000
npm run dev:api    # api → http://localhost:8080
```

## AI 報價流程(重要設計)

1. 客戶跟智慧客服對話,AI **絕不直接報價**
2. 偵測到報價意圖 + 拿到 email → 依後台「費率卡」自動產生**草稿**
3. 管理員在 `/admin/quotes` 審核、編輯品項 → 「核准並寄出」
4. 客戶收到 email → 打開 `/quote/<token>` → 「接受報價」→ **訂單自動成立**,付款資訊寄出

費率卡在 `/admin/settings` 維護;AI 只能使用費率卡上的品項與價格。

## 環境變數

見 `.env.example`。重點:

- `SUPABASE_SERVICE_ROLE_KEY` 只放 server(Vercel/Railway 環境變數),**絕不進 repo**
- 沒有 `ANTHROPIC_API_KEY` 時聊天/報價退化為規則式,仍可完整走完流程
- 沒有 `RESEND_API_KEY` 時 email 靜默停用,不影響下單

## 安全模型

- 所有資料表開 RLS;公開頁(訂單/報價)一律經 server 以隨機 token 讀取
- 商品公開讀;訂單/報價僅本人與 admin;寫入走 service role
- `/admin` 由 layout 檢查 `profiles.role = 'admin'`;server actions 每次再驗證
