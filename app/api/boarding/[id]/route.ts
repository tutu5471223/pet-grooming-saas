// SECURITY: 已通過多店家隔離稽核 (2026-05-03)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { differenceInDays } from "date-fns"

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const shopId = session.user.shopId
  const body = await req.json()

  try {
    const record = await prisma.boardingRecord.findFirst({
      where: { id, shopId },
      include: { pet: { select: { customerId: true } }, payment: true },
    })
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

    let totalCost = record.totalCost
    if (body.status === "CHECKED_OUT" && body.checkOut) {
      const checkOut = new Date(body.checkOut)
      const days = Math.max(1, differenceInDays(checkOut, record.checkIn))
      const baseCost = days * record.dailyRate
      const addOns: { price: number }[] = (() => {
        try { return record.addOnServices ? JSON.parse(record.addOnServices) : [] } catch { return [] }
      })()
      const addOnTotal = addOns.reduce((s, a) => s + a.price, 0)
      const adjustment = record.priceAdjustment ?? 0
      totalCost = baseCost + addOnTotal + adjustment
    }

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.boardingRecord.update({
        where: { id },
        data: {
          status: body.status,
          checkOut: body.checkOut ? new Date(body.checkOut) : record.checkOut,
          totalCost,
          notes: body.notes ?? record.notes,
        },
      })

      if (body.status === "CHECKED_OUT") {
        if (record.roomId) {
          await tx.boardingRoom.update({
            where: { id: record.roomId },
            data: { status: "AVAILABLE" },
          })
        }
        // Create payment record on checkout
        if (totalCost && totalCost > 0 && !record.payment) {
          await tx.payment.create({
            data: {
              shopId,
              customerId: record.pet.customerId,
              boardingRecordId: id,
              amount: totalCost,
              billingType: "SINGLE",
              paymentMethod: "CASH",
              status: "PAID",
              paidAt: new Date(),
            },
          })
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
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const shopId = session.user.shopId

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
        await tx.boardingRoom.update({
          where: { id: record.roomId },
          data: { status: "AVAILABLE" },
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/boarding/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
