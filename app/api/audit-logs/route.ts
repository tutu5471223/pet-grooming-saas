// SECURITY: 已通過多店家隔離稽核 (2026-05-04)
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/auth-guard"

export async function GET(req: NextRequest) {
  const guard = await requireRole(["OWNER"])
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  const { searchParams } = new URL(req.url)
  const resource = searchParams.get("resource")?.slice(0, 100) || null
  const userId = searchParams.get("userId")?.slice(0, 100) || null

  try {
    const logs = await prisma.auditLog.findMany({
      where: {
        shopId,
        ...(resource ? { resource } : {}),
        ...(userId ? { userId } : {}),
      },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    })

    return NextResponse.json(logs)
  } catch (error) {
    console.error("GET /api/audit-logs", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
