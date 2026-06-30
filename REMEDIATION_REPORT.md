# 安全/金流/可靠性修復總報告

> 對 `pet-grooming-saas`（多租戶寵物美容會員系統）全面審計後的**修復批次**。
> 基底 commit：`509fb02`。本批次：51 個檔案變更（+1063 / −385）、1 個新 migration、新增 4 條安全測試。
> 驗證狀態：`tsc --noEmit` ✅、安全測試 `vitest` 16/16 ✅、改動檔零新增 lint error（既有 baseline lint 問題未動）。
>
> 詳細的逐條缺陷分析見同目錄 `AUDIT_EXTERNAL_REPORT.md`。本檔聚焦「修了什麼、怎麼修、怎麼上線」。

---

## 一、總覽：修復前 → 修復後

| 維度 | 修復前 | 修復後 |
|---|---|---|
| 租戶隔離 | 15 個 route 用裸 `if(!session)`，停用帳號 `shopId=undefined` 會讓 Prisma 過濾被丟棄 → 跨租戶 | 全部改用集中守衛 `requireAuth()`；停用帳號 401；新增測試鎖定 |
| 撤權/停權 | 只有 UI 重導向，API 層不擋；停用帳號還保留 `isSuperAdmin` | `auth.ts` 停用時清掉**全部**身分宣告；`requireAuth()` 中央強制 `shop.status===ACTIVE`（superadmin 例外） |
| 金流對帳 | 退款重複扣/負營收、整包包月可被當單次扣少收、刪紀錄吞儲值 | 報表改淨額口徑、collect 以 DB billingType 為權威、刪除改 409/軟刪、退款回收點數 |
| LINE 綁定 | 單靠電話即綁定＋回傳餘額＋劫持通知 | phone+name 雙因子、不覆寫既有綁定、非確認式回應 |
| 可用性 | 列表無上限、body 無上限、IP 可偽造繞過限流、cron 重複轟炸 | 全列表強制分頁、body 大小閘、可信來源取 IP、cron 冪等＋修月底日期 bug |

**總體**：CRITICAL ×1、HIGH ×2、MEDIUM ×15、LOW ×11，全部 CONFIRMED 項目皆已處理（含我自審追加的協調缺口）。

---

## 二、逐條修復

### 🔴 CRITICAL

**C1 — 帳號停用反轉成跨租戶提權 + 守衛集中化**
- `auth.ts:86-98`：jwt 失效分支現在清除 **id / shopId / role / shopName / shopStatus / isSuperAdmin** 全部宣告（原本只清 id/shopId、保留 isSuperAdmin）。session callback 的 `isSuperAdmin` 改嚴格 `=== true`。
- `lib/auth-guard.ts:18-58`：`requireAuth()` 維持「無 shopId → 401」，新增中央 `shop.status` 強制（H2，見下），ctx 擴充 `isSuperAdmin`/`shopStatus`。
- 15 個原本裸 `if(!session)` 的 route 全部改用 `requireAuth()`/`requireRole()`（customers、customers/[id]、pets/[id]、pets/all、pets/[id]/*、grooming、grooming/[id]、grooming/[id]/notify、notifications、staff、appointments、appointments/[id]、appointments/[id]/checkin）。`shopId=undefined` 不再可能滲入 Prisma `where`。
- 新增測試 `tests/security/route-guards.test.ts`：停用帳號（無 shopId）→ 401。

### 🟠 HIGH

**H2 — 店家狀態在 API 層強制**
- `lib/auth-guard.ts:40-49`：非 superadmin 且 `shopStatus !== "ACTIVE"`（PENDING/SUSPENDED/REJECTED/MERGED）一律 **403 `SHOP_INACTIVE`**。停權/未審核不再只是 UI 重導向，`curl + cookie` 也擋得住。`auth.ts` 每次請求重新整理 `shopStatus`，撤權即時生效。
- 新增測試：SUSPENDED → 403（且查詢不執行）、PENDING → 403、superadmin 繞過。

**H1 — LINE webhook 綁定/查詢**（`app/api/line/webhook/route.ts`）
- 綁定改 **phone + name 雙因子**（比照 `booking/lookup` 的 AUTH-4），姓名不符與查無一律回相同非確認式訊息。
- **不覆寫**已綁定到其他 LINE 帳號的客戶（反劫持）：只綁 `lineUserId` 為空或本人的紀錄。
- follow/help 文案改引導「手機號碼 姓名」格式。餘額/點數查詢自然落在「已驗證綁定」之後才可達。

### 🟡 MEDIUM

| # | 檔案 | 修復 |
|---|---|---|
| M1 | `dashboard`、`reports`、`reports/daily` | 營收改**淨額口徑** `sum(amount where status∈{PAID,REFUNDED} & amount≥0) − sum(refundedAmount)`；負額沖銷單被排除，退款恰計一次（賣100退100=0、退30=70、無退款=100）。日報表加 gross/refund/net 三欄、儲值「充值」排除退款回沖。 |
| M2 | `payments/[id]/collect` | DB `payment.billingType` 為權威：整包包月應收（MONTHLY_PLAN）只能以 SINGLE/CREDIT 全額收，禁止被當逐次扣（防少收 $4500）。SINGLE 應收的「用包月扣一次」合法流程不受影響。 |
| M3 | `grooming/[id]` DELETE | 改 `requireRole(["OWNER"])`；關聯 payment 已 PAID → **409 先退款**（不再無痕吞儲值）；PENDING 才隨紀錄刪；加 `writeAudit`。 |
| M4 | `customers/[id]` DELETE | 改**軟刪 `status=ARCHIVED`**，保留所有 payment/pet/history（不再硬刪真錢紀錄繞過 RESTRICT）；客戶清單/搜尋同步排除 ARCHIVED。 |
| M5 | `schema.prisma` + migration + `customers`、`booking/request` | 新增 `@@unique([shopId, phone])`；booking 改原子 `upsert`；手動建檔撞重複回 409；migration 含上線前去重避免 `migrate deploy` 失敗。 |
| M6 | `subscription-guard`、`pets`、`booking/request`、`contract/register` | `isExpired`/狀態真正被消費（過期回 not-allowed）；新增 `checkPetLimit` 並於三條建寵物路徑呼叫；公開建客戶端點也檢查 `checkCustomerLimit`。 |
| M7 | `boarding`、`boarding/[id]`、`appointments/[id]/checkin` | 入住前檢查房間是否已 STAYING/OCCUPIED（防超賣，409）；退房只在無其他在住時才釋放房況。 |
| M8 | `appointments/[id]` | 狀態轉移白名單（非法→400）；COMPLETED 設終態 → 扣包月次數冪等（每筆僅一次）＋ guarded `usedSessions < maxSessions` 原子上限。 |
| M9 | `cron/reminder`、`cron/appointment-reminder`、`lib/line`、`lib/email`、`ocr`、`ocr-scan` | 新增 `reminderSentAt` 冪等旗標（不重複轟炸）；修**月底 `day+1` Invalid Date** bug；對外 fetch 全加 AbortController timeout；兩支重複 cron 加註應擇一排程。 |
| M10 | `customers`、`pets/all`、`appointments` | 列表強制分頁/上限（customers `take≤100`+只回必要欄位、pets/all 無 search 上限 500、appointments `take≤1000`）。 |
| M11 | `lib/validation`、`ocr`、`ocr-scan` | `readJson` 加 optional body 上限（預設 1MiB，先查 Content-Length 回 413）；OCR 端讀 body 前早退。 |
| M12 | `lib/rate-limit` | `clientIp()` 不再取可偽造的 XFF 最左值；優先 `cf-connecting-ip`/`x-real-ip`，否則取 XFF 最右（`TRUSTED_PROXY_HOPS` 預設 1）。 |
| M13 | `reports` | 日營收由「每天一筆 aggregate ×31」改單筆 range 查詢記憶體分桶；留存率掃描加 12 個月下界 + `distinct`。 |
| M14 | `render.yaml` | startCommand 移除每次開機的 `migrate resolve 0_init`（會假基線化/掩蓋 failed migration），只留 `migrate deploy && npm start`；一次性 baseline 說明保留在註解。 |
| M15 | `register` | 交易 commit 後的 email/通知改 best-effort（各自 try/catch），註冊成功即回 201（含 shopId），副作用失敗不再翻成 500 鎖死帳號。 |

### 🔵 LOW

| # | 檔案 | 修復 |
|---|---|---|
| L1 | `payments/[id]/refund` | 退款同交易內回收當初發放的點數（對稱 `floor(amount/100)`、夾到餘額不為負、guarded updateMany）。 |
| L2 | `grooming`、`grooming/[id]/confirm` | 公開 `viewToken` 改 `randomBytes(24).base64url`（不依賴 cuid 預設）；confirm 端加 per-IP 限流。 |
| L3 | `contract/[shopId]/register` | `personality` 加 `.max(30)` + 元素 `.max(50)`。 |
| L4 | `schema.prisma` + migration | Sale 加 `@@index([shopId, createdAt])`。 |
| L5 | `customers/merge`、`customers`、`search` | merge 補轉 `Sale.customerId`；客戶清單/搜尋排除 MERGED（+ARCHIVED）。 |
| L6 | `contract/[token]/page.tsx` | 公開合約渲染前再消毒一次（縱深防禦）。 |
| L9 | `appointment-actions.tsx` | 樂觀更新檢查 `res.ok`，失敗還原 + 提示，`finally` 確保 loading 復原不卡死。 |
| L10 | `scripts/*`、`prisma/seed.ts` | operator 腳本 DB 連線改 `rejectUnauthorized:true`（讀 `DATABASE_CA_CERT`）；`set-superadmin` 加正式環境 `ALLOW_PROD_SUPERADMIN` 閘。 |
| L11 | `prisma/seed.ts`、`scripts/seed-data.ts` | 示範店主 `isSuperAdmin` 改 false（超管只留 system 店）。 |
| L8 | `booking/request` | 同手機+店 2 分鐘內重複預約去重，避免灌垃圾。 |

---

## 三、資料庫 migration（上線注意）

新增 `prisma/migrations/20260630000001_security_constraints/`：
1. **M5 去重**：加 `@@unique([shopId, phone])` 前，先把同店重複電話的「第 2 筆以後」phone 後綴 `-dupN`（**保留所有列與財務資料**，只改重複者的電話字串），避免 `migrate deploy` 在既有重複資料上失敗；上線後可用既有 `customers/merge` 工具合併這些 `-dupN`。
2. **M9**：`Appointment.reminderSentAt`（冪等旗標）。
3. **L4**：`Sale(shopId, createdAt)` 複合索引。

全部用 `IF NOT EXISTS`（與專案既有 migration 風格一致，對 VPS 手動建表情境安全）。Prisma client 已 `prisma generate`。

---

## 四、驗證

- ✅ `npx tsc --noEmit`：0 error。
- ✅ `npx vitest run`：**16/16 通過**（12 既有 + 4 新增，鎖定 C1/H2：停用→401、SUSPENDED/PENDING→403、superadmin 繞過）。
- ✅ 改動檔零新增 lint error（既有 baseline 的 React hooks / `as any` 問題在未觸碰的檔，未處理）。
- ⏳ **尚未做**（需真環境）：完整 `next build` 與對真實 DB 的 runtime smoke / e2e。建議上線前在 staging 跑一輪，特別是：停權店打 API（應 403）、停用帳號（應 401）、退款後 dashboard 與日報表對帳、整包包月收款金額、LINE 綁定 phone+name。

---

## 五、未處理 / 刻意延後（需決策或更大改動）

- **金額 Float → Decimal**：仍為 `Float`，寫入邊界有 `round2` 把關。整庫 money 欄位轉 `Decimal(12,2)` 是較大 migration，建議獨立批次在 staging 驗。
- **L7 CSP `unsafe-inline`/`unsafe-eval`**：移除需導入 nonce-based CSP（middleware 注入 per-request nonce）並做 runtime 回歸，未在本批次處理（避免無真機驗證下破壞渲染）。
- **非程式碼 launch-blocker**：git 歷史外洩憑證輪換 + repo 轉 private、正式 DB 配 off-host 自動備份——這些在程式碼之外，仍是收真實金流前的前置條件。
- **殘留小項**：`vaccineRecords`（`pets/route`）無長度上限、Pet/BoardingRecord 無 DB 唯一鍵（交易+預檢已大幅收斂競態窗，硬保證需 partial-unique index）、`member-levels/sync` 未濾 ARCHIVED（非使用者可見、無影響）。

---

*本報告與 `AUDIT_EXTERNAL_REPORT.md` 由自動化多代理審計 + 人工複查（金流邏輯逐條坐實）產出。*
