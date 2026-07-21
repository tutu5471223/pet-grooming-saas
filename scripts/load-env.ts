/**
 * 供 scripts/ 下的一次性腳本使用的環境變數載入器（零依賴）。
 *
 * 為什麼不用 dotenv：
 *   1. dotenv 不是本專案的直接依賴（只是 prisma 帶進來的 transitive 套件），
 *      哪天 prisma 換掉就會無聲壞掉。
 *   2. dotenv/config 只讀 `.env`，但正式機（VPS）的變數放在 `.env.production`
 *      —— pm2 跑的是 `npm start`，由 Next.js 自行載入該檔，所以機器上沒有 `.env`。
 *
 * 這裡沿用 Next.js 的檔案優先序：先載入者優先，已存在的變數不覆蓋
 * （因此真正的環境變數 > .env.production.local > .env.production > ... ）。
 *
 * 用法（必須放在 import prisma 之前，因為 lib/prisma 在模組載入當下就會建立連線池）：
 *   import "./load-env"
 *   import { prisma } from "../lib/prisma"
 */
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const ROOT = resolve(__dirname, "..")
const FILES = [".env.production.local", ".env.production", ".env.local", ".env"]

const loaded: string[] = []

for (const file of FILES) {
  const path = resolve(ROOT, file)
  if (!existsSync(path)) continue
  loaded.push(file)

  for (const rawLine of readFileSync(path, "utf8").split("\n")) {
    const line = rawLine.trim()
    if (!line || line.startsWith("#")) continue

    const eq = line.indexOf("=")
    if (eq === -1) continue

    const key = line.slice(0, eq).trim().replace(/^export\s+/, "")
    if (!key || process.env[key] !== undefined) continue

    let value = line.slice(eq + 1).trim()
    // 去掉成對的引號（單引號內不做跳脫還原，與 dotenv 行為一致）
    if (value.length >= 2 && value[0] === value[value.length - 1] && (value[0] === '"' || value[0] === "'")) {
      value = value.slice(1, -1)
      if (rawLine.includes('"')) value = value.replace(/\\n/g, "\n")
    }
    process.env[key] = value
  }
}

export const loadedEnvFiles = loaded

if (!process.env.DATABASE_URL) {
  console.error("✗ 找不到 DATABASE_URL")
  console.error(`  搜尋目錄：${ROOT}`)
  console.error(`  已嘗試：${FILES.join(" / ")}`)
  console.error(`  實際載入：${loaded.length ? loaded.join(", ") : "（無）"}`)
  process.exit(1)
}
