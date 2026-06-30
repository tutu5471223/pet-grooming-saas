import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth, requireRole } from "@/lib/auth-guard"
import { writeAudit } from "@/lib/audit"
import { readJson, money, longText, z } from "@/lib/validation"
import { round2 } from "@/lib/money"

// Non-strict schema: validate types/bounds of known fields, allow extra keys.
const updateSchema = z.object({
  groomerId: z.string().min(1).optional().nullable(),
  services: z.array(z.unknown()).optional(),
  products: z.string().optional().nullable(),
  totalCost: money.optional(),
  skinCondition: longText.optional().nullable(),
  furCondition: longText.optional().nullable(),
  notes: longText.optional().nullable(),
  date: z.string().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response

  const shopId = guard.ctx.shopId
  const { id } = await params

  const parsed = await readJson(req, updateSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  try {
    const record = await prisma.groomingRecord.findFirst({ where: { id, shopId } })
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

    // SECURITY: Verify groomer (a User) belongs to this shop before storing.
    let groomerId = record.groomerId
    if (body.groomerId !== undefined) {
      groomerId = body.groomerId || null
      if (groomerId) {
        const groomer = await prisma.user.findFirst({ where: { id: groomerId, shopId } })
        if (!groomer) return NextResponse.json({ error: "Groomer not found" }, { status: 404 })
      }
    }

    const totalCost =
      body.totalCost !== undefined ? round2(body.totalCost) : record.totalCost

    const updated = await prisma.groomingRecord.update({
      where: { id },
      data: {
        groomerId,
        services: body.services !== undefined ? JSON.stringify(body.services) : record.services,
        products: body.products !== undefined ? (body.products || null) : record.products,
        totalCost,
        skinCondition: body.skinCondition !== undefined ? (body.skinCondition || null) : record.skinCondition,
        furCondition: body.furCondition !== undefined ? (body.furCondition || null) : record.furCondition,
        notes: body.notes !== undefined ? (body.notes || null) : record.notes,
        date: body.date ? new Date(body.date) : record.date,
      },
    })

    if (body.totalCost !== undefined) {
      await prisma.payment.updateMany({
        where: { groomingRecordId: id, shopId, status: "PENDING" },
        data: { amount: totalCost },
      })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error("PATCH /api/grooming/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // M3: deleting a grooming record can drop its associated payment → OWNER-only.
  const guard = await requireRole(["OWNER"])
  if (!guard.ok) return guard.response

  const shopId = guard.ctx.shopId
  const userId = guard.ctx.userId
  const { id } = await params

  try {
    const record = await prisma.groomingRecord.findFirst({
      where: { id, shopId },
      include: { payment: true },
    })
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

    // M3: a settled (PAID) payment must NOT be silently destroyed. The old code
    // ran tx.payment.delete() unconditionally — for a CREDIT/stored-value payment
    // that swallows the customer's money with no refund trail. Require an explicit
    // refund first; only non-PAID (PENDING) payments may be removed with the record.
    if (record.payment && record.payment.status === "PAID") {
      return NextResponse.json(
        { error: "此美容紀錄已付款，請先辦理退款再刪除", code: "PAYMENT_PAID" },
        { status: 409 }
      )
    }

    await prisma.$transaction(async (tx) => {
      if (record.payment) {
        // Only reaches here when status !== "PAID" (PENDING / etc.) → safe to delete.
        await tx.payment.deleteMany({
          where: { id: record.payment.id, status: { not: "PAID" } },
        })
      }
      await tx.groomingRecord.delete({ where: { id } })
    })

    await writeAudit({
      shopId,
      userId,
      action: "DELETE_GROOMING",
      resource: "GroomingRecord",
      resourceId: id,
      detail: { petId: record.petId, hadPayment: !!record.payment },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/grooming/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
