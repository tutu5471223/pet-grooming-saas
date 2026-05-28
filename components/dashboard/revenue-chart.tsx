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

interface RevenueChartProps {
  data: { month: string; yearMonth: string; revenue: number }[]
}

export function RevenueChart({ data }: RevenueChartProps) {
  const router = useRouter()

  function handleBarClick(entry: { yearMonth?: string }) {
    if (entry.yearMonth) {
      router.push(`/reports?month=${entry.yearMonth}`)
    }
  }

  return (
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
          cursor="pointer"
          onClick={(entry) => handleBarClick(entry as { yearMonth?: string })}
        >
          {data.map((entry, index) => (
            <Cell
              key={index}
              fill="#6366f1"
              className="hover:opacity-80 transition-opacity"
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
