# Security Remediation — 安全修復與交接說明

> 分支：`fix/security-audit-remediation`
> 這份文件由一次完整安全審計後的修復產生。修復「能在程式碼層做的都做了」並通過靜態驗證，但**尚不可直接上線** —— 有幾項只有維護者本人能做（憑證輪換、repo 設定、正式 DB 遷移），以及尚未做真機/真資料庫的端到端測試。請主開發者在合併與部署前先讀「🔴 上線前必做」與「⚠️ 尚未驗證」兩節。

---

## ✅ 已完成並驗證（靜態層級）

- 審計發現的問題，凡能在程式碼修的都已修（見最後的對照表）。
- 驗證閘全綠：
  - `npx tsc --noEmit` — 無型別錯誤（已移除 `next.config.ts` 的 `ignoreBuildErrors`，型別現在是硬性閘）
  - `npm test`（vitest）— 12 個 **handler 級**安全測試通過（直接呼叫真 route，mock `@/auth` + `@/lib/prisma`，斷言 401/403/400 與 shopId 範圍）
  - `npx next build` — 編譯成功，69/69 頁面
  - `npm audit` — 由 13 降到 5（皆為 moderate 的 build/dev 工具傳遞依賴，不進 runtime）

---

## 🔴 上線前必做（只有維護者能做；未完成前請勿上線）

1. **輪換外洩憑證（最優先）**
   先前 `prisma/seed.ts` / `scripts/seed-data.ts` 把 owner、superadmin、staff 的密碼**寫死在原始碼**並推上**公開** repo。本次修復已改為由環境變數或隨機產生（印一次），但：
   - 這些密碼**仍存在於 git 歷史**中，且在正式系統上**可能仍有效**。
   - 請**立刻**在正式環境更改這三組密碼（owner / superadmin / staff），以及任何重複使用同密碼的帳號（例如該 owner email 對應的信箱）。
2. **將 repo 設為 private + 清理 git 歷史**
   僅刪除目前檔案不夠 —— 密碼與先前誤上傳的 `cloudflare-tunnel.log` 仍在歷史 commit。請用 `git filter-repo` 或 BFG 清除，並在清完後強制更新遠端。
3. **正式 DB 遷移基線 + 備份**
   `render.yaml` 已改為 `prisma migrate deploy`（取代每次部署 `db push`）。對「先前以 `db push` 建立」的既有正式 DB，第一次部署前需執行一次：
   ```
   npx prisma migrate resolve --applied 0_init
   ```
   否則 `migrate deploy` 會因 DB 非空而拒絕（P3005）。並請先 `pg_dump` 備份 —— 目前**沒有任何自動備份**。
4. **設定必要環境變數**
   - `NEXTAUTH_SECRET`：強隨機 32+ bytes（缺少時正式環境會在啟動時報錯，這是刻意的）
   - `CRON_SECRET`：**現在為必填**（cron 路由改為 fail-closed，未設定即拒絕執行）
   - `DATABASE_CA_CERT`（選用）：若 DB 使用私有 CA，提供 PEM；否則預設驗證憑證（`rejectUnauthorized: true`）
   - seed 用：`SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` / `SEED_SUPERADMIN_PASSWORD` / `SEED_STAFF_PASSWORD`

---

## ⚠️ 尚未驗證（靜態綠 ≠ 真的跑對）

本次驗證為型別檢查 / 單元測試 / build。**測試是 mock 掉資料庫的**，證明的是權限、驗證、租戶範圍的邏輯，**不是**真資料庫上的端到端行為。上線前請在測試環境用**真 Postgres + 真機**走過：

- **金流三條**：收款（collect）、退款（refund）、儲值扣款（CREDIT）—— 特別驗證原子性與併發（重複點擊、兩分頁同時操作不會雙扣/超退/餘額變負）。
- **前端三個合約變更**（見下）是否在瀏覽器實際可用。

---

## ⚙️ 行為變更 — 需主開發者確認是否符合產品意圖

這些是修復過程中為了安全/正確性做的行為調整（前端已對齊）：

- **應收帳款**：CREDIT / 月卡型的應收，**不再能用 PATCH 直接標記為已付**，必須走「收款（collect）」流程（才會正確扣儲值/消耗堂數/發點數）。前端已改為開收款對話框。
- **費用（expenses）**：建立/修改/刪除改為 **OWNER 限定**（先前任何登入者皆可）。
- **員工建立**：staff 端點不能把角色設為 OWNER（角色強制為 STAFF）。
- **預約查詢（公開）**：現在需要**姓名 + 電話**才回傳資料（防止用電話枚舉撈個資），且查無/不符一律回相同的「查無資料」（不確認存在性）。
- **美容確認（公開）**：現在需帶 `viewToken`（先前只憑可猜測的 record id 即可寫入簽名 = 未授權跨租戶寫入）。

---

## 🕗 刻意延後（建議的後續工作）

- **金額型別 `Float` → `Decimal`（或整數分）**
  目前所有金額欄位是 Prisma `Float`（浮點），有累積/捨入漂移風險。本次已在所有寫入邊界加 `round2()` 緩解，但**未**將欄位型別改為 `Decimal` —— 那是牽動 schema + 每個讀取點 + 前端的大遷移，在沒有真 DB/真機測試的情況下盲改可能算錯錢。建議列為獨立後續工作（步驟可另提供）。
- **LINE 跨店綁定**
  已做到「不跨店自動綁定、不向未驗證的 LINE 使用者回傳餘額/個資」。完整的「每店一次性綁定碼」機制需新增 schema 欄位，尚未實作（`AUTH-3` 殘留部分）。
- **限流的多實例支援**
  `lib/rate-limit.ts` 目前是單機記憶體版（適用單一 Render 實例）。若擴展為多實例，需改用 Redis/Upstash 後端（介面已設計成可直接抽換）。
- **ESLint 既有債**
  專案有約 75 個既有 lint 問題（多為前端 react-hooks / `any`，非本次新增）。CI 已將 lint 設為非阻擋（report-only）；清完後可移除 `continue-on-error`。

---

## 已修復發現對照表

| 編號 | 問題 | 修法 |
|---|---|---|
| SEC-1 | seed 寫死正式憑證 | 改 env / 隨機產生印一次 + 正式環境 guard（⚠️ 線上密碼輪換見上） |
| FIN-1 | 退款可無限重複（印錢） | 加 `refundedAmount`；交易內 status-gated `updateMany` 累計上限；併發partial退款的上限併入 WHERE |
| FIN-2 | 收款非原子（雙扣） | `updateMany({status:PENDING})` 原子轉移 + count 檢查；副作用後置 |
| FIN-3 | 月卡堂數非原子 | `updateMany(usedSessions < max)` 原子扣減 |
| FIN-4 | 應收授權繞過 | OWNER-only + 原子化；CREDIT/月卡導向 collect |
| FIN-6/8 | 儲值/點數無防護 | 上限 + finite + 審計；點數扣減原子化；點數調整 OWNER-only |
| FIN-7/PRICE-1 | 銷售信任前端價格 | 伺服器端由 Product 重算金額 |
| FIN-9 | 費用/付款無角色閘 | OWNER-only + 審計 |
| collect CREDIT 併發 | 餘額讀後扣（可變負） | 餘額守衛式原子扣（`updateMany storedValue >= amount`） |
| TEN-1/AUTH-2 | 美容確認 IDOR | 改需 `{id, viewToken}` 雙條件 |
| TEN-2/3 | 預約跨租戶注入 | 建立前驗 petId/staffId/roomId 屬本店 |
| AUTH-1 | STAFF 擁有老闆權限 | 金流/破壞性路由鋪 `requireRole(["OWNER"])` |
| AUTH-3 | 單一 LINE channel 跨租戶洩漏 | 不跨店綁定 / 不回傳個資（完整綁定碼待後續） |
| AUTH-4 | 預約查詢電話枚舉個資 | 需姓名驗證 + 限流 + 不確認存在性 |
| AUTH-5/6/9 | session/暴力破解/secret | 啟動強制 secret、登入限流、每次請求重驗 isActive/role、限時 session |
| AUTH-7 | staff 可自封 OWNER | 角色白名單 |
| XSS-1 | 合約模板 stored XSS | `sanitize-html` 寫入 + 渲染雙重淨化 |
| PUB-1 | 公開端點無限流 | 全公開 POST 加限流 |
| SEC-3 | 每次部署 `db push` | 改 Prisma migrations（含 0_init）+ `npm ci` |
| SEC-4 | DB TLS 驗證關閉 | 預設 `rejectUnauthorized:true` + CA 支援 |
| SEC-5 | OCR/LINE 無限流 | 限流 + OCR 每日上限 + 大小上限 |
| SEC-6 | 誤上傳 tunnel log | 移除 + gitignore（⚠️ 歷史清理見上） |
| SEC-7 | log 印 PII | email/LINE/姓名遮蔽 |
| SEC-8 | OCR 洩漏上游錯誤/金鑰長度 | 通用錯誤訊息 + 移除金鑰 log |
| SEC-9/TOOL-1 | 無安全標頭 / 忽略型別錯誤 | CSP/HSTS/XFO/nosniff + 移除 ignoreBuildErrors |
| OCR-PI-1 | OCR 輸出未驗證 | strict zod schema 驗證 |
| upload | 上傳無驗證 | 檔型/大小/路徑遍歷防護 |
| TEST-1/3/CQ-3 | 測試假綠 | 重寫為真 handler 測試 + 金流斷言 |
| TOOL-2 | 無 CI | GitHub Actions（typecheck 阻擋 + lint + test） |
| TOOL-3/4/5 | 版本/安裝 | engines、render 改 `npm ci` |
| DEP/next | next DoS 漏洞 | 升 next 16.2.4 → 16.2.9 |

---

*修復提交於分支 `fix/security-audit-remediation`。本文件刻意不含任何密碼明文。*
