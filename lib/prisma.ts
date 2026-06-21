import { PrismaClient } from "@/app/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

// Build the pg SSL config. Verifies the server certificate by default
// (rejectUnauthorized: true) — disabling verification exposes the DB
// connection to MITM. Provide a custom CA via DATABASE_CA_CERT (PEM) when the
// provider uses a private CA not in the system trust store.
// DATABASE_SSL_INSECURE=true is a last-resort escape hatch only.
function buildSsl(url: string): false | { rejectUnauthorized: boolean; ca?: string } {
  const isLocal =
    url.includes("localhost") || url.includes("127.0.0.1") || url.startsWith("file:")
  if (isLocal) return false
  if (process.env.DATABASE_SSL_INSECURE === "true") {
    console.warn("[prisma] DATABASE_SSL_INSECURE=true — TLS certificate verification DISABLED")
    return { rejectUnauthorized: false }
  }
  const ca = process.env.DATABASE_CA_CERT
  return ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized: true }
}

function createPrisma() {
  const url = process.env.DATABASE_URL!
  const pool = new Pool({
    connectionString: url,
    ssl: buildSsl(url),
  })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter } as any)
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? createPrisma()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
