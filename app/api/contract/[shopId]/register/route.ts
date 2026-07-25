import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { enforceRateLimit, clientIp } from "@/lib/rate-limit"
import { readJson, z, shortText } from "@/lib/validation"
import { sanitizeContractHtml } from "@/lib/sanitize"
import { checkCustomerLimit, checkPetLimit } from "@/lib/subscription-guard"

// data: URLs for signatures can be large; cap to a sane upper bound.
const MAX_SIGNATURE_LEN = 2_000_000

const registerSchema = z.object({
  name: shortText.min(1),
  phone: z.string().trim().regex(/^09\d{8}$/, "手機號碼格式錯誤（09xxxxxxxx）"),
  // 第二聯絡人姓名／電話為必填
  secondContactName: shortText.min(1, "請填寫第二聯絡人姓名"),
  secondContactPhone: z.string().trim().min(3, "請填寫第二聯絡人電話").max(30),
  idNumber: shortText.optional().nullable(),
  address: shortText.min(1),
  petName: shortText.min(1),
  species: shortText.optional(),
  breed: shortText.min(1),
  gender: shortText.optional(),
  signerName: shortText.optional(),
  signatureUrl: z.string().min(1).max(MAX_SIGNATURE_LEN),
  // 個性標籤
  // L3: cap array length + element size so a public submission cannot store an
  // arbitrarily large JSON blob (neighbouring fields are already bounded).
  personality: z.array(z.string().max(50)).max(30).optional(),
  // 身體狀況
  boneIssue: z.boolean().optional(),
  boneNote: shortText.nullish(),
  skinIssue: z.boolean().optional(),
  skinNote: shortText.nullish(),
  earIssue: z.boolean().optional(),
  earNote: shortText.nullish(),
  eyeIssue: z.boolean().optional(),
  eyeNote: shortText.nullish(),
  // 病史分類
  heartDisease: z.boolean().optional(),
  boneDisease: z.boolean().optional(),
  skinDisease: z.boolean().optional(),
  epilepsy: z.boolean().optional(),
  diabetes: z.boolean().optional(),
  surgeryHistory: z.boolean().optional(),
  surgeryNote: shortText.nullish(),
  otherDisease: shortText.nullish(),
  // 美容習慣
  bathFrequency: shortText.nullish(),
  groomFrequency: shortText.nullish(),
  blowDryerFear: shortText.nullish(),
  // 同意事項
  afterGroomHandle: shortText.nullish(),
  consentPhotoRecord: z.boolean().optional(),
  consentPhotoSocial: z.boolean().optional(),
  consentSnack: z.boolean().optional(),
  snackAllergy: shortText.nullish(),
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
  const {
    name, phone, secondContactName, secondContactPhone, idNumber, address, petName, species, breed, gender, signerName, signatureUrl,
    personality, boneIssue, boneNote, skinIssue, skinNote, earIssue, earNote, eyeIssue, eyeNote,
    heartDisease, boneDisease, skinDisease, epilepsy, diabetes, surgeryHistory, surgeryNote, otherDisease,
    bathFrequency, groomFrequency, blowDryerFear, afterGroomHandle,
    consentPhotoRecord, consentPhotoSocial, consentSnack, snackAllergy,
  } = parsed.data

  try {
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
      select: { id: true, name: true, contractTemplate: true },
    })
    if (!shop) return NextResponse.json({ error: "找不到店家" }, { status: 404 })

    // M6: public endpoint — every registration creates a pet, so enforce the
    // plan pet limit (and subscription expiry) up front.
    const petLimitCheck = await checkPetLimit(shopId)
    if (!petLimitCheck.allowed) {
      return NextResponse.json({ error: petLimitCheck.message }, { status: 403 })
    }

    // Upsert customer by phone+shopId
    let customer = await prisma.customer.findFirst({ where: { phone, shopId } })
    if (!customer) {
      // M6: only gate brand-new customers against the plan customer limit.
      const customerLimitCheck = await checkCustomerLimit(shopId)
      if (!customerLimitCheck.allowed) {
        return NextResponse.json({ error: customerLimitCheck.message }, { status: 403 })
      }
      customer = await prisma.customer.create({
        data: {
          name: name.trim(),
          phone,
          secondContactName: secondContactName.trim(),
          secondContactPhone: secondContactPhone.trim(),
          shopId,
          idNumber: idNumber?.trim() || null,
          address: address?.trim() || null,
        },
      })
    } else {
      // Update idNumber/address/第二聯絡人 if provided and not already set
      if (
        (idNumber && !customer.idNumber) ||
        (address && !customer.address) ||
        !customer.secondContactName ||
        !customer.secondContactPhone
      ) {
        customer = await prisma.customer.update({
          where: { id: customer.id },
          data: {
            idNumber: idNumber?.trim() || customer.idNumber,
            address: address?.trim() || customer.address,
            secondContactName: customer.secondContactName || secondContactName.trim(),
            secondContactPhone: customer.secondContactPhone || secondContactPhone.trim(),
          },
        })
      }
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
        personality: personality ?? [],
        boneIssue: boneIssue ?? false,
        boneNote: boneNote || null,
        skinIssue: skinIssue ?? false,
        skinNote: skinNote || null,
        earIssue: earIssue ?? false,
        earNote: earNote || null,
        eyeIssue: eyeIssue ?? false,
        eyeNote: eyeNote || null,
        heartDisease: heartDisease ?? false,
        boneDisease: boneDisease ?? false,
        skinDisease: skinDisease ?? false,
        epilepsy: epilepsy ?? false,
        diabetes: diabetes ?? false,
        surgeryHistory: surgeryHistory ?? false,
        surgeryNote: surgeryNote || null,
        otherDisease: otherDisease || null,
        bathFrequency: bathFrequency || null,
        groomFrequency: groomFrequency || null,
        blowDryerFear: blowDryerFear || null,
        afterGroomHandle: afterGroomHandle || null,
        consentPhotoRecord: consentPhotoRecord ?? false,
        consentPhotoSocial: consentPhotoSocial ?? false,
        consentSnack: consentSnack ?? false,
        snackAllergy: snackAllergy || null,
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
