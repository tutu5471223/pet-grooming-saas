"use client"

import { useRouter } from "next/navigation"
import { subMonths, addMonths, parseISO } from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

function toMonthStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function monthLabel(d: Date) {
  return `${d.getFullYear()}年 ${String(d.getMonth() + 1).padStart(2, "0")}月`
}

export function MonthNavigator({ month, tab = "overview" }: { month: string; tab?: string }) {
  const router = useRouter()
  const monthDate = parseISO(`${month}-01`)
  const isCurrentMonth = month === toMonthStr(new Date())

  function navigate(newMonth: string) {
    router.push(`/reports?tab=${tab}&month=${newMonth}`)
  }

  return (
    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-2 py-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => navigate(toMonthStr(subMonths(monthDate, 1)))}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm font-medium text-gray-700 min-w-[120px] text-center">
        {monthLabel(monthDate)}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => navigate(toMonthStr(addMonths(monthDate, 1)))}
        disabled={isCurrentMonth}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
