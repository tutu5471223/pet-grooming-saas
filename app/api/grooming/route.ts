// SECURITY: 已通過多店家隔離稽核 (2026-05-03)
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { sendLineMessage, buildBaseUrl } from "@/lib/line"
import { readJson, money, shortText, longText, z } from "@/lib/validation"
import { round2 } from "@/lib/money"

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

// Non-strict schema: validate types/bounds of known fields, allow extra keys.
const createSchema = z.object({
  petId: z.string().min(1),
  appointmentId: z.string().min(1).optional().nullable(),
  groomerId: z.string().min(1).optional().nullable(),
  services: z.array(z.unknown()).optional(),
  products: z.string().optional().nullable(),
  totalCost: money.optional(),
  beforePhotoUrl: shortText.optional().nullable(),
  afterPhotoUrl: shortText.optional().nullable(),
  skinCondition: longText.optional().nullable(),
  furCondition: longText.optional().nullable(),
  notes: longText.optional().nullable(),
  paymentNotes: longText.optional().nullable(),
  date: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const shopId = session.user.shopId
  const baseUrl = buildBaseUrl(req)

  const parsed = await readJson(req, createSchema)
  if (!parsed.ok) return parsed.response
  const body = parsed.data

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

  // SECURITY (TEN-3): Verify groomer (a User) belongs to this shop before storing.
  const groomerId: string | null = body.groomerId || null
  if (groomerId) {
    const groomer = await prisma.user.findFirst({ where: { id: groomerId, shopId } })
    if (!groomer) return NextResponse.json({ error: "Groomer not found" }, { status: 404 })
  }

  const totalCost: number = round2(body.totalCost ?? 0)

  try {
    const record = await prisma.$transaction(async (tx) => {
      const groomingRecord = await tx.groomingRecord.create({
        data: {
          petId: body.petId,
          shopId,
          groomerId,
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
      select: { lineUserId: true, name: true },
    })
    // SEC-7: do not log PII (name / lineUserId). Log only non-identifying state.
    console.log(`[GROOMING] record created; lineBound=${customer?.lineUserId ? "yes" : "no"}`)
    if (customer?.lineUserId) {
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
      const ok = await sendLineMessage(customer.lineUserId, msg, shop?.lineChannelToken ?? null)
      console.log(`[GROOMING] LINE 推播結果: ${ok ? "成功 ✅" : "失敗 ❌"}`)
    }

    return NextResponse.json(record, { status: 201 })
  } catch (error) {
    console.error("POST /api/grooming", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
