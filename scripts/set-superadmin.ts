import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { PrismaClient } from "../app/generated/prisma/client.js"

const url = process.env.DATABASE_URL!
const isLocal = url.includes("localhost") || url.includes("127.0.0.1") || url.startsWith("file:")

// SEC: granting platform-superadmin is a high-privilege action. Require an
// explicit opt-in before touching a production DB so it can't happen by accident.
const isRenderProd = url.includes("render.com") || url.includes(".internal")
if ((isRenderProd || process.env.NODE_ENV === "production") && process.env.ALLOW_PROD_SUPERADMIN !== "true") {
  console.error("⚠️ 偵測到正式環境 DB：授予平台超管是高權限操作。")
  console.error("   若確定要在此環境執行，請設定 ALLOW_PROD_SUPERADMIN=true 後重試。")
  console.error("   例如：ALLOW_PROD_SUPERADMIN=true tsx scripts/set-superadmin.ts <email> [shopId]")
  process.exit(1)
}

// SEC: verify TLS cert for remote DBs (consistent with lib/prisma.ts buildSsl).
const caCert = process.env.DATABASE_CA_CERT
const pool = new Pool({
  connectionString: url,
  ssl: isLocal ? undefined : caCert ? { rejectUnauthorized: true, ca: caCert } : { rejectUnauthorized: true },
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter } as any)

async function main() {
  // SEC-2: never blindly promote "the first user". Require an explicit email
  // (and optional shopId) so granting platform-superadmin is always deliberate.
  const email = process.argv[2]
  const shopId = process.argv[3]
  if (!email) {
    console.error("用法: tsx scripts/set-superadmin.ts <email> [shopId]")
    process.exit(1)
  }

  const user = await prisma.user.findFirst({
    where: { email, ...(shopId ? { shopId } : {}) },
  })
  if (!user) {
    console.error(`找不到使用者: ${email}${shopId ? ` @ ${shopId}` : ""}`)
    process.exit(1)
  }

  await prisma.user.update({ where: { id: user.id }, data: { isSuperAdmin: true } })
  console.log(`✅ Set isSuperAdmin=true for: ${user.name} (${user.email}) @ shop ${user.shopId}`)
}

main().catch(console.error).finally(() => process.exit(0))
