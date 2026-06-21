// SECURITY: 公開端點（無 session）。攻擊者僅憑 groomingRecord 的 cuid 即可偽造
// 顧客簽名（跨店家偽造）。比照 app/api/contracts/[id]/sign：要求請求方提供
// 正確的 viewToken，並以 { id, viewToken } 雙條件查詢，兩者缺一不可。
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// base64 PNG of a 600×200 canvas is ~20–80KB; cap at 512KB to block abuse
const MAX_SIGNATURE_BYTES = 512 * 1024

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const signature: string | undefined = body.signature
    // Token the caller received from the public URL — possession proves access.
    const token: string | undefined =
      typeof body.token === "string" ? body.token : undefined

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 })
    }

    if (!signature || !signature.startsWith("data:image/")) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }
    if (signature.length > MAX_SIGNATURE_BYTES) {
      return NextResponse.json({ error: "簽名檔案過大" }, { status: 413 })
    }

    // Look up by BOTH id AND viewToken — neither alone is sufficient.
    const record = await prisma.groomingRecord.findFirst({
      where: { id, viewToken: token },
      select: { id: true, customerConfirmedAt: true },
    })

    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 })
    }

    if (record.customerConfirmedAt) {
      return NextResponse.json({ error: "Already confirmed" }, { status: 409 })
    }

    // Atomic guard: only flip from "not yet confirmed" so a double-submit can't
    // overwrite an existing signature.
    const result = await prisma.groomingRecord.updateMany({
      where: { id, viewToken: token, customerConfirmedAt: null },
      data: {
        customerSignature: signature,
        customerConfirmedAt: new Date(),
      },
    })

    if (result.count !== 1) {
      return NextResponse.json({ error: "Already confirmed" }, { status: 409 })
    }

    const updated = await prisma.groomingRecord.findFirst({
      where: { id, viewToken: token },
      select: { customerConfirmedAt: true },
    })

    return NextResponse.json({ customerConfirmedAt: updated?.customerConfirmedAt })
  } catch (err) {
    console.error("Grooming confirm error:", err)
    return NextResponse.json({ error: "伺服器錯誤，請重試" }, { status: 500 })
  }
}
