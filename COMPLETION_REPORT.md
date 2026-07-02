# PetOS71 — 完成報告 (v1.0 MVP)

> 產出日期：2026-05-04  
> 開發階段：Phase 0 → Phase 5 + Batch B–F + H1–H2  
> TypeScript 錯誤：0　｜　安全測試：18 / 18 通過

---

## 一、已完成功能清單

### Phase 0 — 基礎建設
| 功能 | 說明 |
|------|------|
| 多店家架構 | 所有 API 強制以 `shopId`（來自 JWT Session）過濾，防止跨店資料洩漏 |
| JWT Session 驗證 | NextAuth.js v5，Credentials Provider，自訂 Session 欄位 |
| 角色系統 | `OWNER` / `STAFF` 兩種角色；`requireRole()` 守衛函式 |
| 安全測試套件 | Vitest 18 條多店家資料隔離測試，全部通過 |

### Phase 1 — 客人 & 寵物管理
| 功能 | 說明 |
|------|------|
| 客人 CRUD | 新增、查詢、編輯、停用（軟刪除），含搜尋與分頁 |
| 儲值管理 | 儲值加值 / 扣款，歷史記錄 |
| 點數管理 | 點數累積 / 兌換，歷史記錄 |
| 月票方案 | 方案 CRUD；指派客人至月票；到期日計算 |
| 寵物 CRUD | 多寵物、品種、性別、生日、晶片、疫苗記錄 |
| 寵物照片 | 上傳寵物大頭照 |

### Phase 2 — 服務 & 員工管理
| 功能 | 說明 |
|------|------|
| 服務項目 CRUD | 新增 / 編輯 / 軟刪除；分類、定價、時長 |
| 員工管理 CRUD | 新增 / 編輯 / 停用員工；角色指派（OWNER/STAFF） |
| 服務分類行內編輯 | 直接在列表上改名、刪除分類（Batch E） |

### Phase 3 — 美容 & 合約
| 功能 | 說明 |
|------|------|
| 美容記錄 | 美容前後照片、膚況、毛況、使用產品、費用 |
| 美容報告公開頁 | `/grooming/[token]` 公開分享連結（不需登入） |
| 電子合約 | 合約內容生成、QRCode 連結 |
| 合約手寫簽名 | `/contract/[token]` 公開簽名頁，含手寫簽名 Canvas |
| 合約更新 / 重簽 | 寵物合約到期後重新產出 |

### Phase 4 — 預約 & 住宿 & 財務
| 功能 | 說明 |
|------|------|
| 預約管理 | CRUD；衝突偵測；狀態流轉（PENDING → CONFIRMED → DONE → CANCELLED） |
| 日視圖排程 | 依日期瀏覽當日所有預約 |
| 週視圖行事曆 | 7 天橫向排列，員工欄位縱向，拖曳感知 UI |
| 住宿管理 | 房間 CRUD；入退房記錄；每日日誌；費用計算 |
| 付款管理 | 多種付款方式（現金 / 轉帳 / 儲值 / 月票）；退款 |
| 月度報表 | 月營收趨勢（Recharts）；員工業績；服務統計 |
| 每日報表 | 當日收款彙整 |
| 應收帳款管理 | AR 建立（狀態 PENDING）；標記已付；帳齡警示（Batch D） |
| 線上公開預約頁 | `/booking/[shopId]` 讓客人自行線上填單 |

### Batch B–F — 進階功能
| 功能 | 說明 |
|------|------|
| 客人旗標系統 | 黑名單 / 警示 / 特殊標記；旗標顯示於列表與詳情 |
| 客人帳號合併 | 選定主從帳號，事務性轉移寵物 / 付款 / 歷史記錄 |
| 批次通知 | 依會員等級 / 活躍度篩選，發送預設訊息 |
| 預約提醒範本 | 設定頁「提醒設定」Tab，儲存提醒訊息模板 |
| 會員等級 CRUD | 新增 / 編輯 / 刪除等級；最低點數、折扣率、顏色 |
| 自動升降級 | 一鍵觸發 `POST /api/member-levels/sync`，回傳升降級人數 |
| 全站快速搜尋 | `Cmd+K` / `Ctrl+K` 跳出搜尋框，涵蓋客人、寵物、預約 |
| 儀表板快捷按鈕 | 新增預約、新增客人、週視圖、查看報表 四個快捷入口 |
| 操作稽核記錄 | 每次 create / update / delete 呼叫 `writeAudit()`；OWNER 可查看完整記錄 |

### Phase 5 — SaaS 商業化
| 功能 | 說明 |
|------|------|
| 訂閱方案系統 | 3 個方案（試用免費 / 基礎 NT$990 / 專業 NT$1,990） |
| 用量限制守衛 | `checkCustomerLimit()` / `checkStaffLimit()` 超額回傳 HTTP 403 |
| 自動試用期 | 新商家註冊後自動建立 14 天試用訂閱 |
| 商家用量頁 | 設定頁「訂閱方案」Tab，彩色進度條、智慧 Banner、到期倒數 |
| 公開定價頁 | `/pricing` 行銷頁，3 方案對比、FAQ、CTA |
| 超級管理員後台 | `/admin` 路由群組，需 `isSuperAdmin = true` |
| 平台總覽儀表板 | 總店家數、付費訂閱數、試用數、總客人數、總預約數 |
| 店家管理 | 列表、搜尋、詳情（方案狀態、聯絡資料） |
| 流量儀表板 | 近 6 個月新增店家折線圖；訂閱狀態分布圖；各店用量排序表 |

### H1–H2 — 用量管理強化
| 功能 | 說明 |
|------|------|
| 管理員用量排序表 | 可依店名 / 客人數 / 到期日 / 方案狀態排序；超過 80% 紅底警示 |
| 接近上限 Banner | 管理員看到「N 間店家超過 80%」警告 |
| 商家 Banner 優先級 | 100% 阻擋（紅）> 90% 警示（橘）> 試用剩 3 天（紅） |
| 升級引導卡片 | 客人數 ≥ 70% 或試用剩 10 天時，顯示升級提示卡 |

---

## 二、資料庫資料表清單（19 張資料表）

| # | 資料表 | 說明 |
|---|--------|------|
| 1 | `Shop` | 店家主檔，含業務設定、提醒範本 |
| 2 | `User` | 員工帳號，含角色、isSuperAdmin 旗標 |
| 3 | `Customer` | 客人主檔，含儲值、點數、會員等級、旗標 |
| 4 | `Pet` | 寵物主檔，含疫苗記錄、晶片、照片 |
| 5 | `Contract` | 電子合約，含公開 token、簽名 URL |
| 6 | `GroomingRecord` | 美容記錄，含前後照片、膚況、公開分享 token |
| 7 | `BoardingRoom` | 住宿房間，含類型、日費 |
| 8 | `BoardingRecord` | 住宿記錄，含入退房、費用、加購服務 |
| 9 | `BoardingDailyLog` | 住宿每日日誌，含狀態 / 備註 |
| 10 | `Appointment` | 預約記錄，含類型、狀態、指派員工 |
| 11 | `Payment` | 付款記錄，含方式、狀態（PAID / PENDING / REFUNDED） |
| 12 | `Service` | 服務項目，含分類、定價、時長、軟刪除 |
| 13 | `MemberLevel` | 會員等級，含最低點數、折扣率、顏色 |
| 14 | `MonthlyPlan` | 月票方案，含次數、有效天數 |
| 15 | `PointsHistory` | 點數異動記錄（不可逆） |
| 16 | `StoredValueHistory` | 儲值異動記錄（不可逆） |
| 17 | `AuditLog` | 操作稽核記錄，含 action / resource / detail |
| 18 | `Plan` | SaaS 訂閱方案定義，含用量上限 |
| 19 | `Subscription` | 店家訂閱狀態，含週期與狀態（TRIAL / ACTIVE / PAST_DUE / CANCELLED） |

---

## 三、API 路由完整清單（51 個路由檔，70+ HTTP 端點）

### 認證
| 路由 | 方法 | 說明 |
|------|------|------|
| `/api/auth/[...nextauth]` | GET / POST | NextAuth.js 登入 / 登出 / Session |
| `/api/register` | POST | 商家自助註冊（含自動試用訂閱） |

### 客人管理
| 路由 | 方法 | 說明 |
|------|------|------|
| `/api/customers` | GET / POST | 列表（搜尋）/ 新增（含用量守衛） |
| `/api/customers/[id]` | GET / PATCH / DELETE | 詳情 / 更新 / 停用 |
| `/api/customers/[id]/stored-value` | POST | 儲值加值 / 扣款 |
| `/api/customers/[id]/points` | POST | 點數異動 |
| `/api/customers/[id]/monthly-plan` | POST | 指派 / 移除月票方案 |
| `/api/customers/merge` | POST | 帳號合併（事務性） |

### 寵物管理
| 路由 | 方法 | 說明 |
|------|------|------|
| `/api/pets` | GET / POST | 列表 / 新增 |
| `/api/pets/all` | GET | 全店寵物清單（下拉用） |
| `/api/pets/[id]` | GET / PATCH / DELETE | 詳情 / 更新 / 停用 |
| `/api/pets/[id]/contracts/create` | POST | 新增合約 |
| `/api/pets/[id]/contracts/renew` | POST | 合約更新 |

### 預約管理
| 路由 | 方法 | 說明 |
|------|------|------|
| `/api/appointments` | GET / POST | 列表（日期篩選）/ 新增 |
| `/api/appointments/[id]` | GET / PATCH / DELETE | 詳情 / 更新 / 取消 |
| `/api/appointments/[id]/checkin` | PATCH | 打卡到達 |

### 美容記錄
| 路由 | 方法 | 說明 |
|------|------|------|
| `/api/grooming` | GET / POST | 列表 / 新增美容記錄 |
| `/api/upload` | POST | 上傳照片（Base64 → 儲存） |

### 住宿管理
| 路由 | 方法 | 說明 |
|------|------|------|
| `/api/boarding` | GET / POST | 住宿記錄列表 / 新增 |
| `/api/boarding/[id]` | PATCH / DELETE | 更新（退房）/ 刪除 |
| `/api/boarding/[id]/logs` | GET / POST | 每日日誌列表 / 新增 |
| `/api/boarding/rooms` | GET | 住宿房間列表（含狀態） |
| `/api/rooms` | GET / POST | 房間 CRUD |

### 付款 & 應收帳款
| 路由 | 方法 | 說明 |
|------|------|------|
| `/api/payments` | GET / POST | 付款記錄列表 / 新增 |
| `/api/payments/[id]` | PATCH | 更新付款備註 |
| `/api/payments/[id]/refund` | POST | 退款（status → REFUNDED） |
| `/api/receivables` | GET / POST | 應收帳款列表 / 新增 AR |
| `/api/receivables/[id]` | PATCH / DELETE | 標記已付 / 刪除（OWNER） |

### 服務 & 人員
| 路由 | 方法 | 說明 |
|------|------|------|
| `/api/services` | GET / POST | 服務項目列表 / 新增 |
| `/api/services/[id]` | PATCH / DELETE | 更新 / 軟刪除 |
| `/api/staff` | GET / POST | 員工列表 / 新增（含用量守衛） |
| `/api/staff/[id]` | PATCH / DELETE | 更新 / 停用 |

### 會員 & 月票
| 路由 | 方法 | 說明 |
|------|------|------|
| `/api/member-levels` | GET / POST | 等級列表 / 新增 |
| `/api/member-levels/[id]` | PATCH / DELETE | 更新 / 刪除 |
| `/api/member-levels/sync` | POST | 自動升降級（掃描全店客人） |
| `/api/monthly-plans` | GET / POST | 月票方案列表 / 新增 |
| `/api/monthly-plans/[id]` | PATCH / DELETE | 更新 / 停用 |

### 報表 & 稽核
| 路由 | 方法 | 說明 |
|------|------|------|
| `/api/reports` | GET | 月度報表（營收趨勢、員工業績、服務統計） |
| `/api/reports/daily` | GET | 每日收款彙整 |
| `/api/dashboard` | GET | 儀表板統計數字 |
| `/api/audit-logs` | GET | 操作稽核記錄（OWNER only） |

### 搜尋 & 設定
| 路由 | 方法 | 說明 |
|------|------|------|
| `/api/search` | GET | 全站搜尋（客人 / 寵物 / 預約） |
| `/api/shops/[id]` | GET / PATCH | 店家設定查詢 / 更新 |

### SaaS 訂閱
| 路由 | 方法 | 說明 |
|------|------|------|
| `/api/plans` | GET | 公開方案列表 |
| `/api/subscription` | GET | 當前店家訂閱資訊 + 用量統計 |

### 公開頁面 API
| 路由 | 方法 | 說明 |
|------|------|------|
| `/api/booking/[shopId]/info` | GET | 公開預約頁取得店家資訊 |
| `/api/booking/[shopId]/request` | POST | 客人提交線上預約申請 |
| `/api/contracts/[id]/sign` | POST | 客人提交合約手寫簽名 |

### 超級管理員
| 路由 | 方法 | 說明 |
|------|------|------|
| `/api/admin/shops` | GET / POST | 平台店家列表 / 新增店家 |
| `/api/admin/shops/[id]` | GET / PATCH / DELETE | 店家詳情 / 更新 / 停用 |
| `/api/admin/stats` | GET | 平台統計 + 各店用量資料 |

---

## 四、已知限制與待改進事項

### 技術層面
| 項目 | 說明 |
|------|------|
| 無真實金流串接 | 訂閱付款僅為 UI 展示，未串接藍新 / 綠界等金流 |
| SQLite 單機限制 | 本地開發使用 SQLite；生產環境需切換至 Turso LibSQL 或 PostgreSQL |
| 圖片儲存 | 目前以 Base64 存入 DB；生產應改用 S3 / Cloudflare R2 |
| 無推播通知 | 預約提醒範本已儲存，但尚未串接 LINE Notify / Firebase FCM 實際發送 |
| 無線上簽名 PDF 生成 | 合約簽名後尚未自動產出 PDF 並寄送 |
| 搜尋無分頁 | 全站搜尋 `/api/search` 無結果數量限制（未來應加 cursor-based 分頁） |

### 業務層面
| 項目 | 說明 |
|------|------|
| 訂閱升降級流程 | 升級 / 降級方案的比例退費邏輯尚未實作 |
| 訂閱到期自動處理 | 無排程工作（cron job）自動將到期訂閱改為 CANCELLED |
| 多語系 | 目前僅繁體中文，無 i18n 架構 |
| 行動版 RWD | 部分複雜表格（週視圖行事曆、用量表）在手機螢幕上體驗待優化 |

---

## 五、建議的下一步

### 1. 上線部署
```
建議平台：Vercel（前端 + API）+ Turso（SQLite LibSQL 雲端）

步驟：
  1. 設定 Turso 資料庫，取得 TURSO_DATABASE_URL + TURSO_AUTH_TOKEN
  2. 更新 prisma/schema.prisma datasource 加入 url / authToken
  3. npx prisma db push（生產）
  4. Vercel 部署，設定環境變數：
       NEXTAUTH_SECRET、NEXTAUTH_URL、NEXT_PUBLIC_BASE_URL
       TURSO_DATABASE_URL、TURSO_AUTH_TOKEN
  5. 執行 seed（僅初始化 Plans + superadmin）
```

### 2. 圖片儲存遷移（Cloudflare R2）
```
目標：將 Base64 圖片改為雲端物件儲存

步驟：
  1. 建立 R2 Bucket，取得 API Token
  2. 修改 /api/upload route，改用 @aws-sdk/client-s3 上傳至 R2
  3. 回傳公開 CDN URL 儲存至 DB（取代 Base64 字串）
  4. 遷移腳本將現有 Base64 資料移至 R2
```

### 3. LINE Notify 串接（預約提醒）
```
目標：自動發送預約確認 / 提醒訊息給客人

步驟：
  1. 申請 LINE Messaging API Channel
  2. 新增 env：LINE_CHANNEL_ACCESS_TOKEN
  3. 新增 lib/line-notify.ts，封裝 pushMessage()
  4. 在預約確認（PATCH status=CONFIRMED）時觸發發送
  5. 使用 reminderTemplate 欄位填入自訂訊息
```

### 4. 金流串接（藍新 / 綠界）
```
目標：實現 SaaS 訂閱自動扣款

步驟：
  1. 申請藍新金流 API 帳號
  2. 新增 /api/billing/checkout route，建立付款訂單
  3. 新增 /api/billing/webhook route，接收付款結果
  4. Webhook 接收後更新 Subscription.status = "ACTIVE"
  5. 加入 cron job（Vercel Cron）每日檢查到期訂閱
```

### 5. 排程工作（訂閱到期處理）
```
目標：自動將到期的 TRIAL / ACTIVE 訂閱改為對應狀態

建議：Vercel Cron Jobs（每日 00:00 執行）
  - TRIAL 到期 → status = "CANCELLED"，封鎖 create 操作
  - ACTIVE 到期 + 未成功扣款 → status = "PAST_DUE"
  - PAST_DUE 超過 7 天 → status = "CANCELLED"
```

---

## 六、測試狀況

```
測試框架：Vitest 4
測試位置：tests/security/

Test Files  1 passed (1)
      Tests  18 passed (18)
   Duration  531ms

涵蓋範圍：
  - 跨店 Customer 資料隔離
  - 跨店 Pet 資料隔離
  - 跨店 Appointment 資料隔離
  - 跨店 Payment 資料隔離
  - 跨店 Staff 資料隔離
  - 跨店 Service 資料隔離
  - SuperAdmin 無店家資料讀取限制
  - 未登入者 API 拒絕存取
```

---

## 七、專案統計

| 指標 | 數量 |
|------|------|
| 資料庫資料表 | 19 張 |
| API 路由檔案 | 51 個 |
| HTTP 端點數 | 70+ 個 |
| 頁面路由 | 20+ 個 |
| 安全測試 | 18 條，全部通過 |
| TypeScript 錯誤 | 0 |
| 開發階段 | Phase 0–5 + Batch B–F + H1–H2 |
