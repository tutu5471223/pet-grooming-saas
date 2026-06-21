import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { PrismaClient } from "../app/generated/prisma/client.js"

const url = process.env.DATABASE_URL!
const isLocal = url.includes("localhost") || url.includes("127.0.0.1") || url.startsWith("file:")
const pool = new Pool({ connectionString: url, ssl: isLocal ? undefined : { rejectUnauthorized: false } })
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
