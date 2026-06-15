// SECURITY: 已通過多店家隔離稽核 (2026-05-03)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendLineMessage, buildBaseUrl } from "@/lib/line"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopId = session.user.shopId
  const { searchParams } = new URL(req.url)
  const petId = searchParams.get("petId")

  try {
    const records = await prisma.groomingRecord.findMany({
      where: { shopId, ...(petId ? { petId } : {}) },
      include: { pet: { include: { customer: true } }, groomer: true },
      orderBy: { date: "desc" },
    })

    return NextResponse.json(records)
  } catch (error) {
    console.error("GET /api/grooming", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopId = session.user.shopId
  const baseUrl = buildBaseUrl(req)
  const body = await req.json()

  // SECURITY: Verify pet belongs to this shop before creating record.
  const pet = await prisma.pet.findFirst({
    where: { id: body.petId, shopId, isActive: true },
  })
  if (!pet) return NextResponse.json({ error: "Pet not found" }, { status: 404 })

  const appointmentId: string | null = body.appointmentId || null
  if (appointmentId) {
    const apt = await prisma.appointment.findFirst({ where: { id: appointmentId, shopId } })
    if (!apt) return NextResponse.json({ error: "Appointment not found" }, { status: 404 })
  }

  const totalCost: number = body.totalCost || 0

  try {
    const record = await prisma.$transaction(async (tx) => {
      const groomingRecord = await tx.groomingRecord.create({
        data: {
          petId: body.petId,
          shopId,
          groomerId: body.groomerId || null,
          services: JSON.stringify(body.services || []),
          products: body.products || null,
          totalCost,
          beforePhotoUrl: body.beforePhotoUrl || null,
          afterPhotoUrl: body.afterPhotoUrl || null,
          skinCondition: body.skinCondition || null,
          furCondition: body.furCondition || null,
          notes: body.notes || null,
          date: body.date ? new Date(body.date) : new Date(),
        },
      })

      // Create a PENDING payment — collected separately via receivables
      await tx.payment.create({
        data: {
          shopId,
          customerId: pet.customerId,
          petId: pet.id,
          groomingRecordId: groomingRecord.id,
          amount: totalCost,
          status: "PENDING",
          notes: body.paymentNotes || null,
        },
      })

      if (appointmentId) {
        await tx.appointment.updateMany({
          where: { id: appointmentId, shopId },
          data: { status: "COMPLETED" },
        })
      }

      return groomingRecord
    })

    // Auto LINE notification on grooming completion
    const customer = await prisma.customer.findUnique({
      where: { id: pet.customerId },
      select: { lineId: true, name: true },
    })
    if (customer?.lineId) {
      const shop = await prisma.shop.findUnique({
        where: { id: shopId },
        select: { name: true, lineChannelToken: true },
      })
      const viewUrl = `${baseUrl}/grooming/${record.viewToken}`
      const msg = [
        `【${shop?.name ?? "寵物美容店"}】`,
        `${pet.name} 的美容服務已完成，感謝您的光臨！`,
        ``,
        `📋 請點擊以下連結查看本次美容紀錄：`,
        viewUrl,
      ].join("\n")
      void sendLineMessage(customer.lineId, msg, shop?.lineChannelToken ?? null)
    }

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    console.error("POST /api/grooming", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
