import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { enforceRateLimit, clientIp } from "@/lib/rate-limit"
import { readJson, z, shortText } from "@/lib/validation"
import { sanitizeContractHtml } from "@/lib/sanitize"

// data: URLs for signatures can be large; cap to a sane upper bound.
const MAX_SIGNATURE_LEN = 2_000_000

const registerSchema = z.object({
  name: shortText.min(1),
  phone: z.string().trim().regex(/^09\d{8}$/, "手機號碼格式錯誤（09xxxxxxxx）"),
  petName: shortText.min(1),
  species: shortText.optional(),
  breed: shortText.optional(),
  gender: shortText.optional(),
  signerName: shortText.optional(),
  signatureUrl: z.string().min(1).max(MAX_SIGNATURE_LEN),
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  const { shopId } = await params

  const limited =
    enforceRateLimit(`contract-register:${clientIp(req)}`, 5, 60_000) ??
    enforceRateLimit(`contract-register:shop:${shopId}`, 30, 60_000)
  if (limited) return limited

  const parsed = await readJson(req, registerSchema)
  if (!parsed.ok) return parsed.response
  const { name, phone, petName, species, breed, gender, signerName, signatureUrl } = parsed.data

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

    // Create contract (signed immediately).
    // XSS-1: sanitize the shop-authored template HTML before persisting so that
    // it is safe to render on public pages via dangerouslySetInnerHTML.
    const contractContent = sanitizeContractHtml(shop.contractTemplate ?? "")
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
