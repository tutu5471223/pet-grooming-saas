"use client"

import { useState, useEffect } from "react"
import { format, differenceInDays } from "date-fns"
import { CreditCard, Users, Scissors, Calendar, AlertTriangle, AlertCircle, ChevronRight, Check, Clock } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"

const UNLIMITED = 999999

interface SubscriptionData {
  subscription: {
    status: string
    currentPeriodEnd: string
    plan: {
      name: string
      price: number
      maxCustomers: number
      maxPets: number
      maxStaff: number
      features: string
    }
  } | null
  customerCount: number
  staffCount: number
  monthlyAppointmentCount: number
}

const STATUS_META: Record<string, { label: string; border: string; text: string; bg: string }> = {
  TRIAL:    { label: "免費試用中", border: "border-blue-200",  text: "text-blue-700",  bg: "bg-blue-50" },
  ACTIVE:   { label: "訂閱中",    border: "border-green-200", text: "text-green-700", bg: "bg-green-50" },
  PAST_DUE: { label: "付款逾期",  border: "border-red-200",   text: "text-red-700",   bg: "bg-red-50" },
  CANCELLED:{ label: "已取消",    border: "border-gray-200",  text: "text-gray-600",  bg: "bg-gray-50" },
}

interface UsageBarProps {
  label: string
  current: number
  max: number
  icon: React.ElementType
  isUnlimited?: boolean
}

function UsageBar({ label, current, max, icon: Icon }: UsageBarProps) {
  const unlimited = max >= UNLIMITED
  const rawPct = unlimited ? 0 : (current / max) * 100
  const pct = Math.min(rawPct, 100)

  const barColor = rawPct >= 95 ? "bg-red-500" : rawPct >= 80 ? "bg-yellow-400" : "bg-indigo-500"
  const textColor = rawPct >= 95 ? "text-red-600" : rawPct >= 80 ? "text-orange-600" : "text-gray-900"

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-gray-400 shrink-0" />
          <span className="text-sm text-gray-700 font-medium">{label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${textColor}`}>
            {current.toLocaleString()}
            {!unlimited && ` / ${max.toLocaleString()}`}
          </span>
          {unlimited && <span className="text-xs text-gray-400">無限制</span>}
          {!unlimited && (
            <span className={`text-xs rounded-full px-1.5 py-0.5 font-medium ${
              rawPct >= 95 ? "bg-red-100 text-red-700" :
              rawPct >= 80 ? "bg-yellow-100 text-yellow-700" :
              "bg-gray-100 text-gray-500"
            }`}>
              {rawPct.toFixed(0)}%
            </span>
          )}
        </div>
      </div>
      {!unlimited && (
        <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
          <div
            className={`h-2.5 rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}

function CounterStat({ label, value, icon: Icon }: { label: string; value: number; icon: React.ElementType }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-gray-400" />
        <span className="text-sm text-gray-700">{label}</span>
      </div>
      <span className="text-sm font-bold text-gray-900">{value.toLocaleString()} 筆</span>
    </div>
  )
}

export function SubscriptionInfo() {
  const [data, setData] = useState<SubscriptionData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/subscription")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="animate-pulse h-32 rounded-xl bg-gray-100" />
        ))}
      </div>
    )
  }

  const sub = data?.subscription
  const meta = sub ? (STATUS_META[sub.status] ?? STATUS_META.CANCELLED) : null
  const daysLeft = sub ? Math.max(0, differenceInDays(new Date(sub.currentPeriodEnd), new Date())) : 0
  const isTrial = sub?.status === "TRIAL"
  const isUnlimitedPlan = (sub?.plan.maxCustomers ?? 0) >= UNLIMITED

  const customerCount = data?.customerCount ?? 0
  const staffCount = data?.staffCount ?? 0
  const maxCustomers = sub?.plan.maxCustomers ?? 50
  const maxStaff = sub?.plan.maxStaff ?? 2
  const customerPct = maxCustomers < UNLIMITED ? (customerCount / maxCustomers) * 100 : 0

  let features: string[] = []
  try { features = sub ? JSON.parse(sub.plan.features) : [] } catch { features = [] }

  // Banner determination
  const showTrialExpiring = isTrial && daysLeft <= 3
  const showCustomerOver100 = maxCustomers < UNLIMITED && customerPct >= 100
  const showCustomerOver90 = !showCustomerOver100 && maxCustomers < UNLIMITED && customerPct >= 90

  return (
    <div className="space-y-4">

      {/* ── Critical banners (only one shown at a time, in priority order) ── */}
      {showCustomerOver100 && (
        <div className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-4">
          <AlertCircle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-red-700">已達客人數上限，無法新增客人</p>
            <p className="text-xs text-red-600 mt-0.5">
              目前 {customerCount} 位客人，已達方案上限（{maxCustomers} 位）。請升級方案以繼續服務更多客人。
            </p>
          </div>
          <Link href="/pricing" className="shrink-0">
            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white">立即升級</Button>
          </Link>
        </div>
      )}

      {showCustomerOver90 && (
        <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-orange-800">客人數即將達到上限</p>
            <p className="text-xs text-orange-700 mt-0.5">
              您的客人數（{customerCount} 位）已達方案上限 {customerPct.toFixed(0)}%。升級方案可容納更多客人。
            </p>
          </div>
          <Link href="/pricing" className="shrink-0">
            <Button size="sm" variant="outline" className="border-orange-300 text-orange-700 hover:bg-orange-100">
              查看升級方案
            </Button>
          </Link>
        </div>
      )}

      {showTrialExpiring && !showCustomerOver100 && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <Clock className="h-5 w-5 text-red-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-red-700">試用期即將結束！</p>
            <p className="text-xs text-red-600 mt-0.5">
              僅剩 <strong>{daysLeft}</strong> 天，升級後可繼續使用完整功能。
            </p>
          </div>
          <Link href="/pricing" className="shrink-0">
            <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white shrink-0">立即升級</Button>
          </Link>
        </div>
      )}

      {/* ── Plan card ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-gray-500" /> 目前訂閱方案
          </CardTitle>
          <Link href="/pricing">
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs">
              查看所有方案 <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="space-y-5">
          {sub ? (
            <>
              {/* Plan header */}
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xl font-bold text-gray-900">{sub.plan.name}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {sub.plan.price === 0 ? "免費" : `NT$${sub.plan.price.toLocaleString()} / 月`}
                  </p>
                </div>
                {meta && (
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${meta.border} ${meta.text} ${meta.bg}`}>
                    {meta.label}
                  </span>
                )}
              </div>

              {/* Expiry + countdown */}
              <div className={`rounded-xl border px-4 py-3 space-y-2 ${isTrial && daysLeft <= 7 ? "border-orange-200 bg-orange-50" : "border-gray-100 bg-gray-50"}`}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{isTrial ? "試用到期日" : "下次續訂日"}</span>
                  <span className="font-semibold text-gray-900">
                    {format(new Date(sub.currentPeriodEnd), "yyyy 年 MM 月 dd 日")}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">{isTrial ? "距離試用結束還有" : "距到期"}</span>
                  <span className={`font-bold ${
                    daysLeft <= 3 ? "text-red-600" : daysLeft <= 7 ? "text-orange-600" : "text-gray-900"
                  }`}>
                    {daysLeft === 0 ? "今日到期" : `${daysLeft} 天`}
                  </span>
                </div>
              </div>

              {/* Usage bars */}
              <div className="space-y-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">用量使用狀況</p>
                <UsageBar label="客人數" current={customerCount} max={maxCustomers} icon={Users} />
                <UsageBar label="員工數" current={staffCount} max={maxStaff} icon={Scissors} />
                {!isUnlimitedPlan && (
                  <div className="pt-1 border-t border-gray-100">
                    <CounterStat label="本月新增預約" value={data?.monthlyAppointmentCount ?? 0} icon={Calendar} />
                  </div>
                )}
              </div>

              {/* Feature list */}
              {features.length > 0 && (
                <div className="space-y-2 pt-1 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">方案包含功能</p>
                  <ul className="grid grid-cols-2 gap-1.5">
                    {features.map((f: string) => (
                      <li key={f} className="flex items-start gap-1.5 text-xs text-gray-600">
                        <Check className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <CreditCard className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm mb-4">尚無訂閱記錄</p>
              <Link href="/pricing">
                <Button size="sm">查看方案</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upgrade prompt for near-limit or expiring */}
      {(customerPct >= 70 || (isTrial && daysLeft <= 10)) && !showCustomerOver100 && (
        <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-indigo-900">升級到付費方案</p>
                <p className="text-xs text-indigo-600 mt-1">
                  {isUnlimitedPlan ? "您已使用專業版，享有完整功能" : "解除用量限制，享有完整功能支援"}
                </p>
              </div>
              {!isUnlimitedPlan && (
                <Link href="/pricing">
                  <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 gap-1.5">
                    升級方案 <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
