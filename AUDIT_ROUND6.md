# 第六輪全面品質與安全審查報告

日期：2026-11-02
範圍：全專案 84 支 route handler 與主要 server component，重點為跨租戶隔離、金流正確性（收款／退款／包月／儲值／點數／手續費）、權限控制、資料完整性、500 錯誤與 null 處理、訂閱到期機制。另含 R5 之後新增的兩個 commit（預約頁寵物名連結、超管店名連結）。

結果：**Critical 0 件、High 9 件（全部已修）、Medium 12 件（記錄，未修）**。
本輪**沒有 schema 變更，不需要 migration**。

---

## 一、High（已修）

### R6-H1 營收總覽與儀表板：全額退款被扣兩次
`/api/reports`、`/api/dashboard` 早在 M1 就改成淨額口徑，但使用者實際看到的是 **server component**（`reports/page.tsx` 總覽分頁、`dashboard/page.tsx`），它們仍是舊寫法：只加總 `status = "PAID"`。

全額退款時原單會翻成 `REFUNDED`（不再被加總），同時新增一筆 `-金額` 的 PAID 沖銷列（被加總）→ 收 1000、全退 1000，畫面顯示 **−1000**。影響本月營收、淨利、六個月趨勢、每日收入圖、付款方式佔比、住宿營收。

**修法**：新增 `lib/revenue.ts` 作為唯一營收口徑（PAID+REFUNDED、`amount >= 0`、`Σamount − ΣrefundedAmount`），頁面與 API 全部改用它，避免再分岔。

### R6-H2 包月扣次被重複認列營收，且可以被退成現金
收款對話框選「包月扣次」（collect `billingType = MONTHLY_PLAN`）會把應收翻成 PAID、金額 = 每次單價。但這筆錢早在「購買整包」時就收過、也認列過了 → **同一筆預付款被算兩次營收**。同時：
- 扣次會再發一次點數（購買整包時已發過）。
- 扣次是 PAID 收款，可以按「退款」→ 系統憑空付出一筆現金退款。

**修法**：營收口徑排除 `billingType = MONTHLY_PLAN`（也一併修正歷史資料的報表數字）；扣次不發點數；退款 API 拒絕對扣次退款（請對購買整包的那筆退款）。

### R6-H3 任何店員都能刪除已付清的包月方案
`DELETE /api/pets/[id]/monthly-plans/[planId]` 只有 `requireAuth()`。刪除後 `Payment.monthlyPlanId` 被 SET NULL、客人剩餘的預付次數直接消失。修改方案金額／次數早已限 OWNER（FIN-10），刪除卻沒有。

**修法**：限 OWNER；已有收款或已扣過次的方案一律不可刪（409）。前端顯示伺服器回傳的原因。

### R6-H4 `PATCH /api/payments/[id]` 可任意改款項狀態
OWNER 可把 PAID 改回 PENDING，再走一次收款 → 儲值再扣一次、點數再發一次、包月再扣一次；也能寫入任意狀態字串（例如直接標 `REFUNDED` 而不走退款）。付款方式也沒有白名單（R5 只修了 receivables 那支），且收款後還能改付款方式，讓手續費快照與報表分組對不上。

**修法**：此 API 不再允許任何狀態轉換（請用收款／作廢／退款流程）；付款方式需白名單且只能在收款前修改；移除 `paidAt` 修改。唯一呼叫者 `reports/mark-paid-button.tsx`（R5 M-4 的死碼）一併刪除。

### R6-H5 公開預約表單可以自訂應收金額
`POST /api/booking/[shopId]/request` 的 `estimatedCost` 直接加總**客戶端送來的 price**（`z.number().finite()`，連負數都收）。店家按「標記完成」時，`PATCH /api/appointments/[id]` 會用 `estimatedCost` 建立應收 → 任何人都能用 1 元預約全套美容。

**修法**：前端改送服務 `id`；伺服器依 `Service` 表查價並套用該寵物的專屬價（與 `pet-pricing` 相同規則），客戶端的 name/price 一律忽略。

### R6-H6 訂閱 cron 會自動解除超管的手動停權
`cron/subscription-lifecycle` 的「backstop 恢復」對**所有** `SUSPENDED` 且訂閱有效的店家改回 `ACTIVE`。目前所有店家都是永久訂閱，所以超管因違規等原因手動停權的店家，**隔天 cron 一跑就被自動解封**。

**修法**：cron 只恢復「因訂閱到期被自己停權」（一定有 `suspendedAt`）的店家；超管手動停權時清掉 `suspendedAt` 作為區分。不需 schema 變更。

### R6-H7 新增員工時，明文密碼寫進伺服器 log
`POST /api/staff` 為了除錯 `console.log(JSON.stringify(raw))`，把整個請求（含 `password`）印進 log。

**修法**：log 前把密碼遮成 `***`。
**⚠ 建議**：VPS 上既有的 log（pm2 / journald）可能已含明文密碼，請清除，並請相關員工更換密碼。

### R6-H8 LINE 官方帳號權杖外洩給一般店員
設定頁的 LINE 分頁限店主，但：
- `PATCH /api/appointments/[id]`（任何店員）回應中帶 `shop.lineChannelToken`。
- `PATCH /api/onboarding/shop`（任何店員）回傳整筆 shop，含 `lineChannelSecret` 與 `lineChannelToken`。

拿到權杖就能以店家名義對所有綁定的客人推播。

**修法**：預約回應只帶 `shop.name/phone`；onboarding 回應改用 `select` 只回顯示欄位。

### R6-H9 沒有報表權限的店員可在儀表板看到全店營收
R5（H-7）已把 `/api/reports` 限 `reports` 權限，但儀表板首頁（所有人可見）直接顯示「本月收入」卡片與「近 6 個月收入」圖，`/api/dashboard` 也照樣回傳。

**修法**：頁面與 API 都改為 OWNER 或 `reports` 權限才計算、顯示營收。

---

## 二、各面向結論

| 面向 | 結論 |
|---|---|
| 跨租戶隔離 | **通過**。所有以 id 定位的讀寫都有 `shopId` 條件；公開端點以 token 雙條件＋ IP rate limit；超管 API 皆檢查 `isSuperAdmin`；認證層每次請求回 DB 重驗角色／停用／店家狀態。 |
| 金流正確性 | 收款、退款、儲值扣款、包月扣次的原子閘仍然紮實。修正 H1、H2、H4、H5。 |
| 權限控制 | 修正 H3、H8、H9。 |
| 資料完整性 | 修正 H4。見 Medium 清單。 |
| 500 / null 處理 | 未發現會導致 500 的 High；小問題列在 Medium。 |
| 訂閱到期機制 | 修正 H6。`subscription-guard` 的判定與 R4 時一致。 |
| R5 之後的新程式 | 寵物名、店名連結只是 `<Link>`，目標頁各自有權限檢查，無問題。 |

---

## 三、Medium（記錄，未修）

- **M-1 美容紀錄扣包月次數不是原子操作。** `POST /api/grooming` 用 `update({ increment: 1 })`，沒有 `usedSessions < maxSessions` 條件；兩筆並發可能超扣。（預約完成與 collect 路徑都已是 guarded updateMany。）
- **M-2 美容紀錄可能對已完成的預約再建一次應收。** 預約先被「標記完成」（已建應收），之後再從該預約建美容紀錄，`POST /api/grooming` 沒檢查預約狀態，會再建一筆 PENDING 應收。可作廢處理，但容易漏。
- **M-3 預約的 `petMonthlyPlanId` 只驗證屬於本店，沒驗證屬於同一隻寵物。** 同店內可能誤扣到別隻寵物的包月。
- **M-4 `POST /api/appointments` 接受客戶端指定的任意 `status`**（例如直接建成 `COMPLETED`，跳過應收建立）；`DELETE` 為硬刪除且任何店員可執行。
- **M-5 住宿 `PATCH /api/boarding/[id]` 的 `status` 是任意字串**，例如可把已退房改回 `STAYING`（房間狀態不會跟著變）。
- **M-6 公開預約與自助建檔沒檢查店家狀態。** 停權／待審核店家的公開頁仍會建立客人與預約。
- **M-7 客人合併與並發儲值操作之間有競態**（先讀副客人餘額再加到主客人）；也沒擋「合併進已封存／已合併的客人」。
- **M-8 商品銷售扣庫存沒有下限條件**，庫存可被扣成負數（是否允許超賣屬產品決策）。
- **M-9 `POST /api/grooming/[id]/confirm`** 的 `signature` 若不是字串、或 body 不是 JSON，會 500 而不是 400。
- **M-10 R5 遺留項目仍未處理**：住宿退房固定以現金費率算手續費、商品銷售沒有付款方式欄位、退款不回沖手續費（後者可視為刻意設計）。
- **M-11 歷史資料**：本輪之前的包月扣次已經多發的點數，不會自動回收；如需修正需另寫一次性腳本。
- **M-12 既有 lint 錯誤**：`app/booking/[shopId]/booking-client.tsx` 在 effect 內同步 setState（`react-hooks/set-state-in-effect`），非本輪引入，功能正常。

---

## 四、本輪修改檔案

| 檔案 | 對應問題 |
|---|---|
| `lib/revenue.ts`（新增） | H1、H2：唯一營收口徑 |
| `app/(dashboard)/dashboard/page.tsx` | H1、H9 |
| `app/(dashboard)/reports/page.tsx` | H1、H2 |
| `app/api/dashboard/route.ts` | H1、H9 |
| `app/api/reports/route.ts`、`app/api/reports/daily/route.ts` | H2 |
| `app/api/payments/[id]/collect/route.ts` | H2（扣次不發點） |
| `app/api/payments/[id]/refund/route.ts` | H2（扣次不可退款） |
| `app/api/pets/[id]/monthly-plans/[planId]/route.ts`、`components/pets/pet-monthly-plan-manager.tsx` | H3 |
| `app/api/payments/[id]/route.ts`；刪除 `app/(dashboard)/reports/mark-paid-button.tsx` | H4 |
| `app/api/booking/[shopId]/request/route.ts`、`app/booking/[shopId]/booking-client.tsx` | H5 |
| `app/api/cron/subscription-lifecycle/route.ts`、`app/api/superadmin/shops/[id]/route.ts` | H6 |
| `app/api/staff/route.ts` | H7 |
| `app/api/appointments/[id]/route.ts`、`app/api/onboarding/shop/route.ts` | H8 |

驗證：`tsc --noEmit` 無錯誤、`vitest` 16/16 通過、`next build` 成功、eslint（變更檔案）無新增問題。
