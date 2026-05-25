import { prisma } from "@/lib/prisma"

export async function writeAudit(opts: {
  shopId: string
  userId?: string | null
  action: string
  resource: string
  resourceId?: string | null
  detail?: object | null
}) {
  try {
    await prisma.auditLog.create({
      data: {
        shopId: opts.shopId,
        userId: opts.userId ?? null,
        action: opts.action,
        resource: opts.resource,
        resourceId: opts.resourceId ?? null,
        detail: opts.detail ? JSON.stringify(opts.detail) : null,
      },
    })
  } catch {
    // Audit failures must never break the main flow
  }
}
