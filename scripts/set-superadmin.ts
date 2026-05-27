import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { PrismaClient } from "../app/generated/prisma/client.js"

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter } as any)

async function main() {
  const first = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } })
  if (!first) { console.log("No users found"); return }

  await prisma.user.update({ where: { id: first.id }, data: { isSuperAdmin: true } })
  console.log(`✅ Set isSuperAdmin=true for: ${first.name} (${first.email}) @ shop ${first.shopId}`)
}

main().catch(console.error).finally(() => process.exit(0))
