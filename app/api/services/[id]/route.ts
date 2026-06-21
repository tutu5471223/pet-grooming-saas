// SECURITY: 已通過多店家隔離稽核 (2026-05-04)
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-guard"
import { readJson, money, shortText, longText, positiveInt, z } from "@/lib/validation"
import { round2 } from "@/lib/money"

const patchSchema = z.object({
  name: shortText.min(1).optional(),
  category: shortText.nullish(),
  price: money.optional(),
  duration: positiveInt.nullish(),
  isActive: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  try {
    const { id } = await params
    const parsed = await readJson(req, patchSchema)
    if (!parsed.ok) return parsed.response
    const body = parsed.data

    const service = await prisma.service.updateMany({
      where: { id, shopId },
      data: {
        name: body.name ?? undefined,
        category: body.category !== undefined ? (body.category || null) : undefined,
        price: body.price !== undefined ? round2(body.price) : undefined,
        duration: body.duration !== undefined ? (body.duration ?? null) : undefined,
        isActive: body.isActive !== undefined ? body.isActive : undefined,
      },
    })
    return NextResponse.json(service)
  } catch (error) {
    console.error("PATCH /api/services/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  try {
    const { id } = await params
    await prisma.service.updateMany({
      where: { id, shopId },
      data: { isActive: false },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/services/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
