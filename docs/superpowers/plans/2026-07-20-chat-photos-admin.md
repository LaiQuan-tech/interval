# 後台可見客戶照片 ＋ 對話圖片私密化 實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: 用 superpowers:subagent-driven-development 逐任務執行。

**Goal:** 讓後台在報價詳情頁看得到客戶上傳的空間照與 AI 模擬圖；同時修掉「圖片訊息會被覆寫消失」的資料遺失 bug，並把客戶家中照片從公開 bucket 改為私密 + 簽名網址。

**Architecture:** 訊息不再存「永久公開網址」，改存 **storage 路徑**（`imagePath`），在渲染當下即時產生簽名網址。`/api/chat` 改為伺服器權威 append，不再用前端歷史覆寫整列。

**Tech Stack:** Next.js 15 App Router、Supabase Storage、TypeScript。

---

## 現況（已由 Explore 查證，附行號）

- 客戶原圖與模擬圖**都有存**：`api/chat/mockup/route.ts:152-162`，bucket `chat-uploads`（`rooms/<uuid>.jpg`、`mockups/<uuid>.jpg`）。
- 訊息物件已有 `imageUrl`：`lib/types.ts:139-143`；mockup 寫入於 `mockup/route.ts:192`。
- 後台**有資料但沒渲染**：`app/admin/quotes/[id]/page.tsx:75` 只印 `m.content`。
- 前台已有可重用的圖片渲染：`components/ChatWidget.tsx:319-327`。
- **資料遺失 bug**：`api/chat/route.ts:127-142` 用前端傳來的最後 12 則覆寫整個 `messages`（前端只送 12 則：`ChatWidget.tsx:127`），超過 12 則後圖片訊息從 DB 永久消失，並讓每 session 3 張的上限可被繞過（`mockup/route.ts:122-124`）。
- bucket 目前 `public = true`：`supabase/migrations/20260720000001_checkout_v2.sql:20`，且 `storage.objects` **無任何 RLS policy**。
- 後台讀 `ai_chat_logs` 用 service role：`app/admin/quotes/[id]/page.tsx:22-31`，靠 `quote.session_id` 關聯。

---

## Task 1: 對話紀錄改為伺服器權威 append（修資料遺失）

**Files:** Modify `web/src/app/api/chat/route.ts`

**問題**：目前把 client 傳來的歷史整份 upsert 覆寫 `messages`。client 只送最後 12 則，所以早期帶圖的訊息會被抹掉。

- [ ] **Step 1: 改為只 append 本回合的兩則**

保留「用 client 歷史餵 Gemini」的既有行為不變（那是上下文，需要完整近期對話）；**只改寫入 DB 的部分**：先讀既有 `messages`，再 append 本回合的 user 訊息與 assistant 回覆。

實作前先讀 `web/src/app/api/chat/route.ts:100-175` 確認變數名與既有 upsert 寫法，照既有慣例改。要點：
- 用既有的 admin client 讀 `ai_chat_logs.messages`（session 可能不存在 → 視為 `[]`）
- 新陣列 = 既有 messages ＋ `{role:"user", content:<本回合使用者輸入>}` ＋ `{role:"assistant", content:<本回合回覆>}`
- **不要**把 client 傳來的歷史寫進 DB
- 既有的 contact/intent 更新邏輯不動

- [ ] **Step 2: 驗證**

`npm run lint --workspace web && npm run typecheck --workspace web && npm run build --workspace web`

行為驗證（本機 dev，不需登入後台）：開前台聊天連續送 15 則以上訊息，然後直接查 DB（用 service role 的一次性 script 或 Supabase SQL）確認 `messages` 筆數持續累積、不是固定停在 12。

- [ ] **Step 3: Commit**

```bash
git add web/src/app/api/chat/route.ts
git commit -m "fix(chat): 對話紀錄改為伺服器權威 append,不再被前端 12 則歷史覆寫

原本圖片訊息在對話超過 12 則後會從 DB 永久消失,且每 session 3 張模擬圖的上限可被繞過。"
```

---

## Task 2: bucket 轉私密、訊息改存路徑、簽名網址

**Files:**
- Create: `supabase/migrations/20260720000003_chat_uploads_private.sql`
- Modify: `web/src/lib/types.ts`、`web/src/app/api/chat/mockup/route.ts`、`web/src/components/ChatWidget.tsx`
- Create: `web/src/lib/chat-images.ts`（簽名網址與舊資料相容的單一來源）

- [ ] **Step 1: migration**

```sql
-- chat-uploads 轉為私密:客戶家中照片不應可被任意人以公開網址存取。
-- 讀取一律改走短期簽名網址(伺服器端以 service role 產生)。
update storage.buckets set public = false where id = 'chat-uploads';
```

不新增 `storage.objects` policy——寫入與簽名都走 service role（繞過 RLS），一般使用者不應能直接列舉或讀取。

- [ ] **Step 2: 型別加 `imagePath`，保留 `imageUrl` 供舊資料相容**

`web/src/lib/types.ts` 的 `ChatMessage`：新增 `imagePath?: string`（storage 內的路徑，如 `rooms/<uuid>.jpg`）。
`imageUrl?` **保留不刪**——2026-07-20 之前的既有紀錄仍只有它。註解寫明兩者關係與棄用方向。

- [ ] **Step 3: 新增 `web/src/lib/chat-images.ts`**

單一來源，兩個渲染端共用，避免邏輯漂移：

```ts
// 產生對話圖片的短期簽名網址。
// 新資料存 imagePath;2026-07-20 之前的舊資料只有公開 imageUrl,
// 由 pathFromLegacyUrl 反推路徑,讓 bucket 轉私密後舊圖仍看得到。
export function pathFromLegacyUrl(url: string): string | null
export async function signChatImage(path: string, expiresInSec?: number): Promise<string | null>
export async function resolveChatImageUrl(m: { imagePath?: string; imageUrl?: string }): Promise<string | null>
```

`pathFromLegacyUrl` 從 `.../object/public/chat-uploads/<path>` 取出 `<path>`；取不出來回 `null`。
`signChatImage` 用 service role 的 `createSignedUrl`；失敗回 `null`（呼叫端要能容忍缺圖，不可整頁爆掉）。
預設有效期先用 **1 小時**（後台看圖夠用；前台客戶當下就會看到）。

- [ ] **Step 4: mockup API 改存路徑並回簽名網址**

`web/src/app/api/chat/mockup/route.ts`：
- 上傳後**不再**用 `getPublicUrl`；改為把 `rooms/<uuid>.jpg`、`mockups/<uuid>.jpg` 兩個路徑寫進訊息的 `imagePath`
- 回給前端的 `mockupUrl` 改用 `signChatImage(mockupPath)` 產生（客戶當下要立刻看到圖）
- 寫進 `ai_chat_logs.messages` 的兩則訊息帶 `imagePath`，**不要**再寫 `imageUrl`

- [ ] **Step 5: ChatWidget 相容**

`web/src/components/ChatWidget.tsx`：
- 前端顯示仍用 API 回傳的簽名網址（`ChatWidget.tsx:319-327` 的渲染邏輯不動）
- `toApiHistory`（`:53-66`）目前刻意保留 `imageUrl`；改為連同 `imagePath` 一起保留，讓後端 append 時不遺失（**注意**：Task 1 之後 DB 寫入不再依賴 client 歷史，這裡只是保持型別一致，不要因此把 Task 1 改回去）

- [ ] **Step 6: 驗證**

lint / typecheck / build 全綠。
本機 dev 走一次完整流程：前台聊天上傳空間照 → 生成模擬圖 → 客戶端看得到圖（簽名網址）。
用 curl 直接打舊格式的公開網址（`.../object/public/chat-uploads/...`），確認 bucket 轉私密後**回 400/403 而非圖片**（這是隱私修正生效的證據）。

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260720000003_chat_uploads_private.sql web/src/lib/types.ts web/src/lib/chat-images.ts web/src/app/api/chat/mockup/route.ts web/src/components/ChatWidget.tsx
git commit -m "feat(chat): 對話圖片改私密 bucket + 簽名網址,訊息改存路徑

客戶家中照片原本以永久公開網址存放。改存 storage 路徑、渲染時即時簽名,
避免簽名網址過期後失效,並保留舊 imageUrl 的反推相容。"
```

---

## Task 3: 後台渲染對話圖片

**Files:** Modify `web/src/app/admin/quotes/[id]/page.tsx`

- [ ] **Step 1: 在對話紀錄區塊渲染圖片**

`app/admin/quotes/[id]/page.tsx:61-80` 的 map 目前只輸出 `{m.content}`（`:75`）。改為同時渲染圖片。

這是 server component，可直接 `await` 簽名：先把 `messages` 逐則解析成 `{...m, resolvedUrl}`（用 `resolveChatImageUrl`），再渲染。

視覺沿用前台既有寫法（`components/ChatWidget.tsx:319-327`），但後台密度較高：圖片加 `max-w-xs`（或等效）避免撐破版面，並用 `<a target="_blank">` 包起來可點開原圖。alt 依 role 分「客戶上傳的空間照片」/「AI 擺放模擬圖」。
簽名失敗（`resolvedUrl` 為 null）時顯示一行淡色說明文字（如「圖片已無法載入」），**不可讓整頁爆掉**。

⚠️ 手機也要能看：後台已改為手機友善版面，圖片區塊要 `break-words` 相容且不造成水平溢出。

- [ ] **Step 2: 驗證**

lint / typecheck / build 全綠。
後台實測（需登入）於 1280px 與 390px 各看一次 `/admin/quotes/<有模擬圖的報價 id>`：
- 客戶上傳的空間照與 AI 模擬圖都看得到
- `document.body.scrollWidth <= window.innerWidth` 仍為 true
- 圖片可點開

- [ ] **Step 3: Commit**

```bash
git add web/src/app/admin/quotes/[id]/page.tsx
git commit -m "feat(admin): 報價詳情的 AI 對話紀錄顯示客戶空間照與模擬圖"
```

---

## Task 4: 整體驗收

- [ ] lint / typecheck（web+api）/ build（web+api）全綠
- [ ] 舊資料相容：找一筆 2026-07-20 之前、只有 `imageUrl` 的紀錄，確認後台仍看得到圖（走 `pathFromLegacyUrl` 反推）
- [ ] 新資料：跑一次完整流程產生新的模擬圖，確認後台看得到
- [ ] 隱私：舊的公開網址直連**已失效**
- [ ] 資料保留：對話超過 12 則後，早期的圖片訊息**仍在** DB
- [ ] 顧客端聊天功能未壞（能正常對話、能生成模擬圖）

## 風險

- **轉私密會讓既有的公開網址立即失效**：若有任何地方（例如寄給客戶的信）曾經帶過這些公開網址，那些連結會壞掉。需確認 `sendMail`/通知信中沒有嵌入 chat-uploads 的網址。
- **migration 要套到正式 DB 才生效**：程式部署後若沒跑 migration，bucket 仍是公開的，隱私修正等於沒做。
