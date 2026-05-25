// SECURITY: 已通過多店家隔離稽核 (2026-05-03)
// 公開端點（無 session），但要求請求方提供正確 token 才能簽署，
// 防止攻擊者僅憑 contractId（cuid）繞過 token 驗證直接簽署任意合約。
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()

  // Require token in request body — caller (ContractSigner) must supply the
  // token it received from the URL, so possession of the token is verified.
  const { signerName, signatureUrl, token } = body
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 })
  }

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
      await prisma.contract.update({ where: { id }, data: { status: "EXPIRED" } })
      return NextResponse.json({ error: "合約已過期" }, { status: 400 })
    }

    const updated = await prisma.contract.update({
      where: { id },
      data: {
        status: "SIGNED",
        signedAt: new Date(),
        signerName,
        signatureUrl,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error("POST /api/contracts/[id]/sign", error)
    return NextResponse.json({ error: "操作失敗，請稍後再試" }, { status: 500 })
  }
}
