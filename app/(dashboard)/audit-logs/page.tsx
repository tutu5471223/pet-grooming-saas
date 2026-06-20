import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { format } from "date-fns"
import { ClipboardList, Filter } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  CREATE_APPOINTMENT: { label: "建立預約", color: "bg-blue-100 text-blue-700" },
  UPDATE_APPOINTMENT: { label: "更新預約", color: "bg-blue-100 text-blue-700" },
  CANCEL_APPOINTMENT: { label: "取消預約", color: "bg-gray-100 text-gray-700" },
  CREATE_CUSTOMER: { label: "建立客人", color: "bg-green-100 text-green-700" },
  UPDATE_CUSTOMER: { label: "更新客人", color: "bg-green-100 text-green-700" },
  MERGE_CUSTOMER: { label: "合併客人", color: "bg-yellow-100 text-yellow-700" },
  REFUND_PAYMENT: { label: "退款", color: "bg-red-100 text-red-700" },
  CREATE_RECEIVABLE: { label: "建立應收款", color: "bg-orange-100 text-orange-700" },
  UPDATE_RECEIVABLE: { label: "更新應收款", color: "bg-orange-100 text-orange-700" },
  DELETE_RECEIVABLE: { label: "刪除應收款", color: "bg-red-100 text-red-700" },
  SYNC_MEMBER_TIERS: { label: "同步會員等級", color: "bg-purple-100 text-purple-700" },
  CREATE_PAYMENT: { label: "建立付款", color: "bg-teal-100 text-teal-700" },
  UPDATE_CUSTOMER_FLAG: { label: "標記客人", color: "bg-yellow-100 text-yellow-700" },
  DELETE_CUSTOMER: { label: "刪除客人", color: "bg-red-100 text-red-700" },
  UPDATE_PAYMENT: { label: "更新付款", color: "bg-teal-100 text-teal-700" },
}

const RESOURCE_FILTERS = [
  { value: "", label: "全部" },
  { value: "Appointment", label: "預約" },
  { value: "Customer", label: "客人" },
  { value: "Payment", label: "付款" },
  { value: "MemberLevel", label: "會員等級" },
]

function DetailView({ detail }: { detail: string | null }) {
  if (!detail) return <span className="text-gray-400">—</span>
  try {
    const obj = JSON.parse(detail)
    return (
      <span className="font-mono text-xs text-gray-500">
        {Object.entries(obj)
          .filter(([, v]) => v !== null && v !== undefined)
          .map(([k, v]) => `${k}: ${v}`)
          .join("　")}
      </span>
    )
  } catch {
    return <span className="text-xs text-gray-500">{detail}</span>
  }
}

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ resource?: string }>
}) {
  const session = await auth()
  if (!session) redirect("/login")
  if (session.user.role !== "OWNER") redirect("/dashboard")

  const shopId = session.user.shopId
  const { resource = "" } = await searchParams

  const logs = await prisma.auditLog.findMany({
    where: {
      shopId,
      ...(resource ? { resource } : {}),
    },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">操作記錄</h1>
        <p className="text-sm text-gray-500 mt-1">所有系統操作的完整稽核日誌（最新 100 筆）</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> 稽核日誌
          </CardTitle>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <div className="flex gap-1">
              {RESOURCE_FILTERS.map((f) => (
                <Link
                  key={f.value}
                  href={`/audit-logs${f.value ? `?resource=${f.value}` : ""}`}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                    resource === f.value ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {f.label}
                </Link>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <ClipboardList className="h-10 w-10 mb-2" />
              <p className="text-sm">尚無操作記錄</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="pb-3 text-left font-medium text-gray-500 whitespace-nowrap">時間</th>
                    <th className="pb-3 text-left font-medium text-gray-500">操作人員</th>
                    <th className="pb-3 text-left font-medium text-gray-500">動作</th>
                    <th className="pb-3 text-left font-medium text-gray-500">資源</th>
                    <th className="pb-3 text-left font-medium text-gray-500">詳細</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.map((log) => {
                    const actionInfo = ACTION_LABELS[log.action]
                    return (
                      <tr key={log.id} className="hover:bg-gray-50/50">
                        <td className="py-3 pr-4 whitespace-nowrap text-gray-500 text-xs">
                          {format(new Date(log.createdAt), "MM/dd HH:mm:ss")}
                        </td>
                        <td className="py-3 pr-4 text-gray-700">
                          {log.user?.name ?? "系統"}
                        </td>
                        <td className="py-3 pr-4">
                          {actionInfo ? (
                            <Badge className={`text-xs ${actionInfo.color}`}>
                              {actionInfo.label}
                            </Badge>
                          ) : (
                            <span className="text-xs text-gray-500 font-mono">{log.action}</span>
                          )}
                        </td>
                        <td className="py-3 pr-4 text-gray-500 text-xs">
                          {log.resource}
                          {log.resourceId && (
                            <span className="ml-1 font-mono text-gray-400">{log.resourceId.slice(0, 8)}…</span>
                          )}
                        </td>
                        <td className="py-3 max-w-[300px]">
                          <DetailView detail={log.detail} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
