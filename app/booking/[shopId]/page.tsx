import { notFound } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { BookingClient } from "./booking-client"

export default async function BookingPage({
  params,
}: {
  params: Promise<{ shopId: string }>
}) {
  const { shopId } = await params

  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { id: true, name: true, phone: true, address: true },
  })

  if (!shop) notFound()

  const services = await prisma.service.findMany({
    where: { shopId, isActive: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
    select: { id: true, name: true, price: true, duration: true, category: true },
  })

  return <BookingClient shop={shop} services={services} shopId={shopId} />
}
