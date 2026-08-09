// SECURITY: 已通過多店家隔離稽核 (2026-05-03)
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-guard"
import { differenceInDays } from "date-fns"
import { readJson, shortText, longText, z } from "@/lib/validation"
import { round2 } from "@/lib/money"
import { parseFeeRates, computeFee, PLATFORM_FEE_EXPENSE_CATEGORY } from "@/lib/payment-fee"

const patchSchema = z.object({
  status: shortText.optional(),
  checkOut: z.string().min(1).nullish(),
  notes: longText.nullish(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId, userId } = guard.ctx

  const { id } = await params

  try {
    const parsed = await readJson(req, patchSchema)
    if (!parsed.ok) return parsed.response
    const body = parsed.data

    const record = await prisma.boardingRecord.findFirst({
      where: { id, shopId },
      include: { pet: { select: { customerId: true } }, payment: true },
    })
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

    let checkOutDate: Date | null = record.checkOut
    if (body.checkOut) {
      checkOutDate = new Date(body.checkOut)
      if (isNaN(checkOutDate.getTime())) {
        return NextResponse.json({ error: "checkOut 日期格式錯誤" }, { status: 400 })
      }
    }

    let totalCost = record.totalCost
    if (body.status === "CHECKED_OUT" && body.checkOut && checkOutDate) {
      const days = Math.max(1, differenceInDays(checkOutDate, record.checkIn))
      // SECURITY: cost recomputed server-side from the DB record, never client input.
      const baseCost = days * record.dailyRate
      const addOns: { price: number }[] = (() => {
        try { return record.addOnServices ? JSON.parse(record.addOnServices) : [] } catch { return [] }
      })()
      const addOnTotal = addOns.reduce((s, a) => s + (Number.isFinite(a.price) ? a.price : 0), 0)
      const adjustment = record.priceAdjustment ?? 0
      totalCost = round2(baseCost + addOnTotal + adjustment)
    }

    // 手續費快照（住宿退房固定以現金結算）
    const shopCfg = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { paymentFeeRates: true },
    })
    const feeRates = parseFeeRates(shopCfg?.paymentFeeRates)

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.boardingRecord.update({
        where: { id },
        data: {
          status: body.status ?? record.status,
          checkOut: checkOutDate,
          totalCost,
          notes: body.notes ?? record.notes,
        },
      })

      if (body.status === "CHECKED_OUT") {
        if (record.roomId) {
          // M7: only release the room if no OTHER record is still staying in it,
          // otherwise we would wrongly mark an occupied room as available.
          const stillStaying = await tx.boardingRecord.findFirst({
            where: { roomId: record.roomId, shopId, status: "STAYING", id: { not: id } },
          })
          if (!stillStaying) {
            await tx.boardingRoom.updateMany({
              where: { id: record.roomId, shopId },
              data: { status: "AVAILABLE" },
            })
          }
        }
        // Create payment record on checkout
        if (totalCost && totalCost > 0 && !record.payment) {
          const fee = computeFee(round2(totalCost), "CASH", feeRates)
          await tx.payment.create({
            data: {
              shopId,
              customerId: record.pet.customerId,
              boardingRecordId: id,
              amount: round2(totalCost),
              billingType: "SINGLE",
              paymentMethod: "CASH",
              feeRate: fee.feeRate,
              feeAmount: fee.feeAmount,
              netAmount: fee.netAmount,
              status: "PAID",
              paidAt: new Date(),
            },
          })
          if (fee.feeAmount > 0) {
            await tx.expense.create({
              data: {
                shopId,
                date: new Date(),
                category: PLATFORM_FEE_EXPENSE_CATEGORY,
                description: `現金 手續費 ${fee.feeRate}%（住宿收款）`,
                amount: fee.feeAmount,
                createdBy: userId,
              },
            })
          }
        }
      }

      return result
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("PATCH /api/boarding/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx

  const { id } = await params

  try {
    const record = await prisma.boardingRecord.findFirst({ where: { id, shopId } })
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (record.status !== "STAYING") {
      return NextResponse.json({ error: "只有住宿中的紀錄才可取消" }, { status: 400 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.boardingRecord.update({
        where: { id },
        data: { status: "CANCELLED" },
      })
      if (record.roomId) {
        // M7: only release the room if no OTHER record is still staying in it.
        const stillStaying = await tx.boardingRecord.findFirst({
          where: { roomId: record.roomId, shopId, status: "STAYING", id: { not: id } },
        })
        if (!stillStaying) {
          await tx.boardingRoom.updateMany({
            where: { id: record.roomId, shopId },
            data: { status: "AVAILABLE" },
          })
        }
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/boarding/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
