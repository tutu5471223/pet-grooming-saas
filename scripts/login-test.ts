import { chromium } from "playwright"

async function main() {
  const b = await chromium.launch({ headless: true })
  const p = await b.newPage()
  try {
    console.log("Going to login page...")
    await p.goto("http://localhost:3000/login", { timeout: 30000 })
    const body = await p.textContent("body")
    console.log("Login page content:", body?.slice(0, 300))
    console.log("URL:", p.url())

    const shopField = await p.locator("#shopId").isVisible().catch(() => false)
    console.log("Has #shopId:", shopField)

    if (shopField) {
      await p.locator("#shopId").fill("Tutu123456")
      await p.locator("#email").fill("tutu5471223@gmail.com")
      await p.locator("#password").fill("Tutu880223")
      await p.locator('button[type="submit"]').click()

      await p.waitForTimeout(8000)
      console.log("After submit URL:", p.url())
      const afterBody = await p.textContent("body")
      console.log("After submit body:", afterBody?.slice(0, 200))
    }
  } catch (e: any) {
    console.error("Error:", e.message)
  } finally {
    await b.close()
  }
}
main()
