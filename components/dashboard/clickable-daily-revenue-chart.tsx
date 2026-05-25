"use client"

import { useRouter } from "next/navigation"
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
import { useState } from "react"

interface Props {
  data: { day: string; revenue: number }[]
  month: string // "YYYY-MM"
}

export function ClickableDailyRevenueChart({ data, month }: Props) {
  const router = useRouter()
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  function handleBarClick(barData: { day: string; revenue: number }) {
    const paddedDay = String(barData.day).padStart(2, "0")
    const dateStr = `${month}-${paddedDay}`
    router.push(`/reports?tab=income&month=${month}&from=${dateStr}&to=${dateStr}`)
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart
        data={data}
        margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="day"
          tick={{ fontSize: 11, fill: "#6b7280" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#6b7280" }}
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
          contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
          labelFormatter={(label) => `${month}-${String(label).padStart(2, "0")} 點擊查看明細`}
          cursor={{ fill: "#eef2ff" }}
        />
        <Bar
          dataKey="revenue"
          name="收入"
          radius={[3, 3, 0, 0]}
          onClick={(barData) => handleBarClick(barData as unknown as { day: string; revenue: number })}
          onMouseEnter={(_, index) => setActiveIndex(index)}
          onMouseLeave={() => setActiveIndex(null)}
          style={{ cursor: "pointer" }}
        >
          {data.map((_, index) => (
            <Cell
              key={index}
              fill={activeIndex === index ? "#4f46e5" : "#6366f1"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
