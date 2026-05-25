# Phase 0 安全稽核報告：多店家資料隔離

**執行者**：美金  
**審計時間**：2026-05-03  
**測試結果**：18 / 18 通過 ✅

---

## 一、稽核範圍

共稽核 **17 個 API 路由檔案**（含 auth 路由）：

| 路由 | 方法 |
|------|------|
| `/api/auth/[...nextauth]` | GET / POST |
| `/api/dashboard` | GET |
| `/api/customers` | GET / POST |
| `/api/customers/[id]` | GET / PATCH / DELETE |
| `/api/pets` | POST |
| `/api/pets/[id]` | GET / PATCH / DELETE |
| `/api/pets/all` | GET |
| `/api/contracts/[id]/sign` | POST |
| `/api/grooming` | GET / POST |
| `/api/appointments` | GET / POST |
| `/api/appointments/[id]` | PATCH / DELETE |
| `/api/boarding` | GET / POST |
| `/api/boarding/[id]` | PATCH |
| `/api/services` | GET / POST |
| `/api/rooms` | GET / POST |
| `/api/staff` | GET |
| `/api/shops/[shopId]` | PATCH |

---

## 二、發現並修復的隔離漏洞

### 🔴 漏洞 1（高危）— `/api/contracts/[id]/sign`

**檔案**：`app/api/contracts/[id]/sign/route.ts`

**問題描述**：  
公開端點僅用 `contract.id`（資料庫 primary key）進行查詢與簽署，完全不驗證呼叫方是否持有對應的 `token`。  
攻擊者若透過任何手段得知合約的 `id`（例如從網路封包、錯誤回應、或 IDOR 掃描），即可不持有 token 直接簽署任意合約。

**修復方式**：
1. Sign endpoint 改為 `findFirst({ where: { id, token } })`，必須同時匹配 id 與 token 才能操作。
2. 前端 `ContractSigner` 元件新增 `contractToken` prop，從 URL token 傳入，每次簽署請求都在 body 帶上 `token`。
3. `app/contract/[token]/page.tsx` 傳遞 `contractToken={contract.token}` 給 `ContractSigner`。
4. 額外補強：簽署時一併檢查 `expiresAt` 是否已過期，並自動將狀態更新為 `EXPIRED`。

---

### 🟠 漏洞 2（中危）— `/api/grooming` POST

**檔案**：`app/api/grooming/route.ts`

**問題描述**：  
新增美容紀錄時，直接使用 request body 傳入的 `petId` 建立資料，未驗證該 pet 是否屬於登入者的 `shopId`。  
攻擊者（已登入 A 店）可構造請求帶入 B 店的 `petId`，為 B 店的寵物建立美容紀錄，污染跨店資料。

**修復方式**：  
在 `create` 前新增：
```typescript
const pet = await prisma.pet.findFirst({
  where: { id: body.petId, shopId, isActive: true },
  include: { customer: true },
})
if (!pet) return NextResponse.json({ error: "Pet not found" }, { status: 404 })
```
並移除後續重複的 `prisma.pet.findUnique`，改用已驗證的 `pet` 物件。

---

### 🟠 漏洞 3（中危）— `/api/boarding` POST（雙重問題）

**檔案**：`app/api/boarding/route.ts`

**問題描述（共 2 個子問題）**：

**3a. petId 未驗證所屬**：同漏洞 2，`body.petId` 未確認屬於本店。  
**3b. roomId 更新缺 shopId 防護**：
```typescript
// 原始（有漏洞）
await prisma.boardingRoom.update({
  where: { id: body.roomId },  // ← 無 shopId，任意 roomId 都可被改狀態
  data: { status: "OCCUPIED" },
})
```
攻擊者可在建立住宿時帶入 B 店的 `roomId`，導致 B 店的房間狀態被竄改為 OCCUPIED。

**修復方式**：
```typescript
// 3a: 驗證 pet
const pet = await prisma.pet.findFirst({ where: { id: body.petId, shopId } })
if (!pet) return 404

// 3b: 驗證 room
const room = await prisma.boardingRoom.findFirst({ where: { id: body.roomId, shopId } })
if (!room) return 404

// 3b: 使用 updateMany 帶 shopId
await prisma.boardingRoom.updateMany({
  where: { id: body.roomId, shopId },
  data: { status: "OCCUPIED" },
})
```

---

## 三、原本就正確的路由（共 14 個）

以下路由在稽核前已正確實作多店家隔離，**無需修改**：

| 路由 | 隔離機制 |
|------|---------|
| `GET /api/customers` | `where: { shopId }` |
| `POST /api/customers` | `shopId` 強制來自 session |
| `GET/PATCH/DELETE /api/customers/[id]` | `where: { id, shopId }` 或 `updateMany/deleteMany` |
| `POST /api/pets` | 先驗證 customer 屬於 shopId，再 create |
| `GET/PATCH/DELETE /api/pets/[id]` | `where: { id, shopId }` |
| `GET /api/pets/all` | `where: { shopId }` |
| `GET /api/grooming` | `where: { shopId }` |
| `GET/POST /api/appointments` | `where: { shopId }` |
| `PATCH/DELETE /api/appointments/[id]` | `updateMany/deleteMany { id, shopId }` |
| `GET /api/boarding` | `where: { shopId }` |
| `PATCH /api/boarding/[id]` | `findFirst({ id, shopId })` 先驗證再 update |
| `GET/POST /api/services` | `where: { shopId }` |
| `GET/POST /api/rooms` | `where: { shopId }` |
| `GET /api/staff` | `where: { shopId }` |
| `GET /api/dashboard` | 所有查詢都帶 `shopId` |
| `PATCH /api/shops/[shopId]` | 明確比對 `shopId !== session.user.shopId → 403` |

---

## 四、新增基礎設施

### `lib/auth-guard.ts`
提供三個可複用的守衛工具，供後續新 API 路由使用：

```typescript
requireAuth()                    // 取得 session，未登入回傳 401
requireRole(roles: string[])     // requireAuth + 角色檢查，不符回傳 403
assertShopOwnership(a, b)        // 比對兩個 shopId，不符回傳 NextResponse 403
```

---

## 五、自動化測試結果

**測試檔案**：`tests/security/multi-tenant-isolation.test.ts`  
**框架**：vitest v4.1.5  
**執行指令**：`npm test`

| # | 測試案例 | 結果 |
|---|---------|------|
| TC-01 | A 店讀取 B 店客人 → null | ✅ |
| TC-02 | A 店更新 B 店客人 → 0 筆受影響 | ✅ |
| TC-03 | A 店刪除 B 店客人 → 0 筆受影響 | ✅ |
| TC-04 | A 店讀取 B 店寵物 → null | ✅ |
| TC-05 | A 店軟刪除 B 店寵物 → 0 筆受影響 | ✅ |
| TC-06 | A 店用 B 店 petId 建美容紀錄 → 攔截 null | ✅ |
| TC-07 | A 店用 B 店 petId 建住宿紀錄 → 攔截 null | ✅ |
| TC-08 | 用 contractId 但錯誤 token 簽署 → null | ✅ |
| TC-09 | 正確 contractId + 正確 token → 正向通過 | ✅ |
| TC-10 | 簽署已簽署合約 → 狀態為 SIGNED，應被拒絕 | ✅ |
| TC-11 | A 店讀預約清單 → 不含 B 店資料 | ✅ |
| TC-12 | A 店更新 B 店預約 → 0 筆受影響 | ✅ |
| TC-13 | A 店刪除 B 店預約 → 0 筆受影響 | ✅ |
| TC-14 | A 店用 B 店 roomId 建住宿 → 攔截 null | ✅ |
| TC-15 | A 店更新 B 店房間狀態 → 0 筆受影響 | ✅ |
| TC-16 | A 店修改 B 店設定 → shopId 不符應回傳 403 | ✅ |
| TC-17 | A 店員工清單 → 不含 B 店員工 | ✅ |
| TC-18 | A 店服務清單 → 不含 B 店服務 | ✅ |

**總計：18 / 18 通過，Duration 520ms**

---

## 六、結論

| 項目 | 結果 |
|------|------|
| 稽核 API 路由數 | 17 個 |
| 發現漏洞數 | 3 個（含子問題共 4 處） |
| 修復漏洞數 | 3 個（全部完成） |
| 所有路由加上 SECURITY 稽核註解 | ✅ |
| `npm test` 全部通過 | ✅ 18/18 |

**結論：多店家資料隔離稽核通過，可進入 Phase 0 下一步。**

---

*報告產出：美金 / 待黃金確認後解除 Phase 0 鎖定*
