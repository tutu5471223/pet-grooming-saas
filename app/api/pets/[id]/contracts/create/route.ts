import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuth } from "@/lib/auth-guard"
import { sanitizeContractHtml } from "@/lib/sanitize"

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
    if (pet.contract) return NextResponse.json({ error: "此寵物已有合約" }, { status: 409 })

    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { contractTemplate: true },
    })

    const contract = await prisma.contract.create({
      data: {
        petId,
        shopId,
        // Sanitize shop-authored HTML before storing (defense vs stored XSS).
        content: sanitizeContractHtml(shop?.contractTemplate ?? ""),
        status: "PENDING",
      },
    })

    return NextResponse.json(contract, { status: 201 })
  } catch (error) {
    console.error("POST /api/pets/[id]/contracts/create", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
