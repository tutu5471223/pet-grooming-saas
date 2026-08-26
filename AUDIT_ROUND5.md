# 第五輪全面品質與安全審查報告

日期：2026-08-23
範圍：付款方式手續費功能（commit f592521）、底部導覽列（commit 690c200）、以及全專案的跨租戶隔離／金流正確性／權限控制／資料完整性複查。

結果：**Critical 0 件、High 7 件（全部已修）、Medium 4 件（記錄，未修）、Low 2 件（已修）**。

---

## 一、付款方式手續費功能

### 1.1 手續費計算是否正確

計算本身正確：`feeAmount = round2(amount × rate ÷ 100)`、`netAmount = round2(amount − feeAmount)`，費率夾在 0–100%，非法值視為 0，且是**收款當下快照**寫進 Payment，日後調整費率不會回頭改舊單 —— 這是對的做法。

但費率查表有一個實作缺陷：

> **[High] H-1 費率查表可被原型鏈的 key 命中，把 NaN 寫進資料庫**
>
> `computeFee` 原本用 `paymentMethod in rates` 判斷付款方式是否有效。`rates` 是一般物件字面值，帶著 `Object.prototype`，所以 `"constructor" in rates`、`"toString" in rates` 都是 `true`，`rates["constructor"]` 取回的是**函式**。`base × 函式 ÷ 100` = `NaN`，於是 `feeAmount`、`netAmount` 雙雙以 NaN 寫入 Payment。
>
> collect API 的 `paymentMethod` 當時是未經白名單的任意字串，任何登入者送 `{"billingType":"SINGLE","paymentMethod":"constructor"}` 即可觸發，該筆收款的金額欄位會永久損壞、報表加總跟著全部變 NaN。
>
> **修法**：改用白名單 `isPaymentMethod()` 判斷，並對取回的費率再 `clampRate()` 一次。（`lib/payment-fee.ts`）

### 1.2 是否有遺漏的收款路徑

盤點全部會產生／結算金流的路徑：

| 路徑 | 手續費 | 說明 |
|---|---|---|
| collect（POS／應收收款對話框） | ✅ | 原本已有 |
| receivables PATCH（應收「標記已收款」） | ❌→✅ | **H-3，見下** |
| 住宿退房 checkout | ⚠️ | 有算，但固定用現金費率（M-1） |
| 儲值加值 top-up | ❌→✅ | **H-5，見下** |
| 商品銷售 Sale（POS） | ❌ | 資料表無付款方式欄位（M-2） |
| 預約完成／美容完成／購買包月 | n/a | 只建 PENDING 應收，收款時才算費，正確 |
| 退款 refund | ⚠️ | 不回沖手續費（M-3） |

> **[High] H-3 應收帳款「標記已收款」這條路完全不算手續費，且付款方式留空**
>
> `receivables-client.tsx` 對 SINGLE 應收送的是 `PATCH /api/receivables/{id}` + `{status:"PAID"}`，**沒有帶付款方式**。後端 `method = body.paymentMethod ?? existing.paymentMethod ?? null`，而 PENDING 應收建立時本來就沒有付款方式 → `method = null` → 費率 0。
>
> 也就是說：**同一筆應收，從營收報表按「收款」會扣手續費，從應收帳款頁面按「收款」永遠不扣**，而且收完的 Payment 付款方式是空的，報表付款方式欄顯示「—」、付款方式佔比圖也統計不到。
>
> 同時暴露兩個既有問題：這條路徑**不發放點數**（collect 會發 1 點／100 元），以及它是 `requireRole(["OWNER"])`，**店員按下去只會拿到 403**。
>
> **修法**：應收帳款頁面的「收款」一律改走收款對話框（與營收報表一致，會強制選計費方式＋付款方式，並正確處理點數、儲值扣抵、包月扣次）；後端在 PENDING→PAID 時**強制要求合法付款方式**，否則 400。

> **[High] H-5 儲值加值刷卡的手續費完全沒有入帳**
>
> 儲值加值是貨真價實的外部收款（現金或刷卡，`POST /api/customers/[id]/stored-value` 已經有 `method` 參數），手續費就發生在加值的那一刻。但這條路徑完全沒接上手續費邏輯；而之後的消費扣抵走 `billingType=CREDIT`、沒有付款方式、費率 0。結果是**刷卡儲值的手續費在系統裡永遠是 0**。
>
> **修法**：加值當下依付款方式計算手續費，並在同一個 transaction 內產生「平台手續費」支出。

> **[High] H-2 儲值／包月扣抵可被塞入付款方式，對沒有金流的沖抵收手續費**
>
> collect 的註解寫著「儲值/包月扣抵無 paymentMethod → 費率 0」，但**程式沒有強制**，只是仰賴前端不送。任何登入者送 `{"billingType":"CREDIT","paymentMethod":"CARD"}`，就會對一筆根本沒刷卡的儲值扣抵算出手續費、產生一筆假的「平台手續費」支出、並把 `netAmount` 壓低。包月扣次（`MONTHLY_PLAN`，完全沒有金錢進出）同理。
>
> **修法**：伺服器端強制 `CREDIT` / `MONTHLY_PLAN` 的付款方式為 `null`；其餘計費方式的付款方式必須是白名單值，否則 400。

### 1.3 自動產生的支出紀錄是否正確

分類固定為「平台手續費」、金額等於 feeAmount、寫在收款成功之後，方向正確。但有兩個問題：

> **[High] H-4 手續費支出的 `createdBy` 未驗證，外鍵失敗會回滾整筆收款**
>
> `Expense.createdBy` 對 `User` 有外鍵。JWT 裡的 `userId` 可能指向已被刪除的使用者（本專案的 `POST /api/expenses` 早就針對這點寫了 `userExists` 防護，可見這風險是實際存在的）。手續費支出是**建在收款的 transaction 裡**的，一旦外鍵失敗，整筆收款會一起回滾 —— 店家會變成「收不了錢」，而不只是「少一筆支出紀錄」。
>
> **修法**：新增 `loadFeeContext()`，一次取回費率表與**確認存在的** creator id，不存在就記 `null`。

> **[Medium→已修] receivables 路徑的手續費支出沒有和狀態翻轉放在同一個 transaction**
>
> 原本 `payment.updateMany` 翻成 PAID 之後才單獨 `expense.create`，中間失敗就會出現「已收款但沒有手續費支出」。已改為包在 `prisma.$transaction` 內。

### 1.4 報表口徑（非缺陷，但需要知道）

手續費同時存在兩處：`Payment.feeAmount`（快照）與一筆「平台手續費」支出。兩者**不會互相疊加**：

- 營收總覽的「本月淨利 = 收入 − 支出」——手續費透過**支出**扣一次。
- 收入明細分頁的「實收淨額 = 毛額 − 手續費」——是另一個視角，不含其他支出。

兩個數字定義不同、各自只扣一次手續費，沒有重複計算。

---

## 二、底部導覽列權限判斷

**結論：權限判斷正確。** `canSee()` 與側邊欄 `sidebar.tsx` 的邏輯逐條一致：

- `ownerOnly: false`（儀表板／客人／預約／住宿／商品管理／銷售紀錄）→ 所有人可見，與側邊欄相同。
- `reports` / `expenses` → OWNER 或持有對應權限。
- `settings` → OWNER 或持有 `settings` **或** `staff` 權限（與側邊欄的 `perms.settings || perms.staff` 相同，也和 `/settings` 頁面的 redirect 條件相同）。
- `audit-logs` → 只有 OWNER（無 permKey，`canSee` 回 false），與 `/audit-logs` 頁面的 `role !== "OWNER"` redirect 相同。

而且各頁面與 API 都有各自的伺服器端把關，導覽列只是隱藏入口，不是安全邊界 —— 這個分層是對的。

修掉兩個小問題：

- **[Low] L-1**：底部導覽沒有「超級管理後台」入口（側邊欄有），超管在手機／平板上進不去 → 已加入「更多」選單。
- **[Low] L-2**：「更多」按鈕在項目全被權限過濾掉時仍會渲染，點開是一片空白 → 已加 `showMore` 判斷，並補上 `aria-expanded`。

---

## 三、整體複查

### 3.1 跨租戶隔離 — 通過

掃過全部 84 支 route handler：

- 所有以 id 定位的 `update` / `delete`，前面都有 `findFirst({ id, shopId })` 把關，或直接用 `updateMany` / `deleteMany({ id, shopId })` 原子帶條件。逐一驗過 products、rooms、staff/permissions、customers/points、customers/monthly-plan、pets/contracts/renew、receivables、payments，皆正確。
- `/api/shops/[id]` 另外有 `assertShopOwnership(shopId, id)` 雙重確認。
- `admin/*`、`superadmin/*` 雖然沒用 `requireRole`，但都有 `session.user.isSuperAdmin` 檢查。
- 公開端點（booking、contract sign、grooming confirm）以 token 雙條件查詢＋IP rate limit 保護。

**未發現跨店家越權讀寫。**

### 3.2 金流正確性 — 通過（併發防護紮實）

- collect 的 PENDING→PAID 是 `updateMany` 原子閘，`count !== 1` 即中止，重複收款不會發生。
- 儲值扣款用 `where: { storedValue: { gte: amount } }` 的 guarded decrement，餘額不會被併發打成負數。
- 包月扣次用 `where: { usedSessions: { lt: maxSessions } }` 的 guarded increment。
- 退款上限在 `WHERE` 內用 `refundedAmount <= amount − thisRefund` 重新驗算，兩筆併發部分退款無法把累計推過原金額。
- 包月應收（`billingType=MONTHLY_PLAN`）被擋住不能用逐次扣抵路徑結算，避免整包價被砍成單次價。
- 所有金額寫入前都過 `round2()`。

### 3.3 權限控制 — 修掉兩個 API 層破口

頁面層的權限都對，但有三支 API 只擋了「有沒有登入」，沒擋「有沒有權限」——頁面把入口藏起來了，`curl` 帶著 cookie 卻能直接拿到資料：

> **[High] H-6 `GET /api/expenses` 只有 `requireAuth()`**
> `/expenses` 頁面限 OWNER 或 `expenses` 權限，但 API 沒擋。**任何店員都能撈到全店支出明細**（含成本、薪資等敏感財務資料）。→ 改為 `requirePermission("expenses")`。

> **[High] H-7 `GET /api/reports` 與 `GET /api/reports/daily` 只有 `requireAuth()`**
> 同樣的問題：沒有 `reports` 權限的店員可直接打 API 取得全店營收、六個月趨勢、每日收入明細。（這兩支端點目前前端沒有呼叫者，報表頁是 server component。）→ 改為 `requirePermission("reports")`。

其餘權限分層皆正確：作廢限 `void` 權限、退款限 `refund` 權限、支出／點數／員工／店家設定寫入限 OWNER、手續費設定分頁在 `isAdmin` 之外顯示 `AccessDeniedTab` 且後端 `requireRole(["OWNER"])`。

### 3.4 資料完整性 — 通過，加一項強化

- `paymentFeeRates` 以 `normalizeFeeRates()` 白名單化後才存，前端多送的欄位會被丟棄，費率一律夾在 0–100。
- 額外強化：`PATCH /api/receivables/[id]` 的非狀態編輯路徑原本可寫入任意字串到 `paymentMethod`，會汙染報表分組，已加白名單驗證。

---

## 四、未修項目（Medium，需要產品決策或 schema 變更）

- **M-1 住宿退房固定以「現金」費率計算手續費。** 付款方式在退房時硬寫 `CASH`（這是既有設計，不是本次新增），所以刷卡退房會少算手續費。要修需要在退房 UI 加上付款方式選擇，屬於功能變更而非缺陷修復。
- **M-2 商品銷售（`Sale`）沒有付款方式欄位，永遠不算手續費**，報表該列 `feeAmount` 固定 0。要修需要 schema 變更（`Sale.paymentMethod`）＋ POS 結帳 UI 調整。
- **M-3 退款不回沖手續費。** 全額退款後，該筆的 `feeAmount` 仍計入「手續費總額」，「平台手續費」支出也不回沖，所以那一列的實收淨額會呈現負的手續費金額。現實中金流商多半確實不退手續費，因此**目前行為可視為正確**，但需知道這是刻意的，不是漏算。
- **M-4 `app/(dashboard)/reports/mark-paid-button.tsx` 是死碼。** 沒有任何地方引用，而且它打的 `PATCH /api/payments/[id]` 已被 FIN-9 擋掉 PENDING→PAID，真的按下去必定失敗。建議刪除，本次保留未動。

---

## 五、本輪修改檔案

| 檔案 | 對應問題 |
|---|---|
| `lib/payment-fee.ts` | H-1（白名單查表）、新增 `isPaymentMethod` / `isInternalOffset` |
| `lib/payment-fee-server.ts`（新增） | H-4（`loadFeeContext`）、統一 `recordFeeExpense` |
| `app/api/payments/[id]/collect/route.ts` | H-1、H-2、H-4 |
| `app/api/receivables/[id]/route.ts` | H-3（強制付款方式）、H-4、手續費支出納入 transaction、付款方式白名單 |
| `app/(dashboard)/receivables/receivables-client.tsx` | H-3（收款一律走收款對話框） |
| `app/api/customers/[id]/stored-value/route.ts` | H-5 |
| `app/api/boarding/[id]/route.ts` | H-4、改用共用 helper |
| `app/api/expenses/route.ts` | H-6 |
| `app/api/reports/route.ts`、`app/api/reports/daily/route.ts` | H-7 |
| `components/layout/bottom-tab-bar.tsx` | L-1、L-2 |

驗證：`tsc --noEmit` 無錯誤、`eslint`（變更檔案）無新增問題、`vitest` 16/16 通過、`next build` 成功。
本輪**沒有 schema 變更，不需要新的 migration**。
