import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { PrismaClient } from "../app/generated/prisma/client"
import bcrypt from "bcryptjs"
import { randomBytes } from "crypto"

const url = process.env.DATABASE_URL!

// ⛔ 生產環境防護：seed 會清空所有業務資料，禁止在正式 DB 上執行
// 必須設定 ALLOW_SEED=true 才能繞過此檢查（僅供開發/測試環境）
const isRenderProd = url.includes("render.com") || url.includes(".internal")
const isProd = process.env.NODE_ENV === "production"
const allowSeed = process.env.ALLOW_SEED === "true"
if ((isRenderProd || isProd) && !allowSeed) {
  console.error("❌ 拒絕執行：偵測到正式環境（Render URL 或 NODE_ENV=production）。")
  console.error("   seed 會清空所有真實客人資料！")
  console.error("   如確定要在此環境執行，請設定 ALLOW_SEED=true")
  console.error("   例如：ALLOW_SEED=true npm run db:seed")
  process.exit(1)
}

const isLocal = url.includes("localhost") || url.includes("127.0.0.1") || url.startsWith("file:")
const pool = new Pool({ connectionString: url, ssl: isLocal ? undefined : { rejectUnauthorized: false } })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter } as any)

// SEC-1: never hardcode passwords in source. Read from env, or generate a
// random one and print it once at the end so the operator can copy it.
const generatedCreds: string[] = []
function seedPassword(envKey: string, label: string): string {
  const fromEnv = process.env[envKey]
  if (fromEnv) return fromEnv
  const pw = randomBytes(12).toString("base64url")
  generatedCreds.push(`  ${label.padEnd(28)} ${pw}   (env: ${envKey})`)
  return pw
}

const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL ?? "owner@example.com"

const SHOP_ID = "Tutu123456"
const SYSTEM_SHOP_ID = "system"

async function clearShopData() {
  if (isRenderProd) throw new Error("clearShopData: 正式 DB 不允許清除")
  await prisma.subscription.deleteMany({ where: { shopId: SHOP_ID } })
  await prisma.storedValueHistory.deleteMany({ where: { shopId: SHOP_ID } })
  await prisma.pointsHistory.deleteMany({ where: { shopId: SHOP_ID } })
  await prisma.payment.deleteMany({ where: { shopId: SHOP_ID } })
  await prisma.groomingRecord.deleteMany({ where: { shopId: SHOP_ID } })
  await prisma.boardingDailyLog.deleteMany({ where: { shopId: SHOP_ID } })
  await prisma.boardingRecord.deleteMany({ where: { shopId: SHOP_ID } })
  await prisma.appointment.deleteMany({ where: { shopId: SHOP_ID } })
  await prisma.contract.deleteMany({ where: { shopId: SHOP_ID } })
  await prisma.petServicePrice.deleteMany({ where: { shopId: SHOP_ID } })
  await prisma.petMonthlyPlan.deleteMany({ where: { shopId: SHOP_ID } })
  await prisma.pet.deleteMany({ where: { shopId: SHOP_ID } })
  await prisma.customer.deleteMany({ where: { shopId: SHOP_ID } })
  await prisma.user.deleteMany({ where: { shopId: SHOP_ID } })
  await prisma.service.deleteMany({ where: { shopId: SHOP_ID } })
  await prisma.boardingRoom.deleteMany({ where: { shopId: SHOP_ID } })
  await prisma.monthlyPlan.deleteMany({ where: { shopId: SHOP_ID } })
  await prisma.memberLevel.deleteMany({ where: { shopId: SHOP_ID } })
  await prisma.expense.deleteMany({ where: { shopId: SHOP_ID } })
  await prisma.product.deleteMany({ where: { shopId: SHOP_ID } })
  await prisma.auditLog.deleteMany({ where: { shopId: SHOP_ID } })
}

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(10, 0, 0, 0)
  return d
}

function thisWeekDay(dayOffset: number, hour: number) {
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - now.getDay() + 1)
  monday.setHours(hour, 0, 0, 0)
  monday.setDate(monday.getDate() + dayOffset)
  return monday
}

const CONTRACT_TEMPLATE = `<h2>寵物美容服務定型化契約</h2>
<p>立契約書人：________________________（以下簡稱甲方/客戶）與毛毛寵物美容（以下簡稱乙方/店家），雙方同意遵守下列條款：</p>
<h3>一、服務範圍</h3>
<p>乙方提供寵物美容、洗澡、修剪等相關服務。服務項目及費用依預約時確認之內容為準。</p>
<h3>二、寵物健康聲明</h3>
<p>甲方保證其寵物健康狀況良好，無傳染性疾病，且疫苗接種均已完成並有效。若寵物有特殊病史、過敏或行為問題，甲方應於服務前告知乙方。</p>
<h3>三、服務中意外處理</h3>
<p>乙方服務過程中將盡最大善意照顧寵物，若發生緊急狀況，乙方有權立即採取必要之緊急醫療措施，相關費用由甲方負擔，乙方應盡速通知甲方。</p>
<h3>四、免責聲明</h3>
<p>若寵物因年齡、健康狀況或隱藏性疾病導致在美容過程中發生不適，乙方不負賠償責任，但乙方有義務給予必要之緊急處置。</p>
<h3>五、照片授權</h3>
<p>乙方可能拍攝美容前後照片作為服務紀錄，甲方同意乙方得將照片用於業務宣傳使用（如有不同意請告知）。</p>
<h3>六、取消與改期</h3>
<p>預約取消或改期請提前24小時通知，當日取消或未到店將酌收取消費用。</p>
<p>甲方簽名即表示已閱讀並同意上述所有條款。</p>`

async function main() {
  console.log("🧹 清除舊資料...")
  await clearShopData()

  // ─── SaaS 方案 ──────────────────────────────────────────────────
  console.log("📦 建立訂閱方案...")
  const UNLIMITED = 999999

  const planFree = await prisma.plan.upsert({
    where: { id: "plan-free" },
    update: {},
    create: {
      id: "plan-free", name: "免費試用", price: 0, interval: "MONTHLY",
      maxCustomers: 50, maxPets: 100, maxStaff: 2,
      features: JSON.stringify(["預約排程", "客人管理", "美容紀錄", "住宿管理", "基本報表"]),
      isActive: true,
    },
  })

  const planBasic = await prisma.plan.upsert({
    where: { id: "plan-basic" },
    update: {},
    create: {
      id: "plan-basic", name: "基礎版", price: 499, interval: "MONTHLY",
      maxCustomers: 200, maxPets: 500, maxStaff: 5,
      features: JSON.stringify(["所有試用版功能", "客人黑名單", "批次通知", "週視圖行事曆", "應收帳款", "會員等級自動升降", "操作稽核記錄"]),
      isActive: true,
    },
  })

  await prisma.plan.upsert({
    where: { id: "plan-pro" },
    update: {},
    create: {
      id: "plan-pro", name: "專業版", price: 999, interval: "MONTHLY",
      maxCustomers: UNLIMITED, maxPets: UNLIMITED, maxStaff: UNLIMITED,
      features: JSON.stringify(["所有基礎版功能", "無限客人 & 寵物", "無限員工", "員工業績統計", "客戶回流分析", "進階 BI 報表", "優先客服支援"]),
      isActive: true,
    },
  })

  // ─── 系統超管 ──────────────────────────────────────────────────
  console.log("🔐 建立系統超級管理員...")
  await prisma.shop.upsert({
    where: { id: SYSTEM_SHOP_ID },
    update: {},
    create: { id: SYSTEM_SHOP_ID, name: "系統管理" },
  })
  const systemPw = await bcrypt.hash(seedPassword("SEED_SUPERADMIN_PASSWORD", "系統超管 superadmin@system.com"), 12)
  await prisma.user.upsert({
    where: { email_shopId: { email: "superadmin@system.com", shopId: SYSTEM_SHOP_ID } },
    update: {},
    create: {
      name: "系統超管", email: "superadmin@system.com", password: systemPw,
      role: "OWNER", shopId: SYSTEM_SHOP_ID, isSuperAdmin: true, isActive: true,
    },
  })

  // ─── 主店家 ────────────────────────────────────────────────────
  console.log("🏪 建立店家...")
  const shop = await prisma.shop.upsert({
    where: { id: SHOP_ID },
    update: { name: "毛毛寵物美容", contractTemplate: CONTRACT_TEMPLATE },
    create: {
      id: SHOP_ID, name: "毛毛寵物美容",
      phone: "02-2345-6789",
      address: "台北市大安區復興南路一段100號",
      lineId: "@maomao", email: "maomao@example.com",
      contractTemplate: CONTRACT_TEMPLATE,
    },
  })

  const trialEnd = new Date()
  trialEnd.setDate(trialEnd.getDate() + 14)
  await prisma.subscription.create({
    data: {
      shopId: shop.id, planId: planBasic.id, status: "TRIAL",
      currentPeriodStart: new Date(), currentPeriodEnd: trialEnd,
    },
  })

  // ─── 帳號 ──────────────────────────────────────────────────────
  console.log("👤 建立帳號...")
  const ownerPw = await bcrypt.hash(seedPassword("SEED_OWNER_PASSWORD", `店主 ${OWNER_EMAIL}`), 12)
  const owner = await prisma.user.upsert({
    where: { email_shopId: { email: OWNER_EMAIL, shopId: SHOP_ID } },
    update: { password: ownerPw, isSuperAdmin: true, isActive: true },
    create: {
      name: "Tutu 老闆", email: OWNER_EMAIL, password: ownerPw,
      role: "OWNER", shopId: SHOP_ID, isSuperAdmin: true, isActive: true,
    },
  })

  const staffPw = await bcrypt.hash(seedPassword("SEED_STAFF_PASSWORD", "美容師 (lily/jason)"), 10)
  const lily = await prisma.user.create({
    data: { name: "Lily 美容師", email: "lily@maomao.com", password: staffPw, role: "STAFF", shopId: SHOP_ID },
  })
  const jason = await prisma.user.create({
    data: { name: "Jason 美容師", email: "jason@maomao.com", password: staffPw, role: "STAFF", shopId: SHOP_ID },
  })

  // ─── 會員等級 ──────────────────────────────────────────────────
  console.log("🏅 建立會員等級...")
  const levelNormal = await prisma.memberLevel.create({
    data: { shopId: SHOP_ID, name: "一般會員", minPoints: 0, discountRate: 0, benefits: "基本服務", color: "#6b7280" },
  })
  const levelVip = await prisma.memberLevel.create({
    data: { shopId: SHOP_ID, name: "VIP 會員", minPoints: 500, discountRate: 0.05, benefits: "95折優惠、生日禮", color: "#8b5cf6" },
  })
  const levelPlatinum = await prisma.memberLevel.create({
    data: { shopId: SHOP_ID, name: "白金會員", minPoints: 2000, discountRate: 0.1, benefits: "9折優惠、優先預約、生日禮", color: "#f59e0b" },
  })

  // ─── 服務項目 ──────────────────────────────────────────────────
  console.log("📋 建立服務項目...")
  const svcs = [
    { name: "基礎洗澡", category: "洗澡", price: 600, duration: 90 },
    { name: "洗澡+基礎剪毛", category: "美容", price: 900, duration: 120 },
    { name: "全套美容", category: "美容", price: 1200, duration: 150 },
    { name: "貴賓剪", category: "美容", price: 1500, duration: 180 },
    { name: "指甲修剪", category: "單項", price: 150, duration: 20 },
    { name: "耳朵清潔", category: "單項", price: 150, duration: 15 },
    { name: "牙齒清潔", category: "單項", price: 200, duration: 20 },
    { name: "肛門腺清潔", category: "單項", price: 100, duration: 10 },
  ]
  for (const s of svcs) await prisma.service.create({ data: { ...s, shopId: SHOP_ID } })

  // ─── 住宿房間 ──────────────────────────────────────────────────
  console.log("🏠 建立住宿房間...")
  const rooms: { id: string }[] = []
  for (const r of [
    { name: "1號房", type: "小型", dailyRate: 500 },
    { name: "2號房", type: "小型", dailyRate: 500 },
    { name: "3號房", type: "中型", dailyRate: 800 },
    { name: "4號房", type: "中型", dailyRate: 800 },
    { name: "5號房", type: "大型", dailyRate: 1200 },
    { name: "豪華套房", type: "豪華", dailyRate: 2000 },
  ]) rooms.push(await prisma.boardingRoom.create({ data: { ...r, shopId: SHOP_ID } }))

  // ─── 月租方案 ──────────────────────────────────────────────────
  const monthlyPlan = await prisma.monthlyPlan.create({
    data: {
      shopId: SHOP_ID, name: "無限洗澡月租", price: 2000, sessions: 4,
      services: "基礎洗澡", description: "每月4次基礎洗澡，30天內使用", validDays: 30,
    },
  })

  // ─── 客人 1：王小明（VIP） ────────────────────────────────────
  console.log("👥 建立客人與寵物...")
  const c1 = await prisma.customer.create({
    data: {
      name: "王小明", phone: "0912-345-678", lineId: "wang_ming",
      address: "台北市信義區松仁路100號", shopId: SHOP_ID,
      memberLevelId: levelVip.id, storedValue: 3000, points: 650,
      notes: "對貓咪過敏，服務時請注意",
    },
  })
  const p1 = await prisma.pet.create({
    data: {
      name: "小白", species: "犬", breed: "馬爾濟斯", gender: "MALE",
      birthday: new Date("2020-03-15"), chipNumber: "123456789012345",
      vaccineRecords: JSON.stringify([
        { id: "v1", name: "狂犬病疫苗", date: "2025-01-15", nextDate: "2026-01-15", clinic: "大安動物醫院" },
        { id: "v2", name: "五合一疫苗", date: "2025-01-15", nextDate: "2026-01-15", clinic: "大安動物醫院" },
      ]),
      skinIssue: true, skinNote: "對某些洗毛精敏感，請使用低敏配方",
      customerId: c1.id, shopId: SHOP_ID,
    },
  })
  const p2 = await prisma.pet.create({
    data: {
      name: "橘子", species: "犬", breed: "柴犬", gender: "FEMALE",
      birthday: new Date("2019-06-20"), customerId: c1.id, shopId: SHOP_ID,
    },
  })

  for (const [petId, groomerId, services, cost, note, daysBack] of [
    [p1.id, lily.id,  JSON.stringify([{ name: "全套美容", price: 1200 }, { name: "耳朵清潔", price: 150 }]), 1350, "毛留長一點", 90],
    [p1.id, lily.id,  JSON.stringify([{ name: "洗澡+基礎剪毛", price: 900 }]), 900, "", 60],
    [p1.id, jason.id, JSON.stringify([{ name: "全套美容", price: 1200 }, { name: "指甲修剪", price: 150 }]), 1350, "", 30],
    [p2.id, jason.id, JSON.stringify([{ name: "洗澡+基礎剪毛", price: 900 }, { name: "肛門腺清潔", price: 100 }]), 1000, "換毛季", 75],
    [p2.id, lily.id,  JSON.stringify([{ name: "基礎洗澡", price: 600 }]), 600, "", 45],
    [p2.id, jason.id, JSON.stringify([{ name: "基礎洗澡", price: 600 }, { name: "耳朵清潔", price: 150 }]), 750, "", 15],
  ] as const) {
    const gr = await prisma.groomingRecord.create({
      data: { petId, shopId: SHOP_ID, groomerId, services, totalCost: cost, notes: note || undefined, date: daysAgo(daysBack) },
    })
    await prisma.payment.create({
      data: { shopId: SHOP_ID, customerId: c1.id, groomingRecordId: gr.id, amount: cost, paymentMethod: "CASH", billingType: "SINGLE", status: "PAID", paidAt: new Date() },
    })
  }

  await prisma.contract.create({
    data: { petId: p1.id, shopId: SHOP_ID, content: CONTRACT_TEMPLATE, status: "SIGNED", signedAt: new Date("2025-01-20"), signerName: "王小明" },
  })
  await prisma.contract.create({
    data: { petId: p2.id, shopId: SHOP_ID, content: CONTRACT_TEMPLATE, status: "PENDING" },
  })

  // ─── 客人 2：陳美華（月租） ───────────────────────────────────
  const c2 = await prisma.customer.create({
    data: {
      name: "陳美華", phone: "0987-654-321", lineId: "mei_hua_chen",
      shopId: SHOP_ID, memberLevelId: levelNormal.id,
      storedValue: 500, points: 220,
      monthlyPlanId: monthlyPlan.id,
      monthlyPlanStartDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    },
  })
  const p3 = await prisma.pet.create({
    data: {
      name: "咪咪", species: "貓", breed: "英國短毛貓", gender: "FEMALE",
      birthday: new Date("2021-09-01"), customerId: c2.id, shopId: SHOP_ID,
      notes: "貓咪較緊張，請耐心溫柔對待",
    },
  })
  const p4 = await prisma.pet.create({
    data: { name: "奶油", species: "犬", breed: "博美犬", gender: "MALE", birthday: new Date("2022-04-15"), customerId: c2.id, shopId: SHOP_ID },
  })
  const p5 = await prisma.pet.create({
    data: { name: "豆豆", species: "犬", breed: "臘腸犬", gender: "MALE", birthday: new Date("2020-11-30"), customerId: c2.id, shopId: SHOP_ID },
  })

  for (const [petId, groomerId, services, cost, daysBack] of [
    [p3.id, lily.id,  JSON.stringify([{ name: "基礎洗澡", price: 600 }]), 600, 80],
    [p3.id, lily.id,  JSON.stringify([{ name: "基礎洗澡", price: 600 }, { name: "指甲修剪", price: 150 }]), 750, 50],
    [p3.id, jason.id, JSON.stringify([{ name: "基礎洗澡", price: 600 }]), 600, 20],
    [p4.id, jason.id, JSON.stringify([{ name: "全套美容", price: 1200 }]), 1200, 70],
    [p4.id, lily.id,  JSON.stringify([{ name: "全套美容", price: 1200 }, { name: "牙齒清潔", price: 200 }]), 1400, 40],
    [p4.id, jason.id, JSON.stringify([{ name: "全套美容", price: 1200 }]), 1200, 10],
    [p5.id, lily.id,  JSON.stringify([{ name: "洗澡+基礎剪毛", price: 900 }]), 900, 65],
    [p5.id, jason.id, JSON.stringify([{ name: "洗澡+基礎剪毛", price: 900 }, { name: "指甲修剪", price: 150 }]), 1050, 35],
    [p5.id, lily.id,  JSON.stringify([{ name: "基礎洗澡", price: 600 }]), 600, 7],
  ] as const) {
    const gr = await prisma.groomingRecord.create({
      data: { petId, shopId: SHOP_ID, groomerId, services, totalCost: cost, date: daysAgo(daysBack) },
    })
    await prisma.payment.create({
      data: { shopId: SHOP_ID, customerId: c2.id, groomingRecordId: gr.id, amount: cost, paymentMethod: "CASH", billingType: "SINGLE", status: "PAID", paidAt: new Date() },
    })
  }

  await prisma.contract.create({
    data: { petId: p3.id, shopId: SHOP_ID, content: CONTRACT_TEMPLATE, status: "SIGNED", signedAt: new Date("2025-02-15"), signerName: "陳美華" },
  })

  // ─── 客人 3：李大同（白金） ───────────────────────────────────
  const c3 = await prisma.customer.create({
    data: {
      name: "李大同", phone: "0922-111-222", shopId: SHOP_ID,
      memberLevelId: levelPlatinum.id, storedValue: 8000, points: 3500,
      notes: "白金客戶，服務優先安排",
    },
  })
  const p6 = await prisma.pet.create({
    data: {
      name: "大壯", species: "犬", breed: "黃金獵犬", gender: "MALE",
      birthday: new Date("2018-12-25"), boneIssue: true, boneNote: "輕微關節問題",
      customerId: c3.id, shopId: SHOP_ID,
    },
  })
  const p7 = await prisma.pet.create({
    data: {
      name: "可樂", species: "犬", breed: "法國鬥牛犬", gender: "FEMALE",
      birthday: new Date("2021-07-04"), notes: "短鼻犬，洗澡時特別注意呼吸",
      customerId: c3.id, shopId: SHOP_ID,
    },
  })

  for (const [petId, groomerId, services, cost, daysBack] of [
    [p6.id, jason.id, JSON.stringify([{ name: "貴賓剪", price: 1500 }, { name: "牙齒清潔", price: 200 }, { name: "耳朵清潔", price: 150 }]), 1850, 85],
    [p6.id, jason.id, JSON.stringify([{ name: "貴賓剪", price: 1500 }, { name: "肛門腺清潔", price: 100 }]), 1600, 55],
    [p6.id, lily.id,  JSON.stringify([{ name: "全套美容", price: 1200 }, { name: "指甲修剪", price: 150 }]), 1350, 25],
    [p7.id, lily.id,  JSON.stringify([{ name: "基礎洗澡", price: 600 }, { name: "耳朵清潔", price: 150 }]), 750, 72],
    [p7.id, jason.id, JSON.stringify([{ name: "基礎洗澡", price: 600 }, { name: "指甲修剪", price: 150 }, { name: "肛門腺清潔", price: 100 }]), 850, 42],
    [p7.id, lily.id,  JSON.stringify([{ name: "基礎洗澡", price: 600 }]), 600, 12],
  ] as const) {
    const gr = await prisma.groomingRecord.create({
      data: { petId, shopId: SHOP_ID, groomerId, services, totalCost: cost, date: daysAgo(daysBack) },
    })
    await prisma.payment.create({
      data: { shopId: SHOP_ID, customerId: c3.id, groomingRecordId: gr.id, amount: cost, paymentMethod: "CARD", billingType: "SINGLE", status: "PAID", paidAt: new Date() },
    })
  }

  await prisma.contract.create({
    data: { petId: p6.id, shopId: SHOP_ID, content: CONTRACT_TEMPLATE, status: "SIGNED", signedAt: new Date("2024-12-10"), signerName: "李大同" },
  })

  // ─── 本週預約 ──────────────────────────────────────────────────
  console.log("📅 建立本週預約...")
  await prisma.appointment.createMany({
    data: [
      { petId: p1.id, shopId: SHOP_ID, staffId: lily.id,  type: "GROOMING", scheduledAt: thisWeekDay(0, 9),  duration: 120, status: "COMPLETED", services: JSON.stringify([{ name: "全套美容", price: 1200 }]),           estimatedCost: 1200, source: "LINE" },
      { petId: p3.id, shopId: SHOP_ID, staffId: lily.id,  type: "GROOMING", scheduledAt: thisWeekDay(1, 10), duration: 90,  status: "CONFIRMED", services: JSON.stringify([{ name: "基礎洗澡", price: 600 }]),             estimatedCost: 600,  source: "PHONE" },
      { petId: p4.id, shopId: SHOP_ID, staffId: jason.id, type: "GROOMING", scheduledAt: thisWeekDay(2, 14), duration: 150, status: "CONFIRMED", services: JSON.stringify([{ name: "全套美容", price: 1200 }]),           estimatedCost: 1200, source: "WALK_IN" },
      { petId: p6.id, shopId: SHOP_ID, staffId: jason.id, type: "GROOMING", scheduledAt: thisWeekDay(3, 11), duration: 180, status: "PENDING",   services: JSON.stringify([{ name: "貴賓剪", price: 1500 }]),             estimatedCost: 1500, source: "LINE" },
      { petId: p2.id, shopId: SHOP_ID,                    type: "GROOMING", scheduledAt: thisWeekDay(4, 15), duration: 90,  status: "CANCELLED", services: JSON.stringify([{ name: "洗澡+基礎剪毛", price: 900 }]),       estimatedCost: 900,  source: "PHONE", notes: "客人臨時取消" },
    ],
  })

  // ─── 住宿紀錄 ──────────────────────────────────────────────────
  console.log("🏠 建立住宿紀錄...")
  await prisma.boardingRecord.create({
    data: { petId: p6.id, shopId: SHOP_ID, roomId: rooms[4].id, checkIn: daysAgo(3), dailyRate: 1200, status: "STAYING", notes: "老狗，需特別關注" },
  })
  await prisma.boardingRoom.update({ where: { id: rooms[4].id }, data: { status: "OCCUPIED" } })

  await prisma.boardingRecord.create({
    data: { petId: p7.id, shopId: SHOP_ID, roomId: rooms[2].id, checkIn: daysAgo(1), dailyRate: 800, status: "STAYING", notes: "法鬥注意通風" },
  })
  await prisma.boardingRoom.update({ where: { id: rooms[2].id }, data: { status: "OCCUPIED" } })

  // ─── 儲值紀錄 ──────────────────────────────────────────────────
  await prisma.storedValueHistory.createMany({
    data: [
      { customerId: c1.id, shopId: SHOP_ID, amount: 3000,  reason: "客人現金儲值 3000 元" },
      { customerId: c3.id, shopId: SHOP_ID, amount: 10000, reason: "客人轉帳儲值 10000 元" },
    ],
  })

  console.log("\n✅ 資料初始化完成！")
  console.log("\n🔐 主要登入帳號:")
  console.log(`  店家 ID : ${SHOP_ID}`)
  console.log(`  Email   : ${OWNER_EMAIL}`)
  console.log(`  員工    : lily@maomao.com / jason@maomao.com`)
  if (generatedCreds.length > 0) {
    console.log("\n🔑 本次自動產生的密碼（請立即記下，不會再顯示；可改用對應 env 變數固定）:")
    for (const line of generatedCreds) console.log(line)
  } else {
    console.log("  （密碼來自 SEED_*_PASSWORD 環境變數）")
  }
  console.log("\n🐾 測試資料: 3客人、7寵物、各3筆美容紀錄、5筆本週預約、2隻住宿中")
}

main().catch(console.error).finally(() => prisma.$disconnect())
