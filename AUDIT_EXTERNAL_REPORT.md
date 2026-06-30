# 寵物美容 SaaS（pet-grooming-saas）外部全面審計報告

> 審計方法：clone HEAD `509fb02`（2026-06-30）→ 10 維度多代理深審（IDOR/authz/金流/驗證/資料模型/前端/機密/業務邏輯/可靠性/既有審計文件交叉查核）→ 每條發現獨立對抗式驗證（42 條發現，0 條被駁回）→ 主審計者親自抽查 ~18 個關鍵 route 交叉坐實頂級發現。
>
> 審計者核實附註（與自動報告的兩處校正）：
> 1. 綜合敘述寫「27+ 路由用 `if(!session)`」**高估**；`grep` 實測為 **15 個**（`appointments`、`appointments/[id]`、`appointments/[id]/checkin`、`customers`、`customers/[id]`、`grooming`、`grooming/[id]`、`grooming/[id]/notify`、`notifications`、`pets/all`、`pets/[id]`、`pets/[id]/service-prices`、`pets/[id]/monthly-plans`、`pets/[id]/monthly-plans/[planId]`、`staff`），其餘 49 個 route 用 `requireAuth/requireRole`。缺口仍然存在，只是規模是 15 不是 27。
> 2. C1「影響A（跨租戶）」需前提：帳號被停用（`isActive=false`）但 cookie 仍有效。已親自端到端坐實：`admin disable_shop`（admin/shops/[id]/route.ts:77）一次停用整店 → auth.ts:86-91 只清 shopId/id 保留 isSuperAdmin 且回 truthy session → `pets/all`/`customers` 等裸守衛 route 的 `where:{shopId:undefined}` 丟棄租戶過濾回全平台。「影響B（撤權超管續存 7 天）」不需停用前提、更乾淨。

---

（以下為自動綜合報告原文）

# 寵物美容 SaaS 全面安全審計報告

## 一、總體評價

這套系統在**功能完整度**上相當成熟：51 個 route 覆蓋客人、寵物、預約、住宿、美容、合約、付款、應收、報表、稽核、SaaS 訂閱與超管後台，且開發團隊已有明確的安全意識——`booking/lookup` 的雙因子防枚舉（AUTH-4）、refund 的 OWNER-only + 稽核 + 回沖、寫入時 sanitize-html、公開端點限流、Prisma migration 與安全標頭，這些都是「知道該怎麼做」的痕跡。換句話說，這不是一個對安全毫無概念的專案。

但**安全姿態存在系統性破口**，根因高度集中在三點：

1. **守衛寫法不一致**是最致命的系統性問題。專案同時存在「正確的」`requireAuth()`（檢查 `shopId`）與「危險的」裸 `if (!session)` 兩種守衛，後者散落在 27+ 個路由。一旦 `session.user.shopId` 退化成 `undefined`，Prisma 的租戶過濾條件被靜默剝除 → 跨租戶全讀寫。這代表**租戶隔離不是靠一道強制邊界，而是靠每個開發者手動記得帶 `shopId`**，無 middleware 兜底，必然漏。

2. **「狀態 / 撤權」全靠 UI 層，API 層形同無物**。被停用的使用者、被暫停的店家、未審核的店家、被撤權的超管——這些「應該立即生效」的管制，在 API 層完全不被強制，只有 dashboard 的 server component 重導向。`curl + cookie` 即可繞過平台對問題店家的所有管制手段。更糟的是，撤權流程（停用帳號）因 auth.ts 失效分支處理不全，**反而把帳號提權成跨租戶/超管權限**。

3. **金額一律用 Float、退款邏輯口徑不一**，導致報表會出現重複扣款、負數營收、退款被當新充值等多處對帳失真。

**最致命的單點**：`auth.ts` 的停用分支（C1）——它把「撤權」反轉成「提權」，且觸發路徑（超管 disable_shop 會一次停用整店）真實可達。

**是否可安心收真實會員金流？目前不建議。** 跨租戶讀寫、停權繞過、儲值/退款對帳失真、外洩憑證仍在 git 歷史、正式 DB 無備份、金額仍是 Float——這些在收真錢前都是 launch-blocker。功能可以上 demo，但**真實會員金流必須等 C1/H1/H2 與金流口徑（M1–M4）修畢並真機驗證後**才開放。

> **總體風險評級：偏高（High）**
> 個別維度有 CRITICAL，但尚無「未登入即可批量拖庫/搬錢」的全平台級毀滅性破口（多數需有效 session 或知道目標電話），故未達「嚴重」。

---

## 二、分級findings清單（已跨維度去重合併，按嚴重度排序）

### 🔴 CRITICAL

**C1. `auth.ts` 帳號停用分支不完整：被停用帳號反而被提權成跨租戶讀寫 + 超管權限續存**　`CONFIRMED`
檔案：`auth.ts:86-91`（連帶 `app/api/customers/route.ts:19`、所有裸 `if(!session)` 路由）
*合併原始發現 #2（CRITICAL）+ #3（HIGH），同一根因。*

- **為何危險**：jwt callback 偵測 `isActive=false` 時，只清 `token.id/token.shopId`、保留 `token.isSuperAdmin` 後 `return token`，next-auth v5 仍回傳一個 truthy session（`shopId=undefined`、`isSuperAdmin=true`）。
  - **影響A（CRITICAL 跨租戶）**：27+ 個路由用 `if(!session)` 而非 `requireAuth()`，對停用帳號為 false → 放行；`shopId=undefined` 滲入 Prisma `where` 被剝除 → 租戶過濾整個失效。`GET /api/customers`、`/api/pets/all`、`/api/grooming` 回傳**全平台所有店家**資料；`PATCH /api/customers/[id]`、`PATCH/DELETE /api/pets/[id]` 可跨店改/軟刪任意紀錄。
  - **影響B（HIGH 超管續存）**：`isSuperAdmin` 未被清除，被撤權超管在 JWT 最長 7 天內仍可 `DELETE /api/superadmin/shops/{id}` 刪店、`PATCH` approve/suspend、讀 `/api/admin/stats` 全平台數據。
- **可觸發情境**：超管對店家 B 執行 `disable_shop`（`admin/shops/[id]/route.ts:77` 一次停用整店所有 user）→ 店 B 老闆 alice 既有 cookie 仍有效 → 下一個 `GET /api/customers` 即回傳全平台客戶連同 PII/帳務。撤權流程被反轉成跨租戶提權。
- **修復建議**：(1) 全專案統一改用 `lib/auth-guard.ts` 的 `requireAuth()/requireRole()`，移除所有裸 `if(!session)`；至少改成 `if(!session?.user?.shopId) return 401`。(2) auth.ts 失效分支同時清除 `isSuperAdmin=false`、`role=undefined`，或讓 session callback 在 `token.id` 缺失時直接回傳不含 user 的 session（使 `auth()` 視為未登入）。(3) Prisma 查詢前對 `shopId` 做明確非空斷言，杜絕 `undefined` 滲入 `where`。

---

### 🟠 HIGH

**H1. LINE webhook 以「電話號碼」單因素跨租戶綁定 + 對未驗證持有者回傳餘額/個資 + 通知通道劫持**　`CONFIRMED`
檔案：`app/api/line/webhook/route.ts:109`
*合併原始發現 #1 / #11 / #33（三維度重複指同一缺陷）。並與 `SECURITY_REMEDIATION.md` AUTH-3「已做到不跨店綁定/不回傳個資」的宣稱直接矛盾。*

- **為何危險**：webhook 只用 `verifyLineSignature`（全域 channel secret）證明請求來自 LINE 平台，完全不驗證**發訊者身分**或**電話是否屬本人**。`handlePhoneLinking` 的 `updateMany({where:{phone,status:"ACTIVE"},data:{lineUserId}})` **無 shopId**，把攻擊者 lineUserId 寫進所有店家該電話的客人列並靜默覆寫原綁定；`handleMemberQuery` 以 `where:{lineUserId}`（無 shopId）回傳姓名、`storedValue`（金額）、`points`、包月剩餘。覆寫綁定同時劫持後續預約確認/美容完工（含 viewToken 連結）的 LINE 推播。
- **可觸發情境**：攻擊者加店家官方帳號好友 → 傳受害者手機 `09xxxxxxxx` → 系統回覆「已與『A店、B店』綁定」（跨店枚舉）並覆寫綁定 → 再傳「查詢」→ 收到各店姓名+儲值餘額+點數+包月。零登入、零本人驗證、跨多租戶。
- **修復建議**：綁定必須以「每店一次性綁定碼 / OTP」驗證電話持有權後才寫入；`findMany/updateMany` 必須帶 `shopId`（單店範圍）；`handleMemberQuery` 確認 lineUserId 已通過驗證綁定才回傳金額/點數；綁定既有 lineUserId 前要求二次確認，勿靜默覆寫。在綁定碼未實作前，**先移除「靠電話即綁定+回傳餘額」路徑**，並修正 `SECURITY_REMEDIATION.md` AUTH-3 改回「未完成」。

**H2. 店家 SUSPENDED / PENDING / REJECTED 狀態在 API 層完全不強制，停權僅是 UI 重導向**　`CONFIRMED`
檔案：`app/api/superadmin/shops/[id]/route.ts:43`（連帶 `lib/auth-guard.ts:20`）
*合併原始發現 #4（MEDIUM）+ #25（HIGH）+ #34（MEDIUM）。採 HIGH（business-logic 維度判定）。並與 auth.ts AUTH-5「suspended shop takes effect immediately」名實不符。*

- **為何危險**：超管 suspend 主路徑只 `shop.update({status:'SUSPENDED'})`，**不動 user.isActive**；`requireAuth()/requireRole()` 只看 `shopId`/角色、不看 `shop.status`；`authorize()` 登入只濾 `isActive:true` 不查 `shop.status`。唯一擋 SUSPENDED 的是 `app/(dashboard)/layout.tsx` 的頁面重導向，保護不到 `/api/*`。兩條停權路徑語義不一致（admin disable_shop 設 isActive=false 有效；superadmin suspend 無效），而超管主要 UI 用的正是無效那條。
- **可觸發情境**：(A) 超管暫停某詐騙/欠費店家 → OWNER 持 cookie 直接 `POST /api/customers`、`/api/payments/[id]/collect`（含收款扣儲值發點數）全部 200，停權形同虛設。(B) 自助註冊店家 status=PENDING 但 user.isActive=true → 審核前即可直打 API 建客戶/收款，繞過審核閘。
- **修復建議**：在 `requireAuth()`（共用守衛）內加入 `shop.status` 檢查，非 ACTIVE（PENDING/SUSPENDED/REJECTED/MERGED）一律 403（超管除外）；或 auth.ts jwt 重驗時若 `shop.status` 非 ACTIVE 即清除身分宣告。統一超管 suspend / admin disable 語義（同時設 status 與鎖定 user）。

---

### 🟡 MEDIUM

**M1. 退款報表口徑不一：全額退款使月營收重複扣兩次（可為負）、日報表完全不反映退款**　`CONFIRMED`
檔案：`app/api/dashboard/route.ts:51`、`app/api/reports/daily/route.ts:23`
*合併原始發現 #6 + #7。同時影響 `reports/route.ts` 多個 `status="PAID"` 聚合。*

- **為何危險**：退款同時 (a) 把原單翻 REFUNDED（移出 PAID）、(b) 新建 `amount:-amount` 的 PAID 沖銷單。dashboard `aggregate(status=PAID)` 全額退款時只算到 `-amount`、算不到被移走的 `+amount` → 退款扣兩次，單筆全退即可讓營收為負。日報表則 `amount>0` 濾掉負額沖銷單、又不過濾 REFUNDED 原單 → total 恆為毛收、退款不反映；CREDIT 退款回沖儲值寫成正額 `storedValueHistory`，被日報表誤算成當日「充值」。
- **修復建議**：負額沖銷單改用 `REFUNDED`/新增 `REVERSAL` 狀態，或所有營收聚合改淨額口徑 `sum where status in (PAID,REFUNDED)`；日報表加 status 過濾並扣 `refundedAmount`；`storedValueHistory` 加 `type` 欄區分「充值」與「退款回沖」。統一 dashboard 與日報表的毛/淨口徑。

**M2. collect 完全信任 client 傳的 billingType 重算金額，可大幅少收且誤扣包月次數**　`CONFIRMED`
檔案：`app/api/payments/[id]/collect/route.ts:35`

- **為何危險**：collect 從 body 取 `billingType`，從不校驗是否與該 payment 自身相符。MONTHLY_PLAN 分支丟棄 `payment.amount`、改成 `plan.pricePerSession` 並 `usedSessions+1`。而售包月會建一筆 `amount=maxSessions×pricePerSession` 的 PENDING 整包應收，receivables PATCH 又禁止結算 MONTHLY_PLAN（逼走 collect）→ UI 把整包應收導進逐次扣款路徑。
- **可觸發情境**：售 10次×$500=$5000 包月 → 待收款頁點該 $5000 列 → dialog 選「使用包月方案」送 `billingType=MONTHLY_PLAN` → collect 重算為 $500 標 PAID 並扣一次。店家**少收 $4500** 且白扣客人一次。
- **修復建議**：collect 以 DB 內該 payment 的 `billingType/amount` 為權威，拒絕不符的 client billingType；整包包月應收的結算流程與「逐次扣抵包月」分開。

**M3. 刪除美容紀錄無條件硬刪 PAID payment，不回沖儲值、無稽核，繞過 OWNER 退款管控**　`CONFIRMED`
檔案：`app/api/grooming/[id]/route.ts:96`

- **為何危險**：DELETE 只用 `auth()`（STAFF 即可），交易內無條件 `tx.payment.delete()` 不論 status。若已 CREDIT 收款，刪除只移除 payment：`storedValue` 不回沖、點數不收回、營收憑證憑空消失、無 `writeAudit`。等同一條無權限門檻、無稽核、不回沖的「刪帳後門」。
- **可觸發情境**：客人儲值 $800 結算美容（1000→200）→ STAFF 刪該美容紀錄 → payment 消失、`storedValue` 仍停 200，客人被吞 800 無痕跡。
- **修復建議**：關聯 payment 已 PAID 時拒絕刪除或改走 OWNER-only 退款/作廢流程（回沖儲值、收回點數、寫稽核）；至少對刪 PAID payment 加 `requireRole(["OWNER"])` + `writeAudit`。

**M4. 刪除客戶硬刪 Payment 真錢紀錄，繞過 RESTRICT 護欄、回溯改寫歷史營收、抹除預付負債**　`CONFIRMED`
檔案：`app/api/customers/[id]/route.ts:136`

- **為何危險**：`Payment.customerId` 刻意設 `ON DELETE RESTRICT`（有財務紀錄不可刪），但 DELETE handler 主動 `tx.payment.deleteMany` 把護欄架空。`reports` 營收聚合無客戶過濾 → 被刪的 PAID payment 從過去月份營收消失。未檢查 `storedValue>0`（預付負債）即整筆抹除。處理不對稱：Payment 硬刪、Sale 因 SET NULL 留存 → 服務營收消失、商品營收留著。
- **修復建議**：有財務紀錄的客戶改軟刪（status=ARCHIVED，比照 merge 的 MERGED）；若必須硬刪，先擋 `storedValue>0` 或有 PAID payment，Payment 改匿名化（customerId 指向保留客戶）而非 deleteMany，Sale 與 Payment 一致處理。

**M5. Customer 缺 `@@unique([shopId, phone])`，find-then-create 競態 + 店員無條件 create 產生重複客戶**　`CONFIRMED`
檔案：`prisma/schema.prisma:103`

- **為何危險**：只有非唯一 `@@index`。公開 `booking/request` 用 `findFirst→create`（TOCTOU）；`app/api/customers/route.ts:72` 店員建檔甚至無條件 create（連 race 都不需要）。`lookup` 的 `findFirst` 無 orderBy → 重複時命中不確定，合法回頭客可能被判「查無」，寵物/儲值/點數被拆散。專案另寫了 `customers/merge` 反證重複是已知問題。
- **修復建議**：加 `@@unique([shopId, phone])` + migration（先去重再加約束）；建立客戶改 upsert 或唯一衝突重試。

**M6. 訂閱限制 enforcement 家族缺口：公開端點繞過 maxCustomers、maxPets 死設定、訂閱過期不擋**　`CONFIRMED`
檔案：`lib/subscription-guard.ts:40`（連帶 `booking/request`、`pets`、`staff`）
*合併原始發現 #26 + #27 + #28。*

- **為何危險**：(a) `checkCustomerLimit` 只在後台 `customers POST` 呼叫，公開 `booking/request`、`contract/register` 直接 `customer.create` 不檢查上限 → 換手機號即可把計數推過 maxCustomers，反把後台建檔卡死。(b) 全 repo 無 `checkPetLimit`，三條建寵物路徑皆無數量檢查 → `Plan.maxPets` 是死設定。(c) `getSubscription` 算出 `isExpired` 卻無任何寫入路徑消費它 → TRIAL 過期店家仍可在上限內建客戶/員工。
- **修復建議**：公開建客戶端點建立前呼叫 `checkCustomerLimit`；新增 `checkPetLimit` 並於所有建寵物路徑呼叫；用量守衛中當 `isExpired` 或 status 不在允許清單時回 `allowed:false`，將訂閱狀態與寫入權限掛鉤。

**M7. 寄宿房間無佔用衝突檢查，同房可被多隻寵物同時入住（超賣）+ 退房誤釋放房況**　`CONFIRMED`
檔案：`app/api/boarding/route.ts:82`（連帶 `appointments/[id]/checkin`）

- **為何危險**：建 BoardingRecord 只驗房屬本店，不查該房是否已有 STAYING 紀錄/已 OCCUPIED，且 DB 無唯一約束。退房時無條件把房設回 AVAILABLE，不檢查是否還有其他在住 → 房況靜默失真，可導致實體重複入住。
- **修復建議**：建立寄宿/入住前檢查該 room 是否已有 STAYING 有效紀錄（或 `room.status==='OCCUPIED'`）則拒絕；退房改房況前確認無其他在住紀錄。

**M8. 預約狀態無狀態機約束，反覆切換 COMPLETED 可重複扣包月方案次數**　`CONFIRMED`
檔案：`app/api/appointments/[id]/route.ts:70`

- **為何危險**：status 是自由字串，可任意亂跳。扣次邏輯在 `body.status==='COMPLETED' && existing.status!=='COMPLETED'` 時 `usedSessions+1`，但無冪等標記、離開 COMPLETED 不回補，且無 `usedSessions<maxSessions` 守衛（可超扣）。
- **可觸發情境**：`COMPLETED(+1)→PENDING(不扣)→COMPLETED(+1)` 反覆即重複消耗客戶預付次數；`COMPLETED→CANCELLED` 永久消耗一次不退。
- **修復建議**：定義合法轉移白名單並於 PATCH 驗證；扣次改冪等（以 appointment 上「是否已扣過」標記為準，或離開 COMPLETED 時 decrement 回補）。

**M9. cron 提醒無冪等標記、兩個近乎相同端點、對外 fetch 無 timeout → 重複轟炸客戶 + 請求懸掛**　`CONFIRMED`
檔案：`app/api/cron/reminder/route.ts:46`（連帶 `cron/appointment-reminder`、`lib/line.ts:28`、`ocr/route.ts:60`）
*合併原始發現 #23 + #31。*

- **為何危險**：兩支 cron 邏輯幾乎相同（都撈明日 CONFIRMED/PENDING 推 LINE），Appointment 無 `reminderSentAt` 旗標、無重入鎖。遷移文件甚至把兩端點都列為要設定的 cron → 客人每天收 2 次提醒；重試/人工觸發再加倍。對外 fetch（LINE push、Vision OCR、`grooming/notify`）皆無 AbortController timeout，慢上游可讓使用者觸發的請求懸掛數分鐘（undici 預設約 300s）。
- **修復建議**：Appointment 加 `reminderSentAt`，發送前過濾、成功後條件更新標記達冪等；刪除/合併重複 cron 端點；所有對外 fetch 加 5–10s AbortController timeout；逐筆發送改有界並行並容忍個別失敗。

**M10. 多個清單端點 findMany 無 take/分頁且帶深層 include，資料量變大即拖垮 DB/記憶體**　`CONFIRMED`
檔案：`app/api/customers/route.ts:26`（連帶 payments/receivables/appointments/boarding/pets-all/reports）

- **為何危險**：`GET /api/customers` 對整店每位客人展開 pets→contract/groomingRecords + memberLevel/monthlyPlan/_count，一次序列化整個客戶庫。`appointments`（不帶 date/week 時 where 僅 shopId）、`pets/all`（無 search 時 `take:undefined`）、`reports`（撈該店全歷史 groomingRecord，隨時間單調成長）皆無上限。單實例服務全部租戶 → noisy-neighbor 拖累全平台。
- **修復建議**：所有列表端點加強制上限與游標分頁（`take:Math.min(limit,100)`+cursor）；列表只回必要欄位、明細另以 detail 端點按需載入；reports 歷史計算改 `groupBy`/聚合而非 findMany 進記憶體。

**M11. 請求 body 在驗證前整包讀進記憶體，且無全域 body 大小上限**　`CONFIRMED`
檔案：`app/api/ocr/route.ts:41`（共用 `lib/validation.ts:20` readJson）

- **為何危險**：所有端點先 `await req.json()` 才跑 Zod，`.max()` 在 parse 之後才生效、擋不住 buffering。next.config 無 body 上限、無 middleware、rate-limit 只計頻率不計位元組。未登入端點（booking/register/contract-sign）併發送數十~數百 MB body 即可 OOM 單一 Render 實例 → 全平台停擺。
- **修復建議**：反向代理/平台層設 body 上限；handler 先檢查 `Content-Length` 早退；需大 payload 的端點（簽名）設明確上限後再讀。

**M12. 速率限制取 X-Forwarded-For 最左值作為 client IP，可偽造繞過 per-IP 限制**　`CONFIRMED`
檔案：`lib/rate-limit.ts:67`

- **為何危險**：取 `xff.split(',')[0]`（最左=用戶自帶可偽造）；Render/Cloudflare 真實 IP 在右側，可信 header 只在 XFF 缺席時 fallback（幾乎永不採用）。每次帶不同 XFF 即得全新 bucket。最具體危害是 `register`（僅 per-IP 5/min、無 per-shop 後盾）→ 可無限建店 + 對超管信箱寄信轟炸 + DB 膨脹。
- **修復建議**：已知可信代理環境改用平台提供的可信 client IP（`cf-connecting-ip`/`x-real-ip` 或 XFF 最右側可信節點）；對只有 per-IP 的端點（register/line/send）加非 IP 維度限制。

**M13. 報表端點 N+1 查詢扇出 + 無下界全歷史掃描，隨資料量線性惡化**　`CONFIRMED`
檔案：`app/api/reports/route.ts:90`

- **為何危險**：`dailyRevenue` 對當月每天各發一筆 aggregate（最多 31）、`monthlyRevenue/Expense` 各 6 筆 ≈ 43+ round-trip；留存率 `beforeMonthRecs` 無時間下界、無 take，把該店全部歷史 groomingRecord 撈進 Node 做 Set 運算 → 記憶體/延遲單調成長，老店報表逾時。
- **修復建議**：日/月營收改單筆 `groupBy(date_trunc)`；留存率改 SQL 聚合（EXISTS/COUNT DISTINCT）；`beforeMonthRecs` 改存在性查詢或加時間下界。

**M14. render.yaml startCommand 每次開機無條件 `migrate resolve --applied 0_init`，假基線化空庫並掩蓋 failed migration**　`CONFIRMED`
檔案：`render.yaml:16`
*合併原始發現 #16 + #24。*

- **為何危險**：一次性 baseline 被寫進每次開機。對全新/重建庫：`--applied 0_init` 標已套用卻不建表 → `migrate deploy` 跳過 0_init → 套 `ALTER TABLE Payment` 時 `relation does not exist` → 部署磚化（DR/新環境最需要時失效）。更危險：若 0_init 曾 failed，`--rolled-back`+`--applied` 會自動清掉 failed 狀態並重新假基線化，App 在不完整 schema 上啟動，而專案明確無自動備份。
- **修復建議**：把 baseline 移出 startCommand 改成一次性 release/pre-deploy job；startCommand 只留 `prisma migrate deploy && npm start`；若必須自動化，先查 `_prisma_migrations` 且僅在「表已存在但未登錄」才 resolve，絕不無條件掩蓋 failed migration。

**M15. 註冊成功後 email/通知副作用拋錯 → 整筆 register 回 500，重試被 409 永久鎖死**　`CONFIRMED`
檔案：`app/api/register/route.ts:149`

- **為何危險**：交易 commit 後在同一 try 內 `await sendEmail`（無各自 try/catch）。production 設了 SMTP 時暫時性失敗會 reject → 翻轉一筆已成功的註冊成 500，含 shopId 的 201 body 從未送達前端。重試走 `existingUser` 檢查 → 409「Email 已使用」永久擋住；登入又硬性要 shopId（使用者不知道）、shop 又是 PENDING → 帳號已建卻完全鎖死，只能找客服。
- **修復建議**：commit 後副作用改 best-effort（各包 try/catch 或 `.catch(()=>{})`），交易成功立即回 201（含 shopId），寄信/通知失敗只記 log；既有 email 重複改提供重送驗證而非硬 409。

---

### 🔵 LOW

**L1. 退款回沖儲值但不收回收款時發放的點數**　`CONFIRMED`
`app/api/payments/[id]/refund/route.ts:79` — refund 只在 CREDIT 回沖 storedValue，從不扣回先前發出的點數、無負額 pointsHistory。OWNER 反覆「收款→退款」可不斷灌點，後續兌換/升等失真。**修復**：退款同交易內按比例扣回點數並寫負額 pointsHistory，不可扣負時用 guarded updateMany。

**L2. 公開存取權杖（grooming viewToken）用非 CSPRNG 的 cuid v1，公開檢視頁無速率限制**　`PLAUSIBLE`
`prisma/schema.prisma:204` — `/grooming/[token]` 無 requireAuth/無限流，憑單一 cuid bearer 即回客戶姓名/寵物狀況/前後照片/金額；viewToken 明文出現在 LINE 連結。但「還原 V8 PRNG 預測 token」不成立（Prisma 7 cuid 由 Rust 引擎產生）、~41bit 隨機段線上列舉不可行 → 屬縱深防禦硬化而非可批量觸發。**修復**：公開權杖改 `crypto.randomUUID()/randomBytes`；`/grooming/[token]` 與 `grooming/confirm` 補 per-IP 限流；viewToken 加過期。

**L3. 公開建檔的 personality 陣列與 vaccineRecords 無長度上限，可寫超大 JSON**　`CONFIRMED`
`app/api/contract/[shopId]/register/route.ts:23` — `z.array(z.string())` 與 `z.unknown()` 皆無 `.max()`，鄰近欄位卻有 shortText(200)/longText(5000)。受 per-shop 30/min 節流但單筆 body 無上限。**修復**：personality 加 `.max(N)`+元素 `.max(50)`；vaccineRecords 用具體 schema 或大小上限；整體 body 設合理上限。

**L4. Sale 缺 `@@index([shopId, createdAt])`，銷售清單/每日結帳走不到索引**　`CONFIRMED`
`prisma/schema.prisma:512` — Payment 有 `@@index([shopId, paidAt])`，對稱的 Sale 無。`sales` 與 reports 頁（無 take、區間可大）的 shopId+createdAt 範圍+排序只能 filesort。**修復**：加 `@@index([shopId, createdAt])`，視需要給 Appointment 加 `@@index([shopId, scheduledAt])`。

**L5. 客戶合併遺漏 Sale 重指，且 MERGED 殭屍客戶出現在客戶選擇器**　`CONFIRMED`
`app/api/customers/merge/route.ts:38` — merge 重指 pet/payment/points/storedValue 但漏 `sales`，銷售仍掛 MERGED 殭屍。主清單頁已過濾 MERGED，但 `app/api/customers/route.ts` GET（開單/應收選客戶下拉用）未過濾，且 sales POST 不擋 status → 可把新銷售掛到殭屍。**修復**：merge 補 `tx.sale.updateMany`；`customers` GET 加 `status:{not:"MERGED"}`。

**L6. 公開合約/註冊頁僅靠寫入時消毒，渲染時不再消毒（潛在 stored XSS 縱深缺口）**　`PLAUSIBLE`
`app/contract/[token]/page.tsx:127` — 兩個 `dangerouslySetInnerHTML` 渲染點未呼叫 `sanitizeContractHtml`，違反 `lib/sanitize.ts` 自身「before storing AND before rendering」契約。目前所有寫入路徑都消毒故不可觸發，但任何未來新增/遺漏消毒的寫入路徑或 DB 直寫即成 stored XSS。**修復**：三個渲染點也呼叫 server 端渲染前消毒，落實縱深防禦。

**L7. CSP `script-src` 同時允許 `'unsafe-inline'` 與 `'unsafe-eval'`，弱化 XSS 第二道防線**　`CONFIRMED`
`next.config.ts:11`
*合併原始發現 #19 + #32。* — 套用到所有路由含公開合約渲染頁，一旦 sanitizer 被繞過，inline script 不被 CSP 攔下；`img-src https:` 另允許 beacon 外洩。**修復**：導入 nonce-based CSP（middleware 注入 per-request nonce）移除 unsafe-inline，確認無依賴後移除 unsafe-eval。

**L8. 公開寫入端點（booking/contract-register）只有 IP+店家限流、無驗證碼/去重，可灌入永久垃圾資料**　`CONFIRMED`
`app/api/booking/[shopId]/request/route.ts:54` — `appointment.create`/`notification.create` 無條件每筆執行（不需換 phone）。以輪換 IP 壓到 shop 60/min ≈ 8.6 萬筆/日。配合 M10 可讓受害店家列表/通知頁難以載入。**修復**：加 captcha/PoW 或店家層日上限；短時重複建立做節流去重；通知合併。

**L9. 預約狀態樂觀更新未檢查 res.ok，失敗時 UI 與 DB 不一致且可能卡死控制項**　`CONFIRMED`
`components/appointments/appointment-actions.tsx:72` — 先 `setOptimisticStatus` 後 `await fetch` 無 res.ok 檢查/無 try-catch。4xx/5xx 時 UI 持續顯示新狀態；fetch reject 時 `setLoading(false)`/`refresh()` 不執行 → select 永久 disabled 無錯誤提示。**修復**：檢查 res.ok 失敗則還原並顯示錯誤；try/catch/finally 確保 loading 復原。

**L10. SEC-4 的 DB TLS 修復不完整：多個 operator 腳本（含超管提權腳本）仍 `rejectUnauthorized:false`**　`CONFIRMED`
`scripts/set-superadmin.ts:8` — buildSsl() 修復只套到 `lib/prisma.ts`/`seed-data.ts`，`set-superadmin.ts`/`check-db.ts`/`seed.ts`/`add-today-appt.ts` 對遠端連線仍停用憑證驗證（add-today-appt 連 isLocal 都不判）。其中 set-superadmin 無 prod guard。需主動 MITM 持偽造憑證才可利用，故 LOW。**修復**：抽共用 buildSsl() 讓所有 scripts 共用 `rejectUnauthorized:true`+`DATABASE_CA_CERT`，移除散落的 false。

**L11. seed 把一般示範店家 OWNER 設為 `isSuperAdmin=true`**　`CONFIRMED`
`prisma/seed.ts:187` — 超管閘只憑 `session.user.isSuperAdmin`、不要求 `shopId==="system"`，示範店主一旦 seed 即取得跨平台超管。seed 在 production 被擋故 LOW，但套到共享 staging/demo 即「一般 OWNER=平台超管」。**修復**：示範店主移除 isSuperAdmin，超管只給 system 店的 superadmin 帳號；`scripts/seed-data.ts:101` 同步修。

---

### ⓘ 附註（驗證後降為 INFO，列出供參，不需列入修復清單）

- **公開預約頁未過濾 `isPublic`**（`booking/[shopId]/page.tsx`）：程式碼與 menu 頁不一致屬實，但 `isPublic` 在本 app 無任何 UI/API 能設為 false（恆為預設 true），故當前無實際洩漏；屬死旗標，未來新增 isPublic 切換功能時須記得同步 booking 頁。
- **next-auth beta / react-signature-canvas alpha 預發行依賴**（`package.json:48,56`）：版本事實屬實，但 committed `package-lock.json` 已精確 pin，`npm ci` 不會漂移；屬相依衛生建議——pin 確切版號 + 受控升級回歸測試。

---

## 三、優先修復順序（前 5 名）

1. **C1 — `auth.ts` 停用分支 + 統一守衛**：根因影響最廣（撤權反轉成提權 + 27+ 路由跨租戶），且修法（統一 `requireAuth()`、清除特權 claim）一次堵住最多缺口。**必須最先做**。
2. **H2 — API 層強制 `shop.status`**：與 C1 共用「守衛集中化」修法，順手在 `requireAuth()` 加 status 檢查即可同時關閉停權/審核繞過。
3. **H1 — LINE webhook 綁定碼 + scope shopId**：唯一「未登入即跨租戶洩漏金額 PII + 劫持通知」的破口，收真實會員前的硬門檻。
4. **M1–M4 金流口徑（退款報表、collect billingType、刪美容/刪客戶硬刪 payment）**：收真錢前，營收/儲值/退款必須對得平，且這四條都會造成靜默的真錢/帳務失真。
5. **M11 + M10 + M12（body 上限 / 列表分頁 / 真實 client IP）**：單實例多租戶架構下的可用性地雷，任一被觸發即全平台停擺；修法相對獨立、可平行進行。

> 同時請完成 recon 已知未修項：**輪換 git 歷史外洩憑證、repo 設 private、正式 DB 配自動 off-host 備份、金額由 Float 轉 Decimal**——這些是與上述並行的 launch-blocker。

---

## 四、值得肯定的地方（這專案做對的安全實作）

1. **`booking/[shopId]/lookup` 的雙因子防枚舉（AUTH-4）**：要求 phone+name、scope 單一 shopId、限流、非確認式回應（查無與名字不符同樣回 `{found:false}`）——這是教科書級的防 PII 列舉設計，可惜 LINE webhook 沒比照。
2. **refund 的正規退款管控**：OWNER-only + `writeAudit` + CREDIT 回沖 storedValue + 寫 StoredValueHistory，付款 PATCH 改 status 也 OWNER-only+稽核——退款這條主路徑本身是嚴謹的（問題在旁路的刪美容/刪客戶繞過它）。
3. **存在正確的共用守衛 `lib/auth-guard.ts`**：`requireAuth()/requireRole()` 已正確檢查 `shopId`/角色——基礎建設是對的，缺的是「全面採用」而非「重新設計」，修復成本因此可控。
4. **寫入時 allowlist sanitize-html**：合約 HTML 在所有寫入路徑都消毒（drop `<script>`、禁 `javascript:` scheme），CSP 也設了 `object-src 'none'`/`frame-ancestors 'none'`/`base-uri 'self'`——XSS 第一道防線到位。
5. **DB 層 RESTRICT 護欄與刻意的關聯刪除策略**：`Payment.customerId ON DELETE RESTRICT`、Sale `SET NULL`、Pet/History `CASCADE` 是有意識的設計（雖被應用層 deleteMany 架空）。
6. **collect 的 PENDING→PAID 閘門與 `usedSessions<maxSessions` 守衛**：付款結算主路徑有狀態閘與包月上限檢查（問題在 appointment status 旁路沒有同等守衛）。
7. **誠實的自評**：`SECURITY_REMEDIATION.md` 明言「靜態綠≠真跑對、測試 mock 掉 DB」、主動列出已知未修項——這種不粉飾的工程誠實，比假裝全綠的報告可信得多，也讓本次審計能聚焦真正的盲區。
