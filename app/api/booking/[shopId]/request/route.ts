import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  const { shopId } = await params
  const body = await req.json()

  const { name, phone, petName, petSpecies, preferredDate, preferredTime, preferredTime2, preferredTime3, notes, services } = body

  if (!name?.trim() || !phone?.trim() || !petName?.trim()) {
    return NextResponse.json({ error: "請填寫必填欄位" }, { status: 400 })
  }
  if (!/^09\d{8}$/.test(phone)) {
    return NextResponse.json({ error: "請輸入正確的手機號碼（格式：09xxxxxxxx）" }, { status: 400 })
  }

  try {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } })
    if (!shop) return NextResponse.json({ error: "找不到店家" }, { status: 404 })

    let customer = await prisma.customer.findFirst({ where: { phone, shopId } })
    if (!customer) {
      customer = await prisma.customer.create({
        data: { name: name.trim(), phone, shopId },
      })
    }

    let pet = await prisma.pet.findFirst({
      where: { name: petName.trim(), customerId: customer.id, isActive: true },
    })
    if (!pet) {
      pet = await prisma.pet.create({
        data: { name: petName.trim(), species: petSpecies || "犬", customerId: customer.id, shopId },
      })
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

    const estimatedCost =
      Array.isArray(services) && services.length > 0
        ? services.reduce((sum: number, s: { price: number }) => sum + (s.price || 0), 0)
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
