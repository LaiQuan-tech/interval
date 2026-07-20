# 小時光後台版面改造 — 設計

日期：2026-07-20

## 問題

後台（`/admin`）目前有三個具體缺陷，手機上尤其明顯：

1. **後台被套上顧客端外殼。** 根 layout（`web/src/app/layout.tsx`）對所有路由渲染 `Header`／`Footer`／`ChatWidget`／`CartFlyout`。管理自己的店時，畫面上方是「首頁／藝術典藏／私人旅程／購物車／預約參訪」，下方是顧客用頁尾，右下角還有 AI 客服泡泡。手機上這些吃掉超過半個螢幕，且會誤觸。
2. **容器 class 未定義導致內容溢出。** `app/admin/layout.tsx:37` 使用 `iv-container`，但 `globals.css` 中**沒有這個 class**（全專案僅此一處使用）。結果後台內容沒有最大寬度與左右留白，貼齊螢幕邊緣，寬表格右側被裁切（報價列表的「日期」欄看不到）。
3. **導覽是頂部橫向捲動的藥丸列，且無 active 狀態。** 七個項目在手機上要橫捲才找得到，也看不出目前在哪一頁。

## 目標

- 後台脫離顧客端外殼，成為獨立的管理介面。
- 桌機：左側固定側邊欄。
- 手機：底部分頁列，拇指可直接切換；清單不再被裁切。
- 針對實際使用情境優化：**查訂單／改訂單狀態**與**審核 AI 報價並寄出**是手機上最常做的兩件事。

## 非目標

- 不改後台的商業邏輯（訂單狀態機、報價審核、點數核發一律不動）。
- 不改顧客端的視覺或版面。
- 不改網址（route group 不影響 URL）。
- 不做無關的重構。

## 設計

### 1. 路由結構：用 route group 分離兩種外殼

```
app/layout.tsx            只留 <html>/<body>/字體/metadata（共用）
app/(storefront)/layout.tsx   Header + Footer + ChatWidget + CartFlyout
app/(storefront)/…            顧客端頁面（網址不變）
app/admin/layout.tsx          後台外殼（側邊欄 + 底部分頁）
app/not-found.tsx             留在根層（見下方決策）
```

搬進 `(storefront)/` 的項目：`account`、`booking`、`cart`、`checkout`、`gallery`、`journeys`、`login`、`membership`、`orders`、`products`、`quote`、`quote-info`、`rental` 共 13 個資料夾，以及根層的 `page.tsx`（首頁）。

`app/api/` 與 `app/admin/` 留在原位。

**決策：`not-found.tsx` 留在根層。** App Router 中只有根層的 `not-found.tsx` 會接住所有未匹配的網址；移進 route group 會讓它失效。代價是 404 頁不再有顧客端導覽列。此頁本來就是「置中訊息＋回到首頁按鈕」，維持現狀可接受，不另做處理。

**好處**：後台不再載入購物車與 AI 客服的 client JS。

### 2. 後台外殼

保留現有的守衛邏輯（登入 + `profiles.role === 'admin'`，否則 redirect）。外殼分兩種斷點，以 `lg`（1024px）切換。

**桌機（≥1024px）**：左側固定側邊欄，寬 220px。
- 頂部：「小時光 後台」
- 選單（完整七項）：總覽／訂單／報價／商品／會員／預約／設定，每項圖示＋文字
- **Active 高亮**：目前頁面以金色底＋深色字標示
- **待處理徽章**：訂單與報價旁顯示數字
- 底部：管理員 email、登出、回前台

**手機（<1024px）**：
- 頂部細長列：目前頁面標題
- 底部固定分頁列四項：**訂單／報價／商品／更多**（同樣帶徽章）
- 「更多」開啟由下往上的面板，含：總覽、會員、預約、設定、email、登出、回前台
- 內容區底部保留 padding，避免最後一列被分頁列蓋住

分頁列順序反映使用頻率（訂單、報價最常用）。

**Active 判定**：`/admin` 用完全相符；其餘用 `pathname.startsWith(item.href)`，避免 `/admin` 在所有子頁都亮起。

### 3. 徽章數量

後台 layout 在伺服器端查兩個數字：
- 待付款訂單：`orders` 中 `status = 'pending'`
- 草稿報價：`quotes` 中 `status = 'draft'`

用 count query（不取整列）。任一查詢失敗時徽章不顯示，不可讓 layout 整個爆掉。數字為 0 時不顯示徽章。

### 4. 容器修正

移除未定義的 `iv-container`，改用明確的 Tailwind：內容區 `mx-auto w-full max-w-[1400px] px-4 sm:px-6`。不新增全域 class（全專案只有這一處用到它）。

### 5. 清單：桌機表格 / 手機卡片

五個清單頁（訂單、報價、商品、會員、預約）採同一模式：

- **桌機（≥lg）**：維持現有 `<table>`，一次掃多筆最有效率。
- **手機（<lg）**：改為一列一張卡片，`lg:hidden` 與 `hidden lg:block` 兩份標記切換。

共用結構：第一行＝主要識別碼＋狀態 chip；第二行＝次要資訊；第三行＝動作（高度 ≥40px 好按，無動作時省略）。訂單範例：

```
IV-2026-00007                      待付款
王小姐 · NT$ 12,800 · 07/20
[ 標記已付款 ]  [ 查看 ]
```

各清單的欄位對應：

| 清單 | 主要識別碼 | 次要資訊 | 動作 |
|---|---|---|---|
| 訂單 | 訂單編號＋狀態 | 客戶姓名 · 金額 · 日期 | 下一個狀態按鈕（沿用既有 `OrderStatusButtons`）＋查看 |
| 報價 | 報價單號＋狀態（含 AI 標記）| 客戶 email · 金額 · 日期 | 查看／審核 |
| 商品 | 品名＋上架狀態 | 類型 · 價格 · 庫存 | 編輯 |
| 會員 | 姓名或 email ＋等級 | 點數餘額 · 註冊日 | 查看／調點 |
| 預約 | 姓名＋狀態 | 日期 · 目的 · 電話 | 下一個狀態按鈕（沿用既有 `BookingStatusButtons`）|

動作按鈕一律重用既有元件，不重寫狀態流轉邏輯。

這同時解決了裁切問題——卡片是垂直堆疊，沒有水平溢出。

### 6. 視覺

沿用既有象牙沙龍 token 與 `iv-*` 元件（`iv-card`、`iv-chip`、`iv-btn-*`、`iv-input`）。後台密度略高於顧客端（管理工具，資訊優先），但配色一致。側邊欄底用 `--color-panel`，與內容區的 `--color-paper` 區分。

## 元件與檔案

| 檔案 | 動作 |
|---|---|
| `app/layout.tsx` | 改：移除 Header/Footer/ChatWidget/CartFlyout，只留 html/body/字體/metadata |
| `app/(storefront)/layout.tsx` | 新增：承接上述四個顧客端元件 |
| `app/(storefront)/**` | 搬移：13 個資料夾 + 首頁 `page.tsx` |
| `app/admin/layout.tsx` | 改寫：守衛不動，換成新外殼 + 徽章查詢 |
| `components/admin/AdminSidebar.tsx` | 新增：桌機側邊欄（client，需 `usePathname` 判 active） |
| `components/admin/AdminBottomNav.tsx` | 新增：手機底部分頁 + 「更多」面板（client） |
| `components/admin/AdminNavItems.ts` | 新增：導覽項目與圖示的單一來源，兩個元件共用 |
| `app/admin/{orders,quotes,products,members,bookings}/page.tsx` | 改：加手機卡片版清單 |

導覽項目定義集中在一處，避免側邊欄與分頁列各自維護一份而漂移。

## 驗證

1. `npm run lint --workspace web`、`npm run typecheck --workspace web`、`npm run build --workspace web` 全綠。
2. 建置後路由表確認：所有顧客端網址不變（`/`、`/gallery`、`/journeys`、`/rental`、`/membership`、`/booking`、`/products/[slug]`、`/cart`、`/checkout`、`/account`、`/login`、`/orders/[token]`、`/quote/[token]`、`/quote-info`）。
3. 瀏覽器實測（桌機 1280px 與手機 390px 兩種寬度）：
   - 顧客端頁面仍有 Header/Footer/客服/購物車，外觀無變化。
   - `/admin` 沒有顧客端 Header/Footer/客服泡泡。
   - 桌機：側邊欄存在，點各頁 active 高亮正確。
   - 手機：底部分頁列可見且可切換，「更多」面板可開，內容不被遮住。
   - 手機上五個清單頁都不再水平溢出（`document.body.scrollWidth <= window.innerWidth`）。
   - 訂單卡片的「標記已付款」在手機上可按，且狀態正確更新。
4. 非管理員登入 `/admin` 仍被導走（守衛未壞）。

## 風險

- **搬檔破壞路由**：route group 不改網址，但搬錯資料夾會 404。以建置後的路由表逐條核對（驗證項目 2）。
- **`not-found.tsx` 失去導覽列**：已知且接受（見決策）。
- **徽章查詢拖慢後台**：兩個 count query，失敗時靜默略過，不阻塞頁面。
