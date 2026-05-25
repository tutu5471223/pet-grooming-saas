// SECURITY: 已通過多店家隔離稽核 (2026-05-04)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "OWNER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const shopId = session.user.shopId
  const { searchParams } = new URL(req.url)
  const resource = searchParams.get("resource")
  const userId = searchParams.get("userId")

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
