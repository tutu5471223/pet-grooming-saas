// SECURITY: 已通過多店家隔離稽核 (2026-05-03)
// 公開端點（無 session），但要求請求方提供正確 token 才能簽署，
// 防止攻擊者僅憑 contractId（cuid）繞過 token 驗證直接簽署任意合約。
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { enforceRateLimit, clientIp } from "@/lib/rate-limit"
import { readJson, z, shortText } from "@/lib/validation"

const MAX_SIGNATURE_LEN = 2_000_000

const signSchema = z.object({
  token: z.string().min(1).max(200),
  signerName: shortText.optional(),
  signatureUrl: z.string().min(1).max(MAX_SIGNATURE_LEN).optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const limited = enforceRateLimit(`contract-sign:${clientIp(req)}`, 5, 60_000)
  if (limited) return limited

  const parsed = await readJson(req, signSchema)
  if (!parsed.ok) return parsed.response
  // Require token in request body — caller (ContractSigner) must supply the
  // token it received from the URL, so possession of the token is verified.
  const { signerName, signatureUrl, token } = parsed.data

  // Look up by BOTH id AND token — neither alone is sufficient.
  try {
    const contract = await prisma.contract.findFirst({
      where: { id, token },
    })
    if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (contract.status === "SIGNED") {
      return NextResponse.json({ error: "已簽署" }, { status: 400 })
    }
    if (contract.status === "EXPIRED") {
      return NextResponse.json({ error: "合約已過期" }, { status: 400 })
    }
    if (contract.expiresAt && contract.expiresAt < new Date()) {
      await prisma.contract.updateMany({
        where: { id, token, status: { not: "SIGNED" } },
        data: { status: "EXPIRED" },
      })
      return NextResponse.json({ error: "合約已過期" }, { status: 400 })
    }

    // Atomic transition: only flip a contract that is still unsigned. If another
    // concurrent request already signed it, count === 0 and we abort.
    const result = await prisma.contract.updateMany({
      where: { id, token, status: { not: "SIGNED" } },
      data: {
        status: "SIGNED",
        signedAt: new Date(),
        signerName: signerName?.trim() || null,
        signatureUrl: signatureUrl ?? null,
      },
    })
    if (result.count !== 1) {
      return NextResponse.json({ error: "已簽署" }, { status: 400 })
    }

    const updated = await prisma.contract.findFirst({ where: { id, token } })
    return NextResponse.json(updated)
  } catch (error) {
    console.error("POST /api/contracts/[id]/sign", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
