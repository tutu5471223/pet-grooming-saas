"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { MessageSquare, Copy, Check } from "lucide-react"
import { differenceInDays } from "date-fns"

interface Customer {
  id: string
  name: string
  phone: string
  lineId?: string | null
  memberLevelId?: string | null
  memberLevel?: { id: string; name: string } | null
  pets: { groomingRecords: { date: string }[] }[]
}

interface MemberLevel {
  id: string
  name: string
}

export function CustomerNotifyDialog({
  customers,
  memberLevels,
}: {
  customers: Customer[]
  memberLevels: MemberLevel[]
}) {
  const [open, setOpen] = useState(false)
  const [filterType, setFilterType] = useState<"all" | "level" | "inactive">("all")
  const [levelId, setLevelId] = useState("")
  const [inactiveDays, setInactiveDays] = useState("30")
  const [template, setTemplate] = useState(
    "親愛的 {name} 您好！\n\n感謝您一直以來的支持，歡迎您帶著毛寶貝到我們店裡！\n\n如有任何問題請隨時聯繫我們。😊"
  )
  const [copied, setCopied] = useState<string | null>(null)

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (filterType === "level") return c.memberLevelId === levelId
      if (filterType === "inactive") {
        const lastVisitDate = c.pets
          .flatMap((p) => p.groomingRecords)
          .map((r) => new Date(r.date))
          .sort((a, b) => b.getTime() - a.getTime())[0]
        if (!lastVisitDate) return true
        return differenceInDays(new Date(), lastVisitDate) >= Number(inactiveDays)
      }
      return true
    })
  }, [customers, filterType, levelId, inactiveDays])

  function buildMessage(customer: Customer) {
    return template.replace("{name}", customer.name).replace("{phone}", customer.phone)
  }

  async function copyMessage(customer: Customer) {
    await navigator.clipboard.writeText(buildMessage(customer))
    setCopied(customer.id)
    setTimeout(() => setCopied(null), 2000)
  }

  async function copyAll() {
    const all = filteredCustomers
      .map((c) => `【${c.name} ${c.phone}】\n${buildMessage(c)}`)
      .join("\n\n---\n\n")
    await navigator.clipboard.writeText(all)
    setCopied("all")
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <MessageSquare className="h-4 w-4" />
          群發通知
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>群發通知訊息</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {/* Filter */}
          <div className="space-y-2">
            <Label>篩選對象</Label>
            <div className="flex gap-2 flex-wrap">
              {[
                { value: "all", label: `全部客人（${customers.length}）` },
                { value: "level", label: "指定會員等級" },
                { value: "inactive", label: "超過 N 天未到店" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setFilterType(opt.value as any)}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    filterType === opt.value
                      ? "border-indigo-500 bg-indigo-600 text-white"
                      : "border-gray-200 text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {filterType === "level" && (
              <select
                value={levelId}
                onChange={(e) => setLevelId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">請選擇會員等級</option>
                {memberLevels.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            )}

            {filterType === "inactive" && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-600">超過</span>
                <input
                  type="number"
                  value={inactiveDays}
                  onChange={(e) => setInactiveDays(e.target.value)}
                  className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-center"
                  min="1"
                />
                <span className="text-sm text-gray-600">天未到店 — 符合 {filteredCustomers.length} 位</span>
              </div>
            )}
          </div>

          {/* Template */}
          <div className="space-y-1.5">
            <Label>訊息範本</Label>
            <p className="text-xs text-gray-400">可用變數：{"{name}"} 客人姓名、{"{phone}"} 電話</p>
            <Textarea
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              rows={5}
            />
          </div>

          {/* Preview + Copy all */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">共 {filteredCustomers.length} 位符合條件</p>
            <Button size="sm" variant="outline" onClick={copyAll}>
              {copied === "all" ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              複製全部
            </Button>
          </div>

          {/* Customer list */}
          <div className="space-y-2 max-h-72 overflow-y-auto border border-gray-100 rounded-lg">
            {filteredCustomers.length === 0 ? (
              <p className="p-4 text-center text-sm text-gray-400">無符合條件的客人</p>
            ) : (
              filteredCustomers.map((c) => (
                <div key={c.id} className="flex items-start justify-between px-3 py-2.5 border-b border-gray-50 last:border-0">
                  <div className="min-w-0">
                    <p className="font-medium text-sm text-gray-900">{c.name} <span className="text-gray-400 font-normal">{c.phone}</span></p>
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{buildMessage(c).split("\n")[0]}</p>
                  </div>
                  <button
                    onClick={() => copyMessage(c)}
                    className="ml-2 shrink-0 text-indigo-500 hover:text-indigo-700"
                  >
                    {copied === c.id ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
