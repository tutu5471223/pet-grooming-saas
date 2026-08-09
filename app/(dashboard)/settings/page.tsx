import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { parsePermissions } from "@/lib/permissions"
import { Lock } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { headers } from "next/headers"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Scissors, Home, Star, FileText, Users, CreditCard, Link2, Bell, Zap, MessageCircle, ScanLine, Percent } from "lucide-react"
import { ServiceManager } from "@/components/settings/service-manager"
import { RoomManager } from "@/components/settings/room-manager"
import { ContractTemplateEditor } from "@/components/settings/contract-template-editor"
import { MemberLevelManager } from "@/components/settings/member-level-manager"
import { StaffManager } from "@/components/settings/staff-manager"
import { MonthlyPlanManager } from "@/components/settings/monthly-plan-manager"
import { BookingLink } from "@/components/settings/booking-link"
import { MenuLink } from "@/components/settings/menu-link"
import { ReminderSettings } from "@/components/settings/reminder-settings"
import { SubscriptionInfo } from "@/components/settings/subscription-info"
import { LineSettings } from "@/components/settings/line-settings"
import { OcrSettings } from "@/components/settings/ocr-settings"
import { PaymentFeeSettings } from "@/components/settings/payment-fee-settings"

function AccessDeniedTab() {
  return (
    <div className="flex items-center gap-2 py-10 justify-center text-gray-400 text-sm">
      <Lock className="h-4 w-4" />
      僅店主可存取此設定
    </div>
  )
}

async function getSettingsData(shopId: string) {
  const [shop, services, rooms, memberLevels, monthlyPlans, staff] = await Promise.all([
    prisma.shop.findUnique({ where: { id: shopId }, select: {
      id: true, name: true, phone: true, address: true, email: true,
      contractTemplate: true, logoUrl: true, businessHoursStart: true,
      businessHoursEnd: true, restDays: true, reminderTemplate: true,
      lineChannelToken: true, lineChannelId: true, lineChannelSecret: true,
      ocrKeywords: true, status: true, onboardingDone: true, paymentFeeRates: true,
    }}),
    prisma.service.findMany({ where: { shopId }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.boardingRoom.findMany({ where: { shopId }, orderBy: { name: "asc" } }),
    prisma.memberLevel.findMany({ where: { shopId }, orderBy: { minPoints: "asc" } }),
    prisma.monthlyPlan.findMany({ where: { shopId, isActive: true } }),
    prisma.user.findMany({
      where: { shopId },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, permissions: true },
      orderBy: { createdAt: "asc" },
    }),
  ])
  return { shop, services, rooms, memberLevels, monthlyPlans, staff }
}

export default async function SettingsPage() {
  const session = await auth()
  if (!session) redirect("/login")
  const shopId = session.user.shopId
  const currentUserId = session.user.id
  const isAdmin = session.user.role === "OWNER"
  const permissions = parsePermissions(session.user.permissions)
  if (!isAdmin && !permissions.settings && !permissions.staff) redirect("/dashboard")
  const { shop, services, rooms, memberLevels, monthlyPlans, staff } = await getSettingsData(shopId)
  const hdrs = await headers()
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost:3000"
  const proto = host.startsWith("localhost") ? "http" : "https"
  const baseUrl = `${proto}://${host}`

  const staffForClient = staff.map((s) => ({
    ...s,
    createdAt: s.createdAt.toISOString(),
    permissions: (s.permissions ?? null) as import("@/lib/permissions").StaffPermissions | null,
  }))

  return (
    <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">系統設定</h1>
        <p className="text-sm text-gray-500 mt-1">{shop?.name} 的店家設定</p>
      </div>

      <Tabs defaultValue="services">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="services" className="gap-1.5">
            <Scissors className="h-4 w-4" /> 服務項目
          </TabsTrigger>
          <TabsTrigger value="rooms" className="gap-1.5">
            <Home className="h-4 w-4" /> 住宿房間
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-1.5">
            <Star className="h-4 w-4" /> 會員等級
          </TabsTrigger>
          <TabsTrigger value="contract" className="gap-1.5">
            <FileText className="h-4 w-4" /> 合約範本
          </TabsTrigger>
          <TabsTrigger value="staff" className="gap-1.5">
            <Users className="h-4 w-4" /> 員工管理
          </TabsTrigger>
          <TabsTrigger value="monthly" className="gap-1.5">
            <CreditCard className="h-4 w-4" /> 月租方案
          </TabsTrigger>
          <TabsTrigger value="booking" className="gap-1.5">
            <Link2 className="h-4 w-4" /> 預約連結
          </TabsTrigger>
          <TabsTrigger value="reminder" className="gap-1.5">
            <Bell className="h-4 w-4" /> 提醒設定
          </TabsTrigger>
          <TabsTrigger value="line" className="gap-1.5">
            <MessageCircle className="h-4 w-4" /> LINE 設定
          </TabsTrigger>
          <TabsTrigger value="subscription" className="gap-1.5">
            <Zap className="h-4 w-4" /> 訂閱方案
          </TabsTrigger>
          <TabsTrigger value="ocr" className="gap-1.5">
            <ScanLine className="h-4 w-4" /> OCR 設定
          </TabsTrigger>
          <TabsTrigger value="fees" className="gap-1.5">
            <Percent className="h-4 w-4" /> 手續費
          </TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="mt-4">
          <ServiceManager initialServices={services} />
        </TabsContent>

        <TabsContent value="rooms" className="mt-4">
          <RoomManager initialRooms={rooms} />
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          {isAdmin ? <MemberLevelManager initialLevels={memberLevels} /> : <AccessDeniedTab />}
        </TabsContent>

        <TabsContent value="contract" className="mt-4">
          <ContractTemplateEditor
            shopId={shopId}
            initialContent={shop?.contractTemplate ?? ""}
          />
        </TabsContent>

        <TabsContent value="staff" className="mt-4">
          <StaffManager
            initialStaff={staffForClient}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="monthly" className="mt-4">
          {isAdmin ? <MonthlyPlanManager initialPlans={monthlyPlans} /> : <AccessDeniedTab />}
        </TabsContent>

        <TabsContent value="booking" className="mt-4">
          <div className="space-y-4">
            <BookingLink shopId={shopId} baseUrl={baseUrl} />
            <MenuLink shopId={shopId} baseUrl={baseUrl} />
          </div>
        </TabsContent>

        <TabsContent value="reminder" className="mt-4">
          <ReminderSettings
            shopId={shopId}
            initialTemplate={shop?.reminderTemplate ?? null}
          />
        </TabsContent>

        <TabsContent value="line" className="mt-4">
          {isAdmin ? (
            <LineSettings
              shopId={shopId}
              webhookUrl={`${baseUrl}/api/line/webhook/${shopId}`}
              initialChannelId={shop?.lineChannelId ?? null}
              initialChannelSecret={shop?.lineChannelSecret ?? null}
              initialToken={shop?.lineChannelToken ?? null}
            />
          ) : <AccessDeniedTab />}
        </TabsContent>

        <TabsContent value="subscription" className="mt-4">
          {isAdmin ? <SubscriptionInfo /> : <AccessDeniedTab />}
        </TabsContent>

        <TabsContent value="ocr" className="mt-4">
          {isAdmin ? (
            <OcrSettings shopId={shopId} initialKeywords={shop?.ocrKeywords ?? null} />
          ) : <AccessDeniedTab />}
        </TabsContent>

        <TabsContent value="fees" className="mt-4">
          {isAdmin ? (
            <PaymentFeeSettings shopId={shopId} initialRates={shop?.paymentFeeRates ?? null} />
          ) : <AccessDeniedTab />}
        </TabsContent>
      </Tabs>
    </div>
  )
}
