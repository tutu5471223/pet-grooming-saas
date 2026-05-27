import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { PrismaClient } from "../app/generated/prisma/client.js"

async function main() {
  const url = process.env.DATABASE_URL!
  const isLocal = url.includes("localhost") || url.includes("127.0.0.1") || url.startsWith("file:")
  const pool = new Pool({ connectionString: url, ssl: isLocal ? undefined : { rejectUnauthorized: false } })
  const adapter = new PrismaPg(pool)
  const prisma = new PrismaClient({ adapter } as any)

  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, shopId: true, isSuperAdmin: true }, take: 5 })
  console.log("Users:", JSON.stringify(users, null, 2))

  const shops = await prisma.shop.findMany({ select: { id: true, name: true, status: true, onboardingDone: true }, take: 5 })
  console.log("Shops:", JSON.stringify(shops, null, 2))
}

main().catch(console.error).finally(() => process.exit(0))
