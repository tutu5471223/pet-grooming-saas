export interface StaffPermissions {
  reports?: boolean
  expenses?: boolean
  void?: boolean
  refund?: boolean
  settings?: boolean
  staff?: boolean
}

export const PERMISSION_LIST: { key: keyof StaffPermissions; label: string }[] = [
  { key: "reports", label: "查看營收報表" },
  { key: "expenses", label: "查看支出管理" },
  { key: "void", label: "作廢帳款" },
  { key: "refund", label: "退款" },
  { key: "settings", label: "系統設定" },
  { key: "staff", label: "員工管理" },
]

export function parsePermissions(raw: unknown): StaffPermissions {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  return raw as StaffPermissions
}

export function hasPermission(
  role: string,
  permissions: StaffPermissions,
  perm: keyof StaffPermissions
): boolean {
  if (role === "OWNER") return true
  return permissions[perm] === true
}
