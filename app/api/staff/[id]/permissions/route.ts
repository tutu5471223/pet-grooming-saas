import { NextRequest, NextResponse } from "next/server"
import { requireRole } from "@/lib/auth-guard"
import { prisma } from "@/lib/prisma"
import { readJson, z } from "@/lib/validation"
import { writeAudit } from "@/lib/audit"

const permissionsSchema = z.object({
  reports: z.boolean().optional(),
  expenses: z.boolean().optional(),
  void: z.boolean().optional(),
  refund: z.boolean().optional(),
  settings: z.boolean().optional(),
  staff: z.boolean().optional(),
})

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole(["OWNER"])
  if (!guard.ok) return guard.response
  const { shopId, userId } = guard.ctx
  const { id } = await params

  const parsed = await readJson(req, permissionsSchema)
  if (!parsed.ok) return parsed.response

  const permissions = {
    reports: parsed.data.reports ?? false,
    expenses: parsed.data.expenses ?? false,
    void: parsed.data.void ?? false,
    refund: parsed.data.refund ?? false,
    settings: parsed.data.settings ?? false,
    staff: parsed.data.staff ?? false,
  }

  try {
    // Only allow updating non-OWNER staff within this shop
    const staff = await prisma.user.findFirst({
      where: { id, shopId, role: { not: "OWNER" } },
    })
    if (!staff) return NextResponse.json({ error: "Staff not found" }, { status: 404 })

    await prisma.user.update({
      where: { id },
      data: { permissions },
    })

    await writeAudit({
      shopId,
      userId,
      action: "staff.permissions.update",
      resource: "user",
      resourceId: id,
      detail: { permissions },
    })

    return NextResponse.json({ success: true, permissions })
  } catch (error) {
    console.error("PUT /api/staff/[id]/permissions", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
