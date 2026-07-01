import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { differenceInDays } from "date-fns"
import { Receipt, Clock, AlertTriangle } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { ReceivablesClient } from "./receivables-client"

export default async function ReceivablesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")

  const shopId = session.user.shopId
  const { status: rawStatus } = await searchParams
  const status: "PENDING" | "PAID" | "VOIDED" =
    rawStatus === "PAID" ? "PAID" : rawStatus === "VOIDED" ? "VOIDED" : "PENDING"

  const payments = await prisma.payment.findMany({
    where: { shopId, status },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      groomingRecord: { select: { date: true, services: true } },
      boardingRecord: { select: { checkIn: true, checkOut: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  const items = payments.map((p) => ({
    ...p,
    paidAt: p.paidAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    groomingRecord: p.groomingRecord ? { ...p.groomingRecord, date: p.groomingRecord.date.toISOString() } : null,
    boardingRecord: p.boardingRecord ? {
      checkIn: p.boardingRecord.checkIn.toISOString(),
      checkOut: p.boardingRecord.checkOut?.toISOString() ?? null,
    } : null,
  }))

  const totalPending = status === "PENDING" ? items.reduce((s, i) => s + i.amount, 0) : 0
  const overdueCount = status === "PENDING"
    ? items.filter((i) => i.createdAt && differenceInDays(new Date(), new Date(i.createdAt)) > 30).length
    : 0

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">應收帳款</h1>
        <p className="text-sm text-gray-500 mt-1">管理月結及待收款項目</p>
      </div>

      {status === "PENDING" && items.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <Receipt className="h-4 w-4 text-red-500" />
                <span className="text-sm text-gray-500">待收總計</span>
              </div>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(totalPending)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-orange-500" />
                <span className="text-sm text-gray-500">筆數</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{items.length} 筆</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-gray-500">逾30天</span>
              </div>
              <p className="text-2xl font-bold text-yellow-600">{overdueCount} 筆</p>
            </CardContent>
          </Card>
        </div>
      )}

      <ReceivablesClient
        items={items}
        status={status}
        role={session.user.role ?? ""}
      />
    </div>
  )
}
