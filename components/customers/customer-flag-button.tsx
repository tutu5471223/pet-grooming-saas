"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Flag } from "lucide-react"

const FLAG_OPTIONS = [
  { value: "", label: "無標記", icon: "—" },
  { value: "WARNING", label: "⚠️ 注意", icon: "⚠️" },
  { value: "BLOCKED", label: "🚫 拒絕服務", icon: "🚫" },
  { value: "VIP", label: "⭐ VIP 特別關照", icon: "⭐" },
]

interface CustomerFlagButtonProps {
  customerId: string
  currentFlagType?: string | null
  currentFlagNote?: string | null
}

export function CustomerFlagButton({
  customerId,
  currentFlagType,
  currentFlagNote,
}: CustomerFlagButtonProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [flagType, setFlagType] = useState(currentFlagType ?? "")
  const [flagNote, setFlagNote] = useState(currentFlagNote ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    await fetch(`/api/customers/${customerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ flagType, flagNote }),
    })
    setSaving(false)
    setOpen(false)
    router.refresh()
  }

  const currentFlag = FLAG_OPTIONS.find((f) => f.value === (currentFlagType ?? ""))

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={
          currentFlagType === "BLOCKED"
            ? "border-red-300 text-red-600 hover:bg-red-50"
            : currentFlagType === "WARNING"
            ? "border-yellow-300 text-yellow-700 hover:bg-yellow-50"
            : currentFlagType === "VIP"
            ? "border-yellow-400 text-yellow-600 hover:bg-yellow-50"
            : ""
        }
      >
        <Flag className="h-4 w-4" />
        {currentFlag ? currentFlag.label : "設定標記"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>客人特殊標記</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>標記類型</Label>
              <div className="flex flex-col gap-2">
                {FLAG_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFlagType(opt.value)}
                    className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 text-left text-sm transition-colors ${
                      flagType === opt.value
                        ? "border-indigo-500 bg-indigo-50 text-indigo-900"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <span className="text-base">{opt.icon}</span>
                    <span className="font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>備註說明</Label>
              <Input
                placeholder="例：容易咬人、過敏史..."
                value={flagNote}
                onChange={(e) => setFlagNote(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? "儲存中..." : "儲存"}
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
