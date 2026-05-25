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

    if (!signature || !signature.startsWith("data:image/")) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
    }
    if (signature.length > MAX_SIGNATURE_BYTES) {
      return NextResponse.json({ error: "簽名檔案過大" }, { status: 413 })
    }

    const record = await prisma.groomingRecord.findUnique({
      where: { id },
      select: { id: true, customerConfirmedAt: true },
    })

    if (!record) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 })
    }

    if (record.customerConfirmedAt) {
      return NextResponse.json({ error: "Already confirmed" }, { status: 409 })
    }

    const updated = await prisma.groomingRecord.update({
      where: { id },
      data: {
        customerSignature: signature,
        customerConfirmedAt: new Date(),
      },
      select: { customerConfirmedAt: true },
    })

    return NextResponse.json({ customerConfirmedAt: updated.customerConfirmedAt })
  } catch (err) {
    console.error("Grooming confirm error:", err)
    return NextResponse.json({ error: "伺服器錯誤，請重試" }, { status: 500 })
  }
}
