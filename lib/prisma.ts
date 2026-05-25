import { PrismaClient } from "@/app/generated/prisma/client"
import { PrismaLibSql } from "@prisma/adapter-libsql"
import path from "path"

function createPrisma() {
  const dbPath = process.env.DATABASE_URL ?? "file:./prisma/dev.db"
  const url = dbPath.startsWith("file:./")
    ? `file:${path.join(process.cwd(), dbPath.replace("file:./", ""))}`
    : dbPath
  const adapter = new PrismaLibSql({ url })
  return new PrismaClient({ adapter } as any)
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? createPrisma()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
