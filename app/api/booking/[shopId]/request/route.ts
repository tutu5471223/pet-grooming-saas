import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { enforceRateLimit, clientIp } from "@/lib/rate-limit"
import { readJson, z, shortText, longText } from "@/lib/validation"
import { checkCustomerLimit } from "@/lib/subscription-guard"

// L8: collapse duplicate submissions from the same phone+shop within this window.
const DEDUP_WINDOW_MS = 2 * 60_000

const MAX_SERVICES = 50

const bookingSchema = z.object({
  name: shortText.min(1),
  phone: z.string().trim().regex(/^09\d{8}$/, "請輸入正確的手機號碼（格式：09xxxxxxxx）"),
  petName: shortText.min(1),
  petSpecies: shortText.optional(),
  preferredDate: shortText.optional(),
  preferredTime: shortText.optional(),
  preferredTime2: shortText.optional(),
  preferredTime3: shortText.optional(),
  notes: longText.optional(),
  services: z
    .array(z.object({ price: z.number().finite().optional() }).passthrough())
    .max(MAX_SERVICES)
    .optional(),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  const { shopId } = await params

  const limited =
    enforceRateLimit(`booking:${clientIp(req)}`, 10, 60_000) ??
    enforceRateLimit(`booking:shop:${shopId}`, 60, 60_000)
  if (limited) return limited

  const parsed = await readJson(req, bookingSchema)
  if (!parsed.ok) return parsed.response
  const {
    name,
    phone,
    petName,
    petSpecies,
    preferredDate,
    preferredTime,
    preferredTime2,
    preferredTime3,
    notes,
    services,
  } = parsed.data

  try {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } })
    if (!shop) return NextResponse.json({ error: "找不到店家" }, { status: 404 })

    // M6: this is a public endpoint — before minting a brand-new customer,
    // enforce the shop's plan customer limit (and subscription expiry).
    const existing = await prisma.customer.findFirst({ where: { phone, shopId } })
    if (!existing) {
      const limitCheck = await checkCustomerLimit(shopId)
      if (!limitCheck.allowed) {
        return NextResponse.json({ error: limitCheck.message }, { status: 403 })
      }
    }

    // M5: atomic upsert on @@unique([shopId, phone]) closes the find-then-create
    // TOCTOU window that previously fragmented a customer into duplicate rows.
    const customer = await prisma.customer.upsert({
      where: { shopId_phone: { shopId, phone } },
      create: { name: name.trim(), phone, shopId },
      update: {},
    })

    let pet = await prisma.pet.findFirst({
      where: { name: petName.trim(), customerId: customer.id, isActive: true },
    })
    if (!pet) {
      try {
        pet = await prisma.pet.create({
          data: { name: petName.trim(), species: petSpecies || "犬", customerId: customer.id, shopId },
        })
      } catch {
        // A concurrent request may have just created it; re-fetch before giving up.
        pet = await prisma.pet.findFirst({
          where: { name: petName.trim(), customerId: customer.id, isActive: true },
        })
        if (!pet) throw new Error("pet find-or-create failed")
      }
    }

    // L8: if an identical pending request for this pet arrived in the last
    // few minutes (double-tap / retry), reuse it instead of spawning duplicate
    // appointments + notifications.
    const recentDuplicate = await prisma.appointment.findFirst({
      where: {
        shopId,
        petId: pet.id,
        status: "PENDING",
        source: "LINE",
        createdAt: { gte: new Date(Date.now() - DEDUP_WINDOW_MS) },
      },
      orderBy: { createdAt: "desc" },
    })
    if (recentDuplicate) {
      return NextResponse.json({ appointmentId: recentDuplicate.id }, { status: 201 })
    }

    // All times stored in UTC; explicit +08:00 offset ensures correctness on UTC servers.
    const timeStr = /^\d{2}:\d{2}$/.test(preferredTime ?? "") ? preferredTime : "09:00"
    let scheduledAt: Date
    if (preferredDate) {
      scheduledAt = new Date(`${preferredDate}T${timeStr}:00+08:00`)
    } else {
      const tomorrowTW = new Date(new Date().toLocaleString("sv-SE", { timeZone: "Asia/Taipei" }))
      tomorrowTW.setDate(tomorrowTW.getDate() + 1)
      const yy = tomorrowTW.getFullYear()
      const mm = String(tomorrowTW.getMonth() + 1).padStart(2, "0")
      const dd = String(tomorrowTW.getDate()).padStart(2, "0")
      scheduledAt = new Date(`${yy}-${mm}-${dd}T${timeStr}:00+08:00`)
    }
    if (isNaN(scheduledAt.getTime())) {
      return NextResponse.json({ error: "日期或時間格式錯誤" }, { status: 400 })
    }

    const estimatedCost =
      Array.isArray(services) && services.length > 0
        ? services.reduce((sum: number, s: { price?: number }) => sum + (Number.isFinite(s.price) ? (s.price as number) : 0), 0)
        : null

    const noteParts: string[] = []
    const timeParts: string[] = []
    if (preferredTime) timeParts.push(`第一選擇：${preferredTime}`)
    if (preferredTime2) timeParts.push(`第二選擇：${preferredTime2}`)
    if (preferredTime3) timeParts.push(`第三選擇：${preferredTime3}`)
    if (timeParts.length > 0) noteParts.push(`偏好時段：${timeParts.join("、")}`)
    if (notes?.trim()) noteParts.push(notes.trim())

    const appointment = await prisma.appointment.create({
      data: {
        petId: pet.id,
        shopId,
        type: "GROOMING",
        scheduledAt,
        status: "PENDING",
        services: Array.isArray(services) && services.length > 0 ? JSON.stringify(services) : null,
        estimatedCost,
        notes: noteParts.length > 0 ? noteParts.join("。") : null,
        source: "LINE",
      },
    })

    // 建立通知給店家
    const notifParts: string[] = [
      `客人：${name}（${phone}）`,
      `寵物：${petName}（${petSpecies || "犬"}）`,
    ]
    if (preferredDate) {
      notifParts.push(`希望時間：${preferredDate}${preferredTime ? " " + preferredTime : "（時間未指定）"}`)
      if (preferredTime2) notifParts.push(`第二選擇：${preferredDate} ${preferredTime2}`)
      if (preferredTime3) notifParts.push(`第三選擇：${preferredDate} ${preferredTime3}`)
    }
    if (notes?.trim()) notifParts.push(`備註：${notes.trim()}`)

    await prisma.notification.create({
      data: {
        shopId,
        type: "BOOKING_REQUEST",
        title: "新客人自助預約申請",
        body: notifParts.join("\n"),
        relatedId: appointment.id,
      },
    }).catch(() => {}) // non-fatal

    // Email stub：若有設定 SMTP 則發送，否則僅 log
    const shopEmail = shop.email
    if (shopEmail) {
      console.log(`[EMAIL] To: ${shopEmail} | 新預約通知：${name} 的 ${petName} 申請 ${preferredDate ?? "近期"} 美容`)
    }

    return NextResponse.json({ appointmentId: appointment.id }, { status: 201 })
  } catch (error) {
    console.error("POST /api/booking/[shopId]/request", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
