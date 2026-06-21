import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { writeAudit } from "@/lib/audit"

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Staff CRUD => OWNER only.
  const guard = await requireRole(["OWNER"])
  if (!guard.ok) return guard.response

  const { shopId, userId } = guard.ctx
  const { id } = await params

  if (id === userId) {
    return NextResponse.json({ error: "無法停用自己的帳號" }, { status: 400 })
  }

  try {
    // SECURITY: Verify staff belongs to this shop. Atomically toggle scoped by
    // { id, shopId } so a cross-shop id can never be flipped.
    const staff = await prisma.user.findFirst({
      where: { id, shopId },
      select: { id: true, isActive: true, role: true },
    })
    if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 })

    const result = await prisma.user.updateMany({
      where: { id, shopId },
      data: { isActive: !staff.isActive },
    })
    if (result.count !== 1) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 })
    }

    await writeAudit({
      shopId,
      userId,
      action: staff.isActive ? "staff.deactivate" : "staff.activate",
      resource: "user",
      resourceId: id,
    })

    return NextResponse.json({ id, isActive: !staff.isActive })
  } catch (error) {
    console.error("PATCH /api/staff/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
