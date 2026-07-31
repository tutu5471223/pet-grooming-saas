// SECURITY: 已通過多店家隔離稽核 (2026-05-03)
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { writeAudit } from "@/lib/audit"
import { requireAuth, requireRole } from "@/lib/auth-guard"
import { readJson, z, shortText, phone } from "@/lib/validation"

// Non-strict: validate the known fields we read, allow extra keys from the UI.
const updateCustomerSchema = z.object({
  name: shortText.min(1).optional(),
  phone: phone.optional(),
  // 第二聯絡人：與新增/自助建檔一致為必填。PATCH 為部分更新，故此處 optional
  // （其他只更新 flag 等欄位的呼叫不會傳），但一旦傳入就必須非空、格式正確。
  secondContactName: shortText.min(1, "請填寫第二聯絡人姓名").optional(),
  secondContactPhone: phone.optional(),
  lineId: z.string().trim().max(100).optional().nullable(),
  idNumber: shortText.optional().nullable(),
  address: shortText.optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  flagType: z.string().trim().max(50).optional().nullable(),
  flagNote: z.string().trim().max(500).optional().nullable(),
  memberLevelId: z.string().trim().max(100).optional().nullable(),
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response

  const { id } = await params
  const { shopId } = guard.ctx

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
  const guard = await requireAuth()
  if (!guard.ok) return guard.response

  const { id } = await params
  const { shopId, userId } = guard.ctx

  const parsed = await readJson(req, updateCustomerSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

  try {
    const customer = await prisma.customer.updateMany({
      where: { id, shopId },
      data: {
        name: body.name,
        phone: body.phone,
        secondContactName: body.secondContactName,
        secondContactPhone: body.secondContactPhone,
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
      userId,
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
  // AUTH-1: destructive operation is OWNER-only.
  const guard = await requireRole(["OWNER"])
  if (!guard.ok) return guard.response

  const { id } = await params
  const { shopId, userId } = guard.ctx

  try {
    // M4: 軟刪而非硬刪。原本在交易內 tx.payment.deleteMany 會把真錢 Payment 紀錄
    // 一併硬刪、繞過 Payment 的 ON DELETE RESTRICT，等於無痕抹掉財務紀錄。
    // 改為將 customer.status 設為 ARCHIVED，保留所有 payment / pet / 點數 / 儲值歷史
    // （比照 merge 的 MERGED 處理）。列表查詢應比照過濾 MERGED 一併過濾 ARCHIVED
    //  —— 該過濾由列表端 (A1) 負責，本檔不更動其他檔。
    const customer = await prisma.customer.findFirst({ where: { id, shopId } })
    if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 })

    // 冪等：updateMany 帶 shopId 條件，重複呼叫只是再次設為 ARCHIVED，不會誤動別店資料。
    await prisma.customer.updateMany({
      where: { id, shopId },
      data: { status: "ARCHIVED" },
    })

    await writeAudit({
      shopId,
      userId,
      action: "ARCHIVE_CUSTOMER",
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
