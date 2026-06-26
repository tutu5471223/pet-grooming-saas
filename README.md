# PetGroomPro — 寵物美容 SaaS 管理系統

> MVP v1.0 · 多店家 SaaS · Next.js 16 · Prisma 7 · SQLite

一個專為寵物美容店設計的全方位管理後台，涵蓋預約排程、客人管理、住宿管理、財務報表，並內建 SaaS 訂閱機制與超級管理員後台。

---

## 技術架構

| 層次 | 技術 |
|------|------|
| 前端框架 | Next.js 16.2.4（App Router、React Server Components） |
| UI 元件 | Tailwind CSS v4 + Radix UI + Lucide Icons |
| 後端 API | Next.js Route Handlers（App Router API） |
| 資料庫 ORM | Prisma 7.8（LibSQL adapter） |
| 資料庫 | SQLite（開發）/ Turso LibSQL（生產） |
| 驗證 | NextAuth.js v5（JWT Session，Credentials Provider） |
| 圖表 | Recharts |
| 測試框架 | Vitest 4 |
| 部署目標 | Vercel / Railway / Fly.io |

---

## 本機開發啟動

### 前置需求

- Node.js 20+
- npm 10+

### 步驟

```bash
# 1. 複製專案
git clone <repo-url>
cd pet-grooming-saas

# 2. 安裝相依套件
npm install

# 3. 設定環境變數
cp .env.example .env.local
# 編輯 .env.local，至少填入：
#   NEXTAUTH_SECRET=your-random-secret-32chars+
#   NEXTAUTH_URL=http://localhost:3000

# 4. 同步資料庫 Schema
npx prisma db push

# 5. 重新生成 Prisma Client
npx prisma generate

# 6. 填入測試資料
npx tsx prisma/seed.ts

# 7. 啟動開發伺服器
npm run dev
```

打開瀏覽器前往 [http://localhost:3000](http://localhost:3000)

---

## 測試帳號

### 一般店家後台

| 角色 | Email | 密碼 | 店家 ID |
|------|-------|------|---------|
| 店長（OWNER） | `admin@maomao.com` | `admin123` | `demo-shop-001` |
| 美容師 | `lily@maomao.com` | `staff123` | `demo-shop-001` |
| 美容師 | `jason@maomao.com` | `staff123` | `demo-shop-001` |

### 超級管理員後台 `/admin`

| 角色 | Email | 密碼 | 店家 ID |
|------|-------|------|---------|
| 超級管理員 | `superadmin@system.com` | `superadmin2026` | `system` |

---

## 資料夾結構

```
pet-grooming-saas/
├── app/
│   ├── (auth)/               # 登入、註冊頁面
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/          # 店家後台（需登入）
│   │   ├── dashboard/        # 儀表板 + 快捷操作
│   │   ├── customers/        # 客人管理
│   │   ├── appointments/     # 預約排程（日/週視圖）
│   │   ├── boarding/         # 寵物住宿管理
│   │   ├── reports/          # 營收報表
│   │   ├── receivables/      # 應收帳款
│   │   ├── audit-logs/       # 操作稽核記錄
│   │   └── settings/         # 系統設定（多 Tab）
│   ├── (admin)/              # 超級管理員後台
│   │   └── admin/
│   │       ├── page.tsx      # 平台總覽
│   │       ├── shops/        # 店家管理 + 詳情
│   │       └── stats/        # 流量儀表板
│   ├── api/                  # 所有 Route Handlers（50+ 端點）
│   ├── booking/[shopId]/     # 公開線上預約頁
│   ├── contract/[token]/     # 公開合約簽署頁
│   ├── grooming/[token]/     # 公開美容報告頁
│   └── pricing/              # 公開定價頁
├── components/
│   ├── ui/                   # 基礎 UI 元件（Button、Input、Card 等）
│   ├── layout/               # Sidebar、Providers
│   ├── appointments/         # 週視圖行事曆、衝突提示
│   ├── customers/            # 客人旗標、合併、批次通知
│   ├── settings/             # 各設定 Tab 元件
│   └── dashboard/            # 圖表元件
├── lib/
│   ├── prisma.ts             # Prisma client 單例
│   ├── audit.ts              # writeAudit() 稽核函式
│   ├── auth-guard.ts         # requireRole() 角色守衛
│   ├── subscription-guard.ts # 方案用量限制守衛
│   └── utils.ts              # 工具函式
├── prisma/
│   ├── schema.prisma         # 資料庫 Schema（16 個資料表）
│   └── seed.ts               # 測試資料生成腳本
├── tests/
│   └── security/             # 多店家資料隔離測試（18 條）
├── types/
│   └── next-auth.d.ts        # Session 型別擴充
└── auth.ts                   # NextAuth 設定
```

---

## 已實作功能清單

### Phase 0 — 基礎建設
- 多店家架構（shopId 隔離，所有 API 強制過濾）
- JWT Session 驗證（NextAuth v5）
- 角色系統（OWNER / STAFF）
- 18 條多店家資料隔離安全測試

### Phase 1–4 — 核心業務
- 客人管理（CRUD、搜尋、儲值、點數、旗標）
- 寵物管理（多寵物、疫苗記錄、照片）
- 服務項目管理（分類、編輯/刪除）
- 員工管理（CRUD、角色指派）
- 美容記錄（前後照片、膚況、PDF 輸出）
- 電子合約（手寫簽名、QRCode 連結）
- 預約排程（日視圖、週視圖、衝突偵測）
- 住宿管理（房間、入退房、日誌、費用計算）
- 付款管理（多種付款方式、退款）
- 月度營收報表（趨勢、員工業績、服務統計）
- 應收帳款管理（帳齡警示）

### Batch B–F — 進階功能
- 客人黑名單 / 旗標系統
- 客人帳號合併（事務性資料轉移）
- 批次通知（依等級/活躍度篩選）
- 預約提醒範本設定
- 會員等級 CRUD + 自動升降級
- 服務分類管理（行內編輯）
- 全站 Cmd+K 快速搜尋
- 儀表板快捷操作按鈕
- 操作稽核記錄（Audit Log）

### Phase 5 — SaaS 商業化
- 訂閱方案系統（試用/基礎/專業）
- 用量限制守衛（超額阻擋）
- 公開定價頁 `/pricing`
- 商家自助用量頁（彩色進度條、升級 Banner）
- 超級管理員後台（平台總覽、店家管理、流量儀表板）

---

## 常用指令

```bash
npm run dev             # 開發模式
npm run build           # 生產建置
npm test                # 執行安全測試（18 條）
npx prisma studio       # 圖形化資料庫瀏覽器
npx tsx prisma/seed.ts  # 重置測試資料
npx prisma db push      # 同步 Schema 變更
npx prisma generate     # 重新生成 Prisma Client
```

---

## 環境變數

| 變數 | 說明 |
|------|------|
| `NEXTAUTH_SECRET` | JWT 加密金鑰（至少 32 字元） |
| `NEXTAUTH_URL` | 應用程式 URL（本機：`http://localhost:3000`） |
| `NEXT_PUBLIC_BASE_URL` | 公開連結基礎 URL |

---

## License

Private — All rights reserved.

# 自動部署測試
