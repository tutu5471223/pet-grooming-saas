"use client"

import { useState } from "react"
import { Plus, UserCheck, UserX, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { formatDate } from "@/lib/utils"
import { PERMISSION_LIST, type StaffPermissions } from "@/lib/permissions"

interface Staff {
  id: string
  name: string
  email: string | null
  role: string
  isActive: boolean
  createdAt: string
  permissions: StaffPermissions | null
}

interface StaffManagerProps {
  initialStaff: Staff[]
  currentUserId: string
  isAdmin: boolean
}

const ROLES = [
  { value: "OWNER", label: "管理員" },
  { value: "GROOMER", label: "美容師" },
  { value: "STAFF", label: "櫃台" },
]

function roleLabel(role: string) {
  return ROLES.find((r) => r.value === role)?.label ?? role
}

export function StaffManager({ initialStaff, currentUserId, isAdmin }: StaffManagerProps) {
  const [staff, setStaff] = useState<Staff[]>(initialStaff)
  const [showAdd, setShowAdd] = useState(false)
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState("")
  const [toggleLoadingId, setToggleLoadingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "GROOMER" })
  const [permStaff, setPermStaff] = useState<Staff | null>(null)
  const [permForm, setPermForm] = useState<StaffPermissions>({})
  const [permSaving, setPermSaving] = useState(false)
  const [permError, setPermError] = useState("")

  function handleCloseAdd() {
    setShowAdd(false)
    setAddError("")
    setForm({ name: "", email: "", password: "", role: "GROOMER" })
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setAddLoading(true)
    setAddError("")
    try {
      const res = await fetch("/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "新增失敗")
      }
      const newStaff: Staff = await res.json()
      setStaff([...staff, { ...newStaff, permissions: null }])
      handleCloseAdd()
    } catch (err: unknown) {
      setAddError(err instanceof Error ? err.message : "新增失敗")
    } finally {
      setAddLoading(false)
    }
  }

  async function handleToggle(id: string) {
    setToggleLoadingId(id)
    try {
      const res = await fetch(`/api/staff/${id}`, { method: "PATCH" })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "操作失敗")
      }
      const updated: { id: string; isActive: boolean } = await res.json()
      setStaff(staff.map((s) => (s.id === id ? { ...s, isActive: updated.isActive } : s)))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "操作失敗")
    } finally {
      setToggleLoadingId(null)
    }
  }

  function openPermissions(s: Staff) {
    setPermStaff(s)
    setPermForm(s.permissions ?? {})
    setPermError("")
  }

  async function handleSavePermissions() {
    if (!permStaff) return
    setPermSaving(true)
    setPermError("")
    try {
      const res = await fetch(`/api/staff/${permStaff.id}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(permForm),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "儲存失敗")
      }
      const { permissions } = await res.json()
      setStaff(staff.map((s) => (s.id === permStaff.id ? { ...s, permissions } : s)))
      setPermStaff(null)
    } catch (err: unknown) {
      setPermError(err instanceof Error ? err.message : "儲存失敗")
    } finally {
      setPermSaving(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">員工帳號管理</CardTitle>
          {isAdmin && (
            <Button size="sm" onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4" />
              新增員工
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {staff.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">尚未設定員工帳號</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100">
                  <tr>
                    <th className="px-5 py-3 text-left font-medium text-gray-500">姓名</th>
                    <th className="px-5 py-3 text-left font-medium text-gray-500">Email</th>
                    <th className="px-5 py-3 text-left font-medium text-gray-500">角色</th>
                    <th className="px-5 py-3 text-left font-medium text-gray-500">建立日期</th>
                    <th className="px-5 py-3 text-left font-medium text-gray-500">狀態</th>
                    {isAdmin && <th className="px-5 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {staff.map((s) => (
                    <tr key={s.id}>
                      <td className="px-5 py-3 font-medium text-gray-900">
                        {s.name}
                        {s.id === currentUserId && (
                          <span className="ml-1.5 text-xs text-gray-400">（我）</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-600">{s.email ?? <span className="text-gray-400">—</span>}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                          {roleLabel(s.role)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-500">{formatDate(s.createdAt)}</td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            s.isActive
                              ? "bg-green-50 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {s.isActive ? "啟用中" : "已停用"}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-5 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {s.id !== currentUserId && s.role !== "OWNER" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openPermissions(s)}
                                className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                              >
                                <ShieldCheck className="h-4 w-4 mr-1" />
                                權限
                              </Button>
                            )}
                            {s.id !== currentUserId && (
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={toggleLoadingId === s.id}
                                onClick={() => handleToggle(s.id)}
                                className={
                                  s.isActive
                                    ? "text-red-600 hover:text-red-700 hover:bg-red-50"
                                    : "text-green-600 hover:text-green-700 hover:bg-green-50"
                                }
                              >
                                {toggleLoadingId === s.id ? (
                                  "處理中..."
                                ) : s.isActive ? (
                                  <>
                                    <UserX className="h-4 w-4 mr-1" />
                                    停用
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="h-4 w-4 mr-1" />
                                    啟用
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Staff Dialog */}
      <Dialog open={showAdd} onOpenChange={(v) => { if (!v) handleCloseAdd() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增員工帳號</DialogTitle>
            <DialogDescription>姓名為必填；Email 與密碼需同時填寫或同時留空</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="staff-name">姓名 *</Label>
              <Input
                id="staff-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-email">Email（選填）</Label>
              <Input
                id="staff-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="若需登入系統才填"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-password">密碼（選填，若員工需登入系統才填）</Label>
              <Input
                id="staff-password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="至少 8 字元，含英文與數字"
              />
            </div>
            <div className="space-y-1.5">
              <Label>角色</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.filter((r) => r.value !== "OWNER").map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {addError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{addError}</p>
            )}
            <div className="flex gap-3">
              <Button type="submit" disabled={addLoading} className="flex-1">
                {addLoading ? "新增中..." : "確認新增"}
              </Button>
              <Button type="button" variant="outline" onClick={handleCloseAdd}>
                取消
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Permissions Dialog */}
      <Dialog open={!!permStaff} onOpenChange={(v) => { if (!v) setPermStaff(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>權限設定 — {permStaff?.name}</DialogTitle>
            <DialogDescription>勾選要開放給此員工的功能權限，預設全部關閉。</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            {PERMISSION_LIST.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={!!permForm[key]}
                  onChange={(e) => setPermForm({ ...permForm, [key]: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm text-gray-700 group-hover:text-gray-900">{label}</span>
              </label>
            ))}
          </div>
          {permError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{permError}</p>
          )}
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSavePermissions} disabled={permSaving} className="flex-1">
              {permSaving ? "儲存中..." : "儲存權限"}
            </Button>
            <Button variant="outline" onClick={() => setPermStaff(null)} disabled={permSaving}>
              取消
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
