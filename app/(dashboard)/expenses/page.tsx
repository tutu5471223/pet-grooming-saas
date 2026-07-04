"use client"

import { useState, useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { format, parseISO, subMonths, addMonths } from "date-fns"
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  Receipt,
  Pencil,
  Trash2,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

const CATEGORIES = ["耗材", "租金", "薪資", "設備", "其他"]

const CATEGORY_COLORS: Record<string, string> = {
  耗材: "bg-blue-100 text-blue-700",
  租金: "bg-orange-100 text-orange-700",
  薪資: "bg-green-100 text-green-700",
  設備: "bg-purple-100 text-purple-700",
  其他: "bg-gray-100 text-gray-700",
}

interface Expense {
  id: string
  date: string
  category: string
  description: string
  amount: number
  creator: { name: string } | null
  createdAt: string
}

function toMonthStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function monthLabel(d: Date) {
  return `${d.getFullYear()}年 ${String(d.getMonth() + 1).padStart(2, "0")}月`
}

const EMPTY_FORM = { date: format(new Date(), "yyyy-MM-dd"), category: "耗材", description: "", amount: "" }

export default function ExpensesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [month, setMonth] = useState(() => toMonthStr(new Date()))
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [error, setError] = useState("")

  const monthDate = parseISO(`${month}-01`)
  const isCurrentMonth = month === toMonthStr(new Date())

  async function loadExpenses() {
    setLoading(true)
    const res = await fetch(`/api/expenses?month=${month}`)
    const data = await res.json()
    setExpenses(data)
    setLoading(false)
  }

  useEffect(() => { loadExpenses() }, [month])

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "OWNER") {
      router.replace("/dashboard")
    }
  }, [status, session, router])

  if (status === "loading" || (status === "authenticated" && session?.user?.role !== "OWNER")) {
    return <div className="p-6 text-gray-500">載入中...</div>
  }

  const total = expenses.reduce((s, e) => s + e.amount, 0)

  function openEdit(expense: Expense) {
    setEditingExpense(expense)
    setForm({
      date: format(new Date(expense.date), "yyyy-MM-dd"),
      category: expense.category,
      description: expense.description,
      amount: String(expense.amount),
    })
    setError("")
    setShowDialog(true)
  }

  function openNew() {
    setEditingExpense(null)
    setForm(EMPTY_FORM)
    setError("")
    setShowDialog(true)
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault()
    setError("")
    if (!form.description.trim()) { setError("請輸入說明"); return }
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      setError("請輸入有效金額")
      return
    }
    setSubmitting(true)
    const payload = {
      date: form.date,
      category: form.category,
      description: form.description,
      amount: Number(form.amount),
    }
    const res = editingExpense
      ? await fetch(`/api/expenses/${editingExpense.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
    setSubmitting(false)
    if (!res.ok) { setError(editingExpense ? "更新失敗，請再試一次" : "新增失敗，請再試一次"); return }
    setShowDialog(false)
    setEditingExpense(null)
    await loadExpenses()
  }

  async function handleDelete(id: string) {
    if (!confirm("確定要刪除這筆支出嗎？")) return
    setDeletingId(id)
    await fetch(`/api/expenses/${id}`, { method: "DELETE" })
    setDeletingId(null)
    await loadExpenses()
  }

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">支出管理</h1>
          <p className="text-sm text-gray-500 mt-1">{monthLabel(monthDate)} 支出記錄</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Month navigator */}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl px-2 py-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setMonth(toMonthStr(subMonths(monthDate, 1)))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium text-gray-700 min-w-[90px] text-center">
              {monthLabel(monthDate)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setMonth(toMonthStr(addMonths(monthDate, 1)))}
              disabled={isCurrentMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={openNew} className="shrink-0">
            <Plus className="h-4 w-4 mr-1" />
            新增支出
          </Button>
        </div>
      </div>

      {/* Summary card */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="h-4 w-4 text-red-500" />
            <span className="text-sm text-gray-500">本月支出合計</span>
          </div>
          <p className="text-3xl font-bold text-red-600">{formatCurrency(total)}</p>
          <p className="text-xs text-gray-400 mt-1">共 {expenses.length} 筆記錄</p>
        </CardContent>
      </Card>

      {/* Expense list */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : expenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 py-16 text-gray-400">
          <Receipt className="h-12 w-12 mb-3" />
          <p className="text-base font-medium">本月尚無支出記錄</p>
          <p className="text-sm mt-1">點擊「新增支出」開始記錄</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">支出明細</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-50">
              {expenses.map((expense) => (
                <div key={expense.id} className="flex items-center justify-between px-5 py-3.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="text-center shrink-0 w-14">
                      <p className="text-xs text-gray-400">{format(new Date(expense.date), "MM/dd")}</p>
                    </div>
                    <Badge className={`text-xs shrink-0 ${CATEGORY_COLORS[expense.category] ?? "bg-gray-100 text-gray-700"}`}>
                      {expense.category}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{expense.description}</p>
                      {expense.creator && (
                        <p className="text-xs text-gray-400">記錄者：{expense.creator.name}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <p className="text-sm font-semibold text-red-600">
                      -{formatCurrency(expense.amount)}
                    </p>
                    <button
                      onClick={() => openEdit(expense)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                      title="編輯"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(expense.id)}
                      disabled={deletingId === expense.id}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      title="刪除"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* New expense dialog */}
      <Dialog open={showDialog} onOpenChange={(o) => { setShowDialog(o); if (!o) setEditingExpense(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingExpense ? "編輯支出" : "新增支出"}</DialogTitle>
            <DialogDescription>{editingExpense ? "修改支出資料後確認更新" : "填寫日期、類別、說明與金額後確認新增"}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="exp-date">日期</Label>
              <Input
                id="exp-date"
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="exp-category">類別</Label>
              <select
                id="exp-category"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="exp-desc">說明</Label>
              <Textarea
                id="exp-desc"
                placeholder="例：七月耗材採購"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="exp-amount">金額（元）</Label>
              <Input
                id="exp-amount"
                type="number"
                min="1"
                placeholder="0"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="mt-1.5"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                取消
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "儲存中..." : editingExpense ? "確認更新" : "確認新增"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
