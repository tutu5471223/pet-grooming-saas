import { PrismaClient } from "../app/generated/prisma"

const prisma = new PrismaClient()

async function main() {
  const shop = await prisma.shop.update({
    where: { id: "Tutu123456" },
    data: { name: "毛毛寵物美容" },
    select: { id: true, name: true },
  })
  console.log("Updated shop:", shop)
}

main().finally(() => prisma.$disconnect())
