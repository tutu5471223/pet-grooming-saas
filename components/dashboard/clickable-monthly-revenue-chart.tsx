"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"

interface Props {
  data: { month: string; monthKey: string; revenue: number }[]
  currentMonth: string
}

export function ClickableMonthlyRevenueChart({ data, currentMonth }: Props) {
  const router = useRouter()
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  function handleBarClick(barData: unknown) {
    const item = barData as { month: string; monthKey: string; revenue: number }
    router.push(`/reports?tab=income&month=${item.monthKey}`)
  }

  return (
    <div className="relative">
      <p className="text-xs text-gray-400 mb-2 text-right">點擊柱狀圖可查看當月收入明細</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: "#6b7280" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "#6b7280" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            formatter={(value) =>
              new Intl.NumberFormat("zh-TW", {
                style: "currency",
                currency: "TWD",
                minimumFractionDigits: 0,
              }).format(Number(value))
            }
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid #e5e7eb",
              boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
            }}
          />
          <Bar
            dataKey="revenue"
            radius={[4, 4, 0, 0]}
            name="收入"
            onClick={(barData) => handleBarClick(barData)}
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(null)}
            style={{ cursor: "pointer" }}
          >
            {data.map((entry, index) => (
              <Cell
                key={entry.monthKey}
                fill={
                  entry.monthKey === currentMonth
                    ? "#4f46e5"
                    : activeIndex === index
                    ? "#818cf8"
                    : "#6366f1"
                }
                opacity={activeIndex !== null && activeIndex !== index ? 0.6 : 1}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
