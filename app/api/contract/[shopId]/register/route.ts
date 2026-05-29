import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  const { shopId } = await params
  const body = await req.json()
  const { name, phone, petName, species, breed, gender, signerName, signatureUrl } = body

  if (!name?.trim() || !phone?.trim() || !petName?.trim()) {
    return NextResponse.json({ error: "請填寫必填欄位（姓名、手機、寵物名稱）" }, { status: 400 })
  }
  if (!/^09\d{8}$/.test(phone)) {
    return NextResponse.json({ error: "手機號碼格式錯誤（09xxxxxxxx）" }, { status: 400 })
  }
  if (!signatureUrl) {
    return NextResponse.json({ error: "缺少簽名資料" }, { status: 400 })
  }

  try {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, name: true, contractTemplate: true },
    })
    if (!shop) return NextResponse.json({ error: "找不到店家" }, { status: 404 })

    // Upsert customer by phone+shopId
    let customer = await prisma.customer.findFirst({ where: { phone, shopId } })
    if (!customer) {
      customer = await prisma.customer.create({
        data: { name: name.trim(), phone, shopId },
      })
    }

    // Create pet
    const pet = await prisma.pet.create({
      data: {
        name: petName.trim(),
        species: species ?? "犬",
        breed: breed?.trim() || null,
        gender: gender ?? "UNKNOWN",
        customerId: customer.id,
        shopId,
      },
    })

    // Create contract (signed immediately)
    const contractContent = shop.contractTemplate ?? ""
    await prisma.contract.create({
      data: {
        petId: pet.id,
        shopId,
        content: contractContent,
        status: "SIGNED",
        signedAt: new Date(),
        signerName: signerName?.trim() || name.trim(),
        signatureUrl,
      },
    })

    return NextResponse.json({ success: true, customerId: customer.id, petId: pet.id }, { status: 201 })
  } catch (error) {
    console.error("POST /api/contract/[shopId]/register", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
