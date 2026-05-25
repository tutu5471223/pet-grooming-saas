import { PrismaLibSql } from "@prisma/adapter-libsql"
import path from "path"
import { PrismaClient } from "../app/generated/prisma/client.js"

async function main() {
  const adapter = new PrismaLibSql({ url: "file:" + path.join(process.cwd(), "dev.db") })
  const prisma = new PrismaClient({ adapter } as any)
  const pets = await prisma.pet.findMany({ where: { isActive: true }, select: { id: true, name: true, customerId: true }, take: 3 })
  console.log(JSON.stringify(pets, null, 2))
}
main().catch(e => console.error(e.message))
