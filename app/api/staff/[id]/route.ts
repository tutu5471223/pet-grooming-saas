import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole(["OWNER"])
  if (!guard.ok) return guard.response

  const { shopId, userId } = guard.ctx
  const { id } = await params

  if (id === userId) {
    return NextResponse.json({ error: "無法停用自己的帳號" }, { status: 400 })
  }

  try {
    // SECURITY: Verify staff belongs to this shop
    const staff = await prisma.user.findFirst({
      where: { id, shopId },
      select: { id: true, isActive: true },
    })
    if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 })

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: !staff.isActive },
      select: { id: true, isActive: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("PATCH /api/staff/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
