"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { Phone, PawPrint, ChevronRight, Wallet, Star } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { formatCurrency } from "@/lib/utils"

const FLAG_ICONS: Record<string, string> = {
  WARNING: "⚠️",
  BLOCKED: "🚫",
  VIP: "⭐",
}

export interface CustomerCardData {
  id: string
  name: string
  phone: string
  lineId: string | null
  flagType: string | null
  flagNote: string | null
  memberLevel: { name: string; color: string } | null
  storedValue: number
  points: number
  pets: { id: string; name: string }[]
  totalGroomings: number
  lastVisitLabel: string | null
}

export function CustomerCard({ customer }: { customer: CustomerCardData }) {
  const router = useRouter()
  const flagIcon = customer.flagType ? FLAG_ICONS[customer.flagType] : null

  return (
    <Card
      onClick={() => router.push(`/customers/${customer.id}`)}
      className={`cursor-pointer hover:shadow-md transition-shadow ${
        customer.flagType === "BLOCKED" ? "border-red-200 bg-red-50/30" :
        customer.flagType === "WARNING" ? "border-yellow-200 bg-yellow-50/30" :
        customer.flagType === "VIP" ? "border-yellow-300 bg-yellow-50/20" : ""
      }`}
    >
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold text-lg">
            {customer.name[0]}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {flagIcon && <span>{flagIcon}</span>}
              <span className="font-semibold text-gray-900">
                {customer.name}
                {customer.pets.length > 0 && (
                  <span className="font-normal text-gray-500">
                    （
                    {customer.pets.map((pet, i) => (
                      <span key={pet.id}>
                        {i > 0 && "、"}
                        <Link
                          href={`/customers/${customer.id}/pets/${pet.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="text-indigo-600 hover:text-indigo-700 hover:underline"
                        >
                          {pet.name}
                        </Link>
                      </span>
                    ))}
                    ）
                  </span>
                )}
              </span>
              {customer.memberLevel && (
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: customer.memberLevel.color }}
                >
                  {customer.memberLevel.name}
                </span>
              )}
              {customer.flagType === "BLOCKED" && (
                <span className="text-xs bg-red-100 text-red-700 rounded-full px-2 py-0.5">拒絕服務</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {customer.phone}
              </span>
              {customer.lineId && (
                <span className="text-green-600">LINE: {customer.lineId}</span>
              )}
            </div>
            {customer.flagNote && (
              <p className="mt-1 text-xs text-gray-500 italic">{customer.flagNote}</p>
            )}

            {/* Stats row */}
            <div className="flex items-center gap-4 mt-2.5 flex-wrap">
              <span className="flex items-center gap-1.5 text-xs text-gray-600">
                <PawPrint className="h-3.5 w-3.5 text-indigo-400" />
                {customer.pets.length} 隻寵物
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-600">
                <Wallet className="h-3.5 w-3.5 text-green-400" />
                儲值 {formatCurrency(customer.storedValue)}
              </span>
              <span className="flex items-center gap-1.5 text-xs text-gray-600">
                <Star className="h-3.5 w-3.5 text-yellow-400" />
                {customer.points} 點
              </span>
              {customer.totalGroomings > 0 && (
                <span className="text-xs text-gray-500">
                  美容 {customer.totalGroomings} 次・
                  上次到店 {customer.lastVisitLabel}
                </span>
              )}
            </div>
          </div>

          {/* Arrow */}
          <ChevronRight className="h-5 w-5 text-gray-400 shrink-0 mt-1" />
        </div>
      </CardContent>
    </Card>
  )
}
