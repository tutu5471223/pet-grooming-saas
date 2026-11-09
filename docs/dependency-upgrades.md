# 套件升級狀態（2026-11）

## 本次已處理

- `npm audit fix`（未加 `--force`）：漏洞 45 → 14（critical 4 → 0）。`next` 由 16.2.9 升至 16.4.5，連帶修掉 `next`、`next-auth`/`@auth/core`（Auth.js 本身的 3 個 advisory）、`dompurify`、`postcss`、`sharp`、`zod`、`brace-expansion`、`vite` 等。
- `npm update --save` + 手動調整釘版：所有直接依賴升到同一 major 內的最新 minor/patch。重點：`@prisma/client` / adapter 7.8.0 → 7.10.1（與 `prisma` CLI 7.10.1 對齊）、`react`/`react-dom` 19.2.4 → 19.3.1、`zod` 4.6.7、`vitest` 4.1.12。
- 剩餘漏洞：11 個（3 high、8 moderate），全部需要 major 升級才能修，見下表。

## 需要 major 升級（未動）

| 套件 | 目前 | 最新 | 對應漏洞 | 風險 / 備註 |
|---|---|---|---|---|
| `nodemailer` | 7.0.13 | 10.4.0 | **high** ×多（SMTP 指令注入、addressparser 解析錯誤、DoS 等） | 跨 3 個 major，API 有變動。本專案只在 `lib/email.ts` 寄信，收件者都是店家／超管 email，攻擊面小，但仍建議優先處理。`next-auth`/`@auth/core` 的 high 也是因為它們的 peer 依賴 nodemailer 被連帶標記，nodemailer 升級後會一起消失。 |
| `next-auth` | 5.0.0-beta.32 | （npm `latest` 標籤是 4.24.15） | 連帶 nodemailer | v5 仍是 beta、沒有正式版；`latest` 指向 v4 是降級，**不要照 `npm outdated` 升**。持續跟 v5 beta 即可。 |
| `eslint-config-next` 鏈（`typescript-eslint`、`minimatch`） | 16.4.5 | — | moderate（ReDoS 類，只影響開發時 lint） | `npm audit fix --force` 建議的是**降級**到 15.5.29，不可採用。等 `eslint-config-next` 16.x 更新相依即可。 |
| `prisma` / `@prisma/client` | 7.10.1 | 8.0.0-rc | — | 8 還是 RC。正式版出來後再評估，需重新測 migration 與 adapter。 |
| `typescript` | 5.9.3 | 7.0.2 | — | TS 7 是 Go 重寫版，需確認 Next 16 與 eslint 生態支援。 |
| `eslint` | 9.39.5 | 10.14.0 | — | 需等 `eslint-config-next` 支援 flat config v10。 |
| `vitest` / `@vitest/coverage-v8` | 4.1.12 | 5.1.0 | — | 測試工具，風險低，可單獨升。 |
| `@anthropic-ai/sdk` | 0.93.0 | 1.6.0 | — | OCR 功能使用。1.0 有 API 變動，需改 `app/api/ocr*`。 |
| `@hookform/resolvers` | 5.9.2 | 7.0.5 | — | 需確認與 zod 4、react-hook-form 7.9x 的相容性。 |
| `@libsql/client` | 0.17.4 | 0.18.0 | — | 0.x 的 minor 等同 major。正式環境用 Postgres，libsql 只是本機備用。 |
| `nanoid` | 5.1.16 | 6.0.2 | — | 只用在上傳檔名，風險低。 |
| `@types/node` | 20.x | 26.x | — | 應跟著 VPS 的 Node 版本走。 |

## Node 版本

- `@prisma/streams-local`（`prisma` → `@prisma/dev` 的相依）要求 Node ≥ 22，在 Node 20 上 `npm install` 會出現 `EBADENGINE` 警告。
- 它只供本機 `prisma dev`（內建 Postgres）使用；正式機用到的 `prisma generate`、`prisma migrate deploy` 與執行期（`@prisma/client` + `@prisma/adapter-pg`）都不會載入它。專案沒有開 `engine-strict`，所以**只是警告，不影響部署**。
- `prisma` 7.10 本身支援 `^20.19 || ^22.12 || >=24`，`next` 16.4 需要 `>=20.9`。
- **但 Node 20 已於 2026-04-30 結束維護（EOL）**，不再有安全更新。建議排時間把 VPS 升到 Node 22 或 24 LTS（本機開發已用 24.15），屆時一併把 `.node-version`、`@types/node` 調整。
