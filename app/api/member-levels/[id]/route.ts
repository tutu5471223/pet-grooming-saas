// SECURITY: 已通過多店家隔離稽核 (2026-05-04)
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/auth-guard"
import { readJson, shortText, longText, nonNegInt, z } from "@/lib/validation"

const patchSchema = z.object({
  name: shortText.min(1).optional(),
  minPoints: nonNegInt.optional(),
  discountRate: z.number().finite().min(0).max(1).optional(),
  benefits: longText.nullish(),
  color: shortText.optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(["OWNER"])
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  const { id } = await params

  try {
    const parsed = await readJson(req, patchSchema)
    if (!parsed.ok) return parsed.response
    const body = parsed.data

    const level = await prisma.memberLevel.updateMany({
      where: { id, shopId },
      data: {
        name: body.name ?? undefined,
        minPoints: body.minPoints !== undefined ? body.minPoints : undefined,
        discountRate: body.discountRate !== undefined ? body.discountRate : undefined,
        benefits: body.benefits !== undefined ? (body.benefits || null) : undefined,
        color: body.color ?? undefined,
      },
    })
    return NextResponse.json(level)
  } catch (error) {
    console.error("PATCH /api/member-levels/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(["OWNER"])
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  try {
    const { id } = await params
    await prisma.memberLevel.deleteMany({ where: { id, shopId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/member-levels/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
