"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { use } from "react"
import Link from "next/link"
import { ArrowLeft, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

interface Customer {
  id: string
  name: string
  phone: string
  lineId: string | null
  address: string | null
  notes: string | null
  memberLevelId: string | null
}

interface MemberLevel {
  id: string
  name: string
  color: string
  minPoints: number
}

export default function CustomerEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [memberLevels, setMemberLevels] = useState<MemberLevel[]>([])
  const [form, setForm] = useState({
    name: "",
    phone: "",
    lineId: "",
    address: "",
    notes: "",
    memberLevelId: "",
  })
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [error, setError] = useState("")
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/customers/${id}`).then((r) => r.json()),
      fetch("/api/member-levels").then((r) => r.json()),
    ])
      .then(([data, levels]: [Customer, MemberLevel[]]) => {
        setCustomer(data)
        setMemberLevels(levels)
        setForm({
          name: data.name,
          phone: data.phone,
          lineId: data.lineId ?? "",
          address: data.address ?? "",
          notes: data.notes ?? "",
          memberLevelId: data.memberLevelId ?? "",
        })
      })
      .catch(() => setError("無法載入客人資料"))
      .finally(() => setFetching(false))
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          lineId: form.lineId || null,
          address: form.address || null,
          notes: form.notes || null,
          memberLevelId: form.memberLevelId || null,
        }),
      })
      if (!res.ok) throw new Error("儲存失敗")
      router.push(`/customers/${id}`)
      router.refresh()
    } catch {
      setError("儲存失敗，請再試一次")
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/customers/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("刪除失敗")
      router.push("/customers")
      router.refresh()
    } catch {
      setError("刪除失敗，請再試一次")
      setShowDeleteDialog(false)
    } finally {
      setDeleting(false)
    }
  }

  if (fetching) {
    return (
      <div className="p-6 flex items-center justify-center h-64 text-gray-400">
        載入中...
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/customers/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">編輯客人資料</h1>
          <p className="text-sm text-gray-500 mt-0.5">{customer?.name}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">基本資料</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">姓名 *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">電話 *</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="lineId">LINE ID</Label>
              <Input
                id="lineId"
                placeholder="選填"
                value={form.lineId}
                onChange={(e) => setForm({ ...form, lineId: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="memberLevelId">會員等級（手動指定）</Label>
              <select
                id="memberLevelId"
                value={form.memberLevelId}
                onChange={(e) => setForm({ ...form, memberLevelId: e.target.value })}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">自動（依點數升等）</option>
                {memberLevels.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}（{level.minPoints} 點以上）
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400">手動指定等級後，系統自動升等規則仍會運作，下次同步時可能被覆蓋</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="address">地址</Label>
              <Input
                id="address"
                placeholder="選填"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes">備註</Label>
              <Textarea
                id="notes"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="flex gap-3 pt-2">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "儲存中..." : "儲存變更"}
              </Button>
              <Link href={`/customers/${id}`}>
                <Button type="button" variant="outline">取消</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-200">
        <CardHeader>
          <CardTitle className="text-base text-red-700">危險區域</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">刪除此客人</p>
              <p className="text-xs text-gray-500 mt-0.5">
                刪除後客人及所有寵物資料將無法復原
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4" />
              刪除客人
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認刪除客人</DialogTitle>
            <DialogDescription>
              確定要刪除「{customer?.name}」嗎？此操作將同時刪除名下所有寵物及相關資料，且<strong>無法復原</strong>。
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 pt-2">
            <Button
              variant="destructive"
              className="flex-1"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? "刪除中..." : "確認刪除"}
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowDeleteDialog(false)}
            >
              取消
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
