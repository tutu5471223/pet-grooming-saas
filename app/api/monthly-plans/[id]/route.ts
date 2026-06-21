import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Deleting a plan template is a financial-config action → OWNER-only.
  const guard = await requireRole(["OWNER"])
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx
  const { id } = await params

  try {
    const inUse = await prisma.customer.count({ where: { monthlyPlanId: id, shopId } })
    if (inUse > 0) {
      return NextResponse.json(
        { error: `尚有 ${inUse} 位客人使用此方案，請先解除綁定再刪除` },
        { status: 409 }
      )
    }

    await prisma.monthlyPlan.deleteMany({ where: { id, shopId } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("DELETE /api/monthly-plans/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
