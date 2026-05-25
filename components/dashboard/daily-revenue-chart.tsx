"use client"

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

export function DailyRevenueChart({ data }: { data: { day: string; revenue: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
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
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
          }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#6366f1"
          fill="#eef2ff"
          name="收入"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
