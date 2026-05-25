import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user.isSuperAdmin) redirect("/dashboard")
  return <>{children}</>
}
