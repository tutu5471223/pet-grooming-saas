"use client"

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

interface WeekdayChartProps {
  data: { day: string; count: number }[]
}

export function WeekdayChart({ data }: WeekdayChartProps) {
  const maxCount = Math.max(...data.map((d) => d.count), 1)

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 12, fill: "#6b7280" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <YAxis
          dataKey="day"
          type="category"
          tick={{ fontSize: 13, fill: "#374151" }}
          axisLine={false}
          tickLine={false}
          width={28}
        />
        <Tooltip
          formatter={(value) => [`${value} 筆`, "預約數"]}
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
            boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
          }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]} name="預約數">
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.count === maxCount && maxCount > 0 ? "#6366f1" : "#a5b4fc"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
