"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { GitMerge, AlertTriangle } from "lucide-react"

interface Customer {
  id: string
  name: string
  phone: string
}

export function CustomerMergeDialog({ customers }: { customers: Customer[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [primaryId, setPrimaryId] = useState("")
  const [secondaryId, setSecondaryId] = useState("")
  const [primarySearch, setPrimarySearch] = useState("")
  const [secondarySearch, setSecondarySearch] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [confirmed, setConfirmed] = useState(false)

  const filterCustomers = (search: string) =>
    customers.filter(
      (c) => c.name.includes(search) || c.phone.includes(search)
    ).slice(0, 5)

  const primary = customers.find((c) => c.id === primaryId)
  const secondary = customers.find((c) => c.id === secondaryId)

  async function handleMerge() {
    if (!primaryId || !secondaryId || primaryId === secondaryId) return
    setError("")
    setSubmitting(true)
    const res = await fetch("/api/customers/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ primaryId, secondaryId }),
    })
    setSubmitting(false)
    if (res.ok) {
      setOpen(false)
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? "合併失敗")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setPrimaryId(""); setSecondaryId(""); setConfirmed(false); setError("") } }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <GitMerge className="h-4 w-4" />
          合併客人
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>合併客人帳號</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 text-sm">
          <p className="text-gray-500">次要客人的所有寵物、預約、付款記錄、儲值、點數將轉移至主要客人，次要帳號將被隱藏。</p>

          {/* Primary */}
          <div className="space-y-1.5">
            <Label>主要客人（保留）</Label>
            {primary ? (
              <div className="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                <span className="font-medium text-green-900">{primary.name} · {primary.phone}</span>
                <button onClick={() => { setPrimaryId(""); setPrimarySearch("") }} className="text-green-400 hover:text-green-600 text-xs">清除</button>
              </div>
            ) : (
              <CustomerPickerInput
                search={primarySearch}
                onSearch={setPrimarySearch}
                results={filterCustomers(primarySearch)}
                onSelect={(c) => { setPrimaryId(c.id); setPrimarySearch("") }}
                exclude={secondaryId}
              />
            )}
          </div>

          {/* Secondary */}
          <div className="space-y-1.5">
            <Label>次要客人（被合併）</Label>
            {secondary ? (
              <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <span className="font-medium text-red-900">{secondary.name} · {secondary.phone}</span>
                <button onClick={() => { setSecondaryId(""); setSecondarySearch("") }} className="text-red-400 hover:text-red-600 text-xs">清除</button>
              </div>
            ) : (
              <CustomerPickerInput
                search={secondarySearch}
                onSearch={setSecondarySearch}
                results={filterCustomers(secondarySearch)}
                onSelect={(c) => { setSecondaryId(c.id); setSecondarySearch("") }}
                exclude={primaryId}
              />
            )}
          </div>

          {primary && secondary && (
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-3 flex gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
              <p className="text-yellow-800 text-xs">
                「{secondary.name}」的所有資料將合併到「{primary.name}」，此操作不可撤銷。
              </p>
            </div>
          )}

          {primary && secondary && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
              我確認要合併這兩位客人
            </label>
          )}

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <div className="flex gap-2">
            <Button
              onClick={handleMerge}
              disabled={!primaryId || !secondaryId || primaryId === secondaryId || !confirmed || submitting}
              className="flex-1"
              variant="destructive"
            >
              {submitting ? "合併中..." : "確認合併"}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function CustomerPickerInput({
  search,
  onSearch,
  results,
  onSelect,
  exclude,
}: {
  search: string
  onSearch: (v: string) => void
  results: { id: string; name: string; phone: string }[]
  onSelect: (c: { id: string; name: string; phone: string }) => void
  exclude: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div className="relative">
      <Input
        placeholder="搜尋姓名或電話..."
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        autoComplete="off"
      />
      {focused && search && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          {results
            .filter((c) => c.id !== exclude)
            .map((c) => (
              <button
                key={c.id}
                type="button"
                className="flex w-full justify-between px-3 py-2 text-sm hover:bg-gray-50 text-left"
                onClick={() => onSelect(c)}
              >
                <span className="font-medium text-gray-900">{c.name}</span>
                <span className="text-gray-500 text-xs">{c.phone}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  )
}
