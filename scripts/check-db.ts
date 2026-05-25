import { PrismaLibSql } from "@prisma/adapter-libsql"
import path from "path"
import { PrismaClient } from "../app/generated/prisma/client.js"

async function main() {
  const adapter = new PrismaLibSql({ url: "file:" + path.join(process.cwd(), "dev.db") })
  const prisma = new PrismaClient({ adapter } as any)

  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true, shopId: true, isSuperAdmin: true }, take: 5 })
  console.log("Users:", JSON.stringify(users, null, 2))

  const shops = await prisma.shop.findMany({ select: { id: true, name: true, status: true, onboardingDone: true }, take: 5 })
  console.log("Shops:", JSON.stringify(shops, null, 2))
}

main().catch(console.error).finally(() => process.exit(0))
