import { PrismaLibSql } from "@prisma/adapter-libsql"
import { PrismaClient } from "../app/generated/prisma/client.js"
import path from "path"

async function main() {
  const adapter = new PrismaLibSql({ url: "file:" + path.join(process.cwd(), "dev.db") })
  const prisma = new PrismaClient({ adapter } as any)

  // Query all users (never read or compare raw passwords here — only confirm one is set).
  const users = await prisma.user.findMany({
    select: { id: true, email: true, name: true, role: true, shopId: true, isSuperAdmin: true, password: true },
    orderBy: { createdAt: "asc" },
    take: 5,
  })
  console.log("=== Users ===")
  for (const u of users) {
    console.log({ email: u.email, name: u.name, shopId: u.shopId, isSuperAdmin: u.isSuperAdmin, hasPassword: !!u.password })
  }

  // Query shops
  const shops = await prisma.shop.findMany({
    select: { id: true, name: true, status: true },
    where: { id: { not: "system" } },
  })
  console.log("\n=== Shops ===")
  console.log(shops)

  await prisma.$disconnect()
}
main().catch(console.error)
