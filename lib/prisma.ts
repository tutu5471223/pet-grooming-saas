import { PrismaClient } from "@/app/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

function createPrisma() {
  const url = process.env.DATABASE_URL!
  const isLocal = url.includes("localhost") || url.includes("127.0.0.1") || url.startsWith("file:")
  const pool = new Pool({
    connectionString: url,
    ssl: isLocal ? undefined : { rejectUnauthorized: false },
  })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter } as any)
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? createPrisma()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
