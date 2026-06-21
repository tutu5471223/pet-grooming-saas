import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { enforceRateLimit, clientIp } from "@/lib/rate-limit"

// PUBLIC, unauthenticated endpoint.
//
// AUTH-4: this is a phone -> PII enumeration oracle. To disclose a customer's
// name and pets we require BOTH a phone AND a matching name (verifier), so a
// caller cannot harvest PII from a phone number alone. We rate-limit hard and
// return a deliberately non-verbose, non-confirming response when there is no
// match (we never differentiate "wrong name" from "no such customer").
export async function GET(req: NextRequest, { params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params

  const limited =
    enforceRateLimit(`lookup:${clientIp(req)}`, 5, 60_000) ??
    enforceRateLimit(`lookup:shop:${shopId}`, 30, 60_000)
  if (limited) return limited

  const phone = (req.nextUrl.searchParams.get("phone") ?? "").trim()
  const name = (req.nextUrl.searchParams.get("name") ?? "").trim()

  // Both phone (format) and a verifier name are required before any disclosure.
  if (!/^09\d{8}$/.test(phone) || name.length === 0 || name.length > 200) {
    return NextResponse.json({ found: false })
  }

  try {
    // Verify the shop exists (scope everything to it).
    const shop = await prisma.shop.findUnique({ where: { id: shopId }, select: { id: true } })
    if (!shop) return NextResponse.json({ found: false })

    const customer = await prisma.customer.findFirst({
      where: { shopId, phone },
      select: {
        name: true,
        pets: {
          where: { isActive: true },
          select: { id: true, name: true, species: true },
          orderBy: { createdAt: "asc" },
        },
      },
    })

    // Non-confirming: require the supplied name to match (case-insensitive,
    // trimmed). Mismatch and "no such customer" return the identical response.
    if (!customer || customer.name.trim().toLowerCase() !== name.toLowerCase()) {
      return NextResponse.json({ found: false })
    }

    return NextResponse.json({
      found: true,
      customerName: customer.name,
      pets: customer.pets,
    })
  } catch (error) {
    console.error("GET /api/booking/[shopId]/lookup", error)
    return NextResponse.json({ found: false })
  }
}
