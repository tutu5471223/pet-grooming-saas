import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"
import { formatDate, formatCurrency } from "@/lib/utils"
import { Scissors, CheckCircle2 } from "lucide-react"
import Image from "next/image"
import { GroomingConfirmation } from "@/components/grooming/grooming-confirmation"

async function getGroomingRecord(token: string) {
  return prisma.groomingRecord.findUnique({
    where: { viewToken: token },
    include: {
      pet: { include: { customer: true } },
      groomer: true,
    },
  })
}

export default async function GroomingViewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const record = await getGroomingRecord(token)

  if (!record) notFound()

  const services = JSON.parse(record.services) as { name: string; price: number }[]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-4 py-4">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600">
            <Scissors className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900">美容完工通知</p>
            <p className="text-sm text-gray-500">{formatDate(record.date)}</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 py-6 space-y-4">
        {/* Pet info */}
        <div className="rounded-2xl bg-indigo-600 p-5 text-white">
          <div className="flex items-center gap-3 mb-3">
            <div className="text-3xl">🐾</div>
            <div>
              <p className="font-bold text-xl">{record.pet.name}</p>
              <p className="text-indigo-200 text-sm">
                {record.pet.breed ?? record.pet.species} ·{" "}
                {record.pet.customer.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-white/20 px-3 py-2">
            <CheckCircle2 className="h-5 w-5 text-white" />
            <span className="text-sm font-medium">美容完成！</span>
          </div>
        </div>

        {/* Services */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-sm font-semibold text-gray-700 mb-3">本次服務項目</p>
          <div className="space-y-2">
            {services.map((svc, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{svc.name}</span>
                <span className="text-sm font-medium text-gray-900">
                  {formatCurrency(svc.price)}
                </span>
              </div>
            ))}
            <div className="border-t border-gray-100 pt-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-gray-900">總計</span>
              <span className="font-bold text-lg text-indigo-600">
                {formatCurrency(record.totalCost)}
              </span>
            </div>
          </div>
        </div>

        {/* Pet condition */}
        {(record.skinCondition || record.furCondition || record.notes || record.products) && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">寵物今日狀況</p>
            <div className="space-y-2.5">
              {record.products && (
                <div>
                  <p className="text-xs text-gray-500">使用產品</p>
                  <p className="text-sm text-gray-800 mt-0.5">{record.products}</p>
                </div>
              )}
              {record.skinCondition && (
                <div>
                  <p className="text-xs text-gray-500">皮膚狀況</p>
                  <p className="text-sm text-gray-800 mt-0.5">{record.skinCondition}</p>
                </div>
              )}
              {record.furCondition && (
                <div>
                  <p className="text-xs text-gray-500">毛況</p>
                  <p className="text-sm text-gray-800 mt-0.5">{record.furCondition}</p>
                </div>
              )}
              {record.notes && (
                <div>
                  <p className="text-xs text-gray-500">美容師備註</p>
                  <p className="text-sm text-gray-800 mt-0.5">{record.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Before/After Photos */}
        {(record.beforePhotoUrl || record.afterPhotoUrl) && (
          <div className="rounded-2xl border border-gray-200 bg-white p-5">
            <p className="text-sm font-semibold text-gray-700 mb-3">美容前後對比</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "美容前", url: record.beforePhotoUrl },
                { label: "美容後", url: record.afterPhotoUrl },
              ].map(({ label, url }) => (
                <div key={label} className="space-y-1">
                  <p className="text-xs text-center text-gray-500">{label}</p>
                  {url ? (
                    <div className="relative aspect-square rounded-xl overflow-hidden border border-gray-100">
                      <Image src={url} alt={label} fill className="object-cover" />
                    </div>
                  ) : (
                    <div className="aspect-square rounded-xl border border-dashed border-gray-200 flex items-center justify-center text-xs text-gray-400">
                      未上傳
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Groomer */}
        {record.groomer && (
          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 text-purple-700 font-bold">
              {record.groomer.name[0]}
            </div>
            <div>
              <p className="text-xs text-gray-500">服務美容師</p>
              <p className="text-sm font-semibold text-gray-900">{record.groomer.name}</p>
            </div>
          </div>
        )}

        {/* Customer confirmation signature */}
        <GroomingConfirmation
          groomingId={record.id}
          confirmedAt={record.customerConfirmedAt?.toISOString() ?? null}
        />

        <p className="text-center text-xs text-gray-400 pb-4">
          感謝您的光臨，期待下次再為您的寶貝服務！
        </p>
      </div>
    </div>
  )
}
