import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    minimumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—"
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Taipei",
  }).format(new Date(date))
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—"
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Taipei",
  }).format(new Date(date))
}

export function genderLabel(gender: string): string {
  const map: Record<string, string> = {
    MALE: "公",
    FEMALE: "母",
    UNKNOWN: "未知",
  }
  return map[gender] ?? gender
}

export function contractStatusLabel(status: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    PENDING: { label: "未簽署", color: "text-yellow-600 bg-yellow-50" },
    SIGNED: { label: "已簽署", color: "text-green-600 bg-green-50" },
    EXPIRED: { label: "已過期", color: "text-red-600 bg-red-50" },
  }
  return map[status] ?? { label: status, color: "text-gray-600 bg-gray-50" }
}

export function appointmentStatusLabel(status: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    PENDING: { label: "待確認", color: "text-yellow-600 bg-yellow-50" },
    CONFIRMED: { label: "已確認", color: "text-blue-600 bg-blue-50" },
    IN_PROGRESS: { label: "進行中", color: "text-purple-600 bg-purple-50" },
    COMPLETED: { label: "已完成", color: "text-green-600 bg-green-50" },
    CANCELLED: { label: "已取消", color: "text-gray-600 bg-gray-50" },
    NO_SHOW: { label: "未到店", color: "text-red-600 bg-red-50" },
  }
  return map[status] ?? { label: status, color: "text-gray-600 bg-gray-50" }
}

export function boardingStatusLabel(status: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    RESERVED: { label: "已預訂", color: "text-blue-600 bg-blue-50" },
    STAYING: { label: "住宿中", color: "text-green-600 bg-green-50" },
    CHECKED_OUT: { label: "已退房", color: "text-gray-600 bg-gray-50" },
  }
  return map[status] ?? { label: status, color: "text-gray-600 bg-gray-50" }
}

export function paymentMethodLabel(method: string): string {
  const map: Record<string, string> = {
    CASH: "現金",
    CARD: "刷卡",
    TRANSFER: "轉帳",
    STORED_VALUE: "儲值金",
    LINE_PAY: "LINE Pay",
    JKOPAY: "街口支付",
    MONTHLY: "記帳（月結）",
    OTHER: "其他",
  }
  return map[method] ?? method
}
