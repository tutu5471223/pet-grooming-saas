import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopId = session.user.shopId
  const { id } = await params
  const body = await req.json()

  try {
    const record = await prisma.groomingRecord.findFirst({ where: { id, shopId } })
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const totalCost = body.totalCost !== undefined ? Number(body.totalCost) : record.totalCost

    const updated = await prisma.groomingRecord.update({
      where: { id },
      data: {
        groomerId: body.groomerId !== undefined ? (body.groomerId || null) : record.groomerId,
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
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopId = session.user.shopId
  const { id } = await params

  try {
    const record = await prisma.groomingRecord.findFirst({
      where: { id, shopId },
      include: { payment: true },
    })
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await prisma.$transaction(async (tx) => {
      if (record.payment) {
        await tx.payment.delete({ where: { id: record.payment.id } })
      }
      await tx.groomingRecord.delete({ where: { id } })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("DELETE /api/grooming/[id]", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
