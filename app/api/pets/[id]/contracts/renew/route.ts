import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-guard"
import { nanoid } from "nanoid"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAuth()
  if (!guard.ok) return guard.response
  const { shopId } = guard.ctx
  const { id: petId } = await params

  try {
    const pet = await prisma.pet.findFirst({
      where: { id: petId, shopId },
      include: { contract: true },
    })
    if (!pet) return NextResponse.json({ error: "找不到寵物" }, { status: 404 })
    if (!pet.contract) return NextResponse.json({ error: "此寵物尚無合約" }, { status: 404 })

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { contractTemplate: true },
    })

    const updated = await prisma.contract.update({
      where: { id: pet.contract.id },
      data: {
        status: "PENDING",
        token: nanoid(21),
        content: shop?.contractTemplate ?? pet.contract.content,
        signedAt: null,
        signerName: null,
        signatureUrl: null,
        pdfUrl: null,
        expiresAt: null,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("POST /api/pets/[id]/contracts/renew", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
