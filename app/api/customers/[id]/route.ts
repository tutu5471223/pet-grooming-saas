// SECURITY: 已通過多店家隔離稽核 (2026-05-03)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { writeAudit } from "@/lib/audit"
import { requireRole } from "@/lib/auth-guard"
import { readJson, z, shortText, phone } from "@/lib/validation"

// Non-strict: validate the known fields we read, allow extra keys from the UI.
const updateCustomerSchema = z.object({
  name: shortText.min(1).optional(),
  phone: phone.optional(),
  lineId: z.string().trim().max(100).optional().nullable(),
  idNumber: shortText.optional().nullable(),
  address: shortText.optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  flagType: z.string().trim().max(50).optional().nullable(),
  flagNote: z.string().trim().max(500).optional().nullable(),
  memberLevelId: z.string().trim().max(100).optional().nullable(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const shopId = session.user.shopId

  try {
    const customer = await prisma.customer.findFirst({
      where: { id, shopId },
      include: {
        memberLevel: true,
        monthlyPlan: true,
        pets: {
          where: { isActive: true },
          include: {
            contract: true,
            groomingRecords: { orderBy: { date: "desc" }, take: 1 },
            _count: { select: { groomingRecords: true } },
          },
          orderBy: { createdAt: "asc" },
        },
        payments: {
          orderBy: { paidAt: "desc" },
          take: 10,
        },
        pointsHistories: { orderBy: { createdAt: "desc" }, take: 5 },
        storedValueHistories: { orderBy: { createdAt: "desc" }, take: 5 },
      },
    })

    if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 })

    return NextResponse.json(customer)
  } catch (error) {
    console.error("GET /api/customers/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const shopId = session.user.shopId

  const parsed = await readJson(req, updateCustomerSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  try {
    const customer = await prisma.customer.updateMany({
      where: { id, shopId },
      data: {
        name: body.name,
        phone: body.phone,
        lineId: body.lineId !== undefined ? (body.lineId || null) : undefined,
        idNumber: body.idNumber !== undefined ? (body.idNumber || null) : undefined,
        address: body.address !== undefined ? (body.address || null) : undefined,
        notes: body.notes !== undefined ? (body.notes || null) : undefined,
        flagType: body.flagType !== undefined ? (body.flagType || null) : undefined,
        flagNote: body.flagNote !== undefined ? (body.flagNote || null) : undefined,
        memberLevelId: body.memberLevelId !== undefined ? (body.memberLevelId || null) : undefined,
      },
    })

    await writeAudit({
      shopId,
      userId: session.user.id,
      action: "UPDATE_CUSTOMER",
      resource: "Customer",
      resourceId: id,
      detail: { name: body.name, flagType: body.flagType },
    })

    return NextResponse.json(customer)
  } catch (error) {
    console.error("PATCH /api/customers/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // AUTH-1: destructive cascade delete is OWNER-only.
  const guard = await requireRole(["OWNER"])
  if (!guard.ok) return guard.response

  const { id } = await params
  const { shopId, userId } = guard.ctx

  try {
  const customer = await prisma.customer.findFirst({ where: { id, shopId } })
  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.$transaction(async (tx) => {
    // Step 1: 取得此客人所有 Pet 的 id
    const petIds = (
      await tx.pet.findMany({ where: { customerId: id }, select: { id: true } })
    ).map((p) => p.id)

    // Step 2: 取得這些 Pet 的所有 BoardingRecord id（刪 BoardingDailyLog 需要）
    const boardingRecordIds =
      petIds.length > 0
        ? (
            await tx.boardingRecord.findMany({
              where: { petId: { in: petIds } },
              select: { id: true },
            })
          ).map((r) => r.id)
        : []

    // Step 3: 刪 Payment（groomingRecordId / boardingRecordId 外鍵，必須在刪 GroomingRecord /
    //         BoardingRecord 之前清除，否則外鍵約束會報錯）
    await tx.payment.deleteMany({ where: { customerId: id } })

    // Step 4: 刪 BoardingDailyLog（SQLite 不保證 cascade，明確刪除）
    if (boardingRecordIds.length > 0) {
      await tx.boardingDailyLog.deleteMany({
        where: { boardingRecordId: { in: boardingRecordIds } },
      })
    }

    // Step 5: 刪 Pet 的其他關聯資料
    if (petIds.length > 0) {
      await tx.boardingRecord.deleteMany({ where: { petId: { in: petIds } } })
      await tx.groomingRecord.deleteMany({ where: { petId: { in: petIds } } })
      await tx.contract.deleteMany({ where: { petId: { in: petIds } } })
      await tx.appointment.deleteMany({ where: { petId: { in: petIds } } })
    }

    // Step 6: 刪客人直接關聯資料
    await tx.pointsHistory.deleteMany({ where: { customerId: id } })
    await tx.storedValueHistory.deleteMany({ where: { customerId: id } })

    // Step 7: 刪所有 Pet
    await tx.pet.deleteMany({ where: { customerId: id } })

    // Step 8: 刪 Customer
    await tx.customer.delete({ where: { id } })
  })

  await writeAudit({
    shopId,
    userId,
    action: "DELETE_CUSTOMER",
    resource: "Customer",
    resourceId: id,
    detail: { name: customer.name },
  })

  return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/customers/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
