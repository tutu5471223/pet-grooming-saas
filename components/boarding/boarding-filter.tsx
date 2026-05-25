"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function BoardingFilter({
  defaultQ = "",
  defaultFrom = "",
  defaultTo = "",
}: {
  defaultQ?: string
  defaultFrom?: string
  defaultTo?: string
}) {
  const router = useRouter()
  const [q, setQ] = useState(defaultQ)
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)

  function apply() {
    const params = new URLSearchParams()
    if (q) params.set("q", q)
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    router.push(`/boarding?${params.toString()}`)
  }

  function reset() {
    setQ("")
    setFrom("")
    setTo("")
    router.push("/boarding")
  }

  const hasFilter = q || from || to

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <Input
          placeholder="寵物或客人名稱"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && apply()}
          className="pl-8 h-8 text-sm w-44"
        />
      </div>
      <Input
        type="date"
        value={from}
        onChange={(e) => setFrom(e.target.value)}
        className="h-8 text-sm w-36"
      />
      <span className="text-gray-400 text-sm">～</span>
      <Input
        type="date"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        className="h-8 text-sm w-36"
      />
      <Button onClick={apply} size="sm" className="h-8">
        搜尋
      </Button>
      {hasFilter && (
        <Button onClick={reset} size="sm" variant="ghost" className="h-8 px-2">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
