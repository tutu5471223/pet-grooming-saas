import { chromium } from "playwright"

const BASE = "http://localhost:3000"
const SHOP_ID = "Tutu123456"
const EMAIL = "tutu5471223@gmail.com"
const PASSWORD = "Tutu880223"

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()

  // Login
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle", timeout: 20000 })
  await page.locator("#shopId").fill(SHOP_ID)
  await page.locator("#email").fill(EMAIL)
  await page.locator("#password").fill(PASSWORD)
  await page.locator('button[type="submit"]').click()
  await page.waitForURL(`${BASE}/dashboard`, { timeout: 15000 })
  console.log("✅ Logged in")

  // ── 1. 客人詳情頁 ──────────────────────────────────────────────
  console.log("\n=== 客人詳情頁 ===")
  await page.goto(`${BASE}/customers`, { waitUntil: "networkidle", timeout: 15000 })
  const links = await page.locator("a[href*='/customers/c']").all()
  console.log(`  Found ${links.length} customer links`)
  if (links.length > 0) {
    const href = await links[0].getAttribute("href")
    console.log(`  Clicking: ${href}`)
    await links[0].click()
    await page.waitForLoadState("networkidle", { timeout: 10000 })
    console.log(`  URL after click: ${page.url()}`)
    const body = await page.textContent("body")
    console.log(`  Has 小白: ${body?.includes("小白")} Has 寵物: ${body?.includes("寵物")}`)
    console.log(`  Body excerpt: ${body?.slice(0, 200)}`)
  }

  // ── 2. 預約列表 ──────────────────────────────────────────────
  console.log("\n=== 預約列表 ===")
  await page.goto(`${BASE}/appointments`, { waitUntil: "networkidle", timeout: 15000 })
  const apptBody = await page.textContent("body")
  console.log(`  Has 待確認: ${apptBody?.includes("待確認")}`)
  console.log(`  Has 小白: ${apptBody?.includes("小白")}`)
  console.log(`  Has 預約: ${apptBody?.includes("預約")}`)
  // Check what's actually shown
  const h1 = await page.locator("h1, h2, h3").allTextContents()
  console.log(`  Headings: ${JSON.stringify(h1)}`)
  // Look for any data rows
  const rows = await page.locator("tr, [class*='row'], [class*='card']").count()
  console.log(`  Table rows/cards: ${rows}`)
  console.log(`  Body excerpt: ${apptBody?.slice(100, 400)}`)

  // ── 3. 自助預約填寫 ──────────────────────────────────────────
  console.log("\n=== 自助預約 ===")
  await page.goto(`${BASE}/booking/${SHOP_ID}`, { waitUntil: "networkidle", timeout: 10000 })
  const bookBody = await page.textContent("body")
  console.log(`  Body excerpt: ${bookBody?.slice(0, 400)}`)
  const inputs = await page.locator("input").all()
  for (const inp of inputs.slice(0, 6)) {
    const name = await inp.getAttribute("name")
    const placeholder = await inp.getAttribute("placeholder")
    const type = await inp.getAttribute("type")
    console.log(`  Input: name=${name} placeholder=${placeholder} type=${type}`)
  }

  // ── 4. Cron reminder 500 ────────────────────────────────────
  console.log("\n=== Cron Reminder ===")
  const r1 = await page.evaluate(async () => {
    try {
      const res = await fetch("/api/cron/reminder")
      const text = await res.text()
      return { status: res.status, body: text.slice(0, 500) }
    } catch (e: any) { return { error: e.message } }
  })
  console.log("  /api/cron/reminder:", JSON.stringify(r1))

  const r2 = await page.evaluate(async () => {
    try {
      const res = await fetch("/api/cron/appointment-reminder")
      const text = await res.text()
      return { status: res.status, body: text.slice(0, 500) }
    } catch (e: any) { return { error: e.message } }
  })
  console.log("  /api/cron/appointment-reminder:", JSON.stringify(r2))

  await browser.close()
}

main().catch(console.error)
