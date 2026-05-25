import { PrismaLibSql } from "@prisma/adapter-libsql"
import path from "path"
import { PrismaClient } from "../app/generated/prisma/client.js"

const adapter = new PrismaLibSql({ url: "file:" + path.join(process.cwd(), "dev.db") })
const prisma = new PrismaClient({ adapter } as any)

async function main() {
  const shops = await prisma.shop.findMany({ select: { id: true, name: true }, take: 2 })
  const users = await prisma.user.findMany({ where: { role: "OWNER" }, select: { id: true, email: true, shopId: true }, take: 2 })
  const pets = await prisma.pet.findMany({ where: { isActive: true }, select: { id: true, name: true }, take: 2 })
  console.log(JSON.stringify({ shops, users, pets }, null, 2))
}
main().catch(console.error)
