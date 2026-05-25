import { PrismaClient } from "../app/generated/prisma/client"
import { PrismaLibSql } from "@prisma/adapter-libsql"
import bcrypt from "bcryptjs"
import path from "path"

const dbUrl = `file:${path.resolve(process.cwd(), "dev.db")}`
const adapter = new PrismaLibSql({ url: dbUrl })
const prisma = new PrismaClient({ adapter } as any)

const SHOP_ID = "demo-shop-001"
const SYSTEM_SHOP_ID = "system"

async function clearShopData() {
  // Delete in FK-safe order
  await prisma.subscription.deleteMany({ where: { shopId: SHOP_ID } })
  await prisma.storedValueHistory.deleteMany({ where: { shopId: SHOP_ID } })
  await prisma.pointsHistory.deleteMany({ where: { shopId: SHOP_ID } })
  await prisma.payment.deleteMany({ where: { shopId: SHOP_ID } })
  await prisma.groomingRecord.deleteMany({ where: { shopId: SHOP_ID } })
  await prisma.boardingRecord.deleteMany({ where: { shopId: SHOP_ID } })
  await prisma.appointment.deleteMany({ where: { shopId: SHOP_ID } })
  await prisma.contract.deleteMany({ where: { shopId: SHOP_ID } })
  const pets = await prisma.pet.findMany({ where: { shopId: SHOP_ID }, select: { id: true } })
  if (pets.length > 0) {
    await prisma.pet.deleteMany({ where: { shopId: SHOP_ID } })
  }
  await prisma.customer.deleteMany({ where: { shopId: SHOP_ID } })
  await prisma.user.deleteMany({ where: { shopId: SHOP_ID } })
  await prisma.service.deleteMany({ where: { shopId: SHOP_ID } })
  await prisma.boardingRoom.deleteMany({ where: { shopId: SHOP_ID } })
  await prisma.monthlyPlan.deleteMany({ where: { shopId: SHOP_ID } })
  await prisma.memberLevel.deleteMany({ where: { shopId: SHOP_ID } })
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
      id: "plan-free",
      name: "免費試用",
      price: 0,
      interval: "MONTHLY",
      maxCustomers: 50,
      maxPets: 100,
      maxStaff: 2,
      features: JSON.stringify(["預約排程", "客人管理", "美容紀錄", "住宿管理", "基本報表"]),
      isActive: true,
    },
  })

  const planBasic = await prisma.plan.upsert({
    where: { id: "plan-basic" },
    update: {},
    create: {
      id: "plan-basic",
      name: "基礎版",
      price: 499,
      interval: "MONTHLY",
      maxCustomers: 200,
      maxPets: 500,
      maxStaff: 5,
      features: JSON.stringify(["所有試用版功能", "客人黑名單", "批次通知", "週視圖行事曆", "應收帳款", "會員等級自動升降", "操作稽核記錄"]),
      isActive: true,
    },
  })

  await prisma.plan.upsert({
    where: { id: "plan-pro" },
    update: {},
    create: {
      id: "plan-pro",
      name: "專業版",
      price: 999,
      interval: "MONTHLY",
      maxCustomers: UNLIMITED,
      maxPets: UNLIMITED,
      maxStaff: UNLIMITED,
      features: JSON.stringify(["所有基礎版功能", "無限客人 & 寵物", "無限員工", "員工業績統計", "客戶回流分析", "進階 BI 報表", "優先客服支援"]),
      isActive: true,
    },
  })

  // ─── 超級管理員 ──────────────────────────────────────────────────
  console.log("🔐 建立超級管理員...")
  const systemShop = await prisma.shop.upsert({
    where: { id: SYSTEM_SHOP_ID },
    update: {},
    create: { id: SYSTEM_SHOP_ID, name: "系統管理" },
  })
  const superPw = await bcrypt.hash("superadmin2026", 10)
  await prisma.user.upsert({
    where: { email_shopId: { email: "superadmin@system.com", shopId: SYSTEM_SHOP_ID } },
    update: {},
    create: {
      name: "超級管理員",
      email: "superadmin@system.com",
      password: superPw,
      role: "OWNER",
      shopId: SYSTEM_SHOP_ID,
      isSuperAdmin: true,
      isActive: true,
    },
  })

  console.log("🏪 建立店家...")
  const shop = await prisma.shop.upsert({
    where: { id: SHOP_ID },
    update: { name: "毛毛寵物美容", contractTemplate: CONTRACT_TEMPLATE },
    create: {
      id: SHOP_ID,
      name: "毛毛寵物美容",
      phone: "02-2345-6789",
      address: "台北市大安區復興南路一段100號",
      lineId: "@maomao",
      email: "maomao@example.com",
      contractTemplate: CONTRACT_TEMPLATE,
    },
  })

  // Demo shop trial subscription (using basic plan to show full features)
  const trialEnd = new Date()
  trialEnd.setDate(trialEnd.getDate() + 14)
  await prisma.subscription.create({
    data: {
      shopId: shop.id,
      planId: planBasic.id,
      status: "TRIAL",
      currentPeriodStart: new Date(),
      currentPeriodEnd: trialEnd,
    },
  })

  console.log("👤 建立帳號...")
  const pw = await bcrypt.hash("admin123", 10)
  const staffPw = await bcrypt.hash("staff123", 10)

  const admin = await prisma.user.create({
    data: {
      name: "王老闆",
      email: "admin@maomao.com",
      password: pw,
      role: "OWNER",
      shopId: shop.id,
    },
  })

  const lily = await prisma.user.create({
    data: {
      name: "Lily 美容師",
      email: "lily@maomao.com",
      password: staffPw,
      role: "STAFF",
      shopId: shop.id,
    },
  })

  const jason = await prisma.user.create({
    data: {
      name: "Jason 美容師",
      email: "jason@maomao.com",
      password: staffPw,
      role: "STAFF",
      shopId: shop.id,
    },
  })

  console.log("🏅 建立會員等級...")
  const levelNormal = await prisma.memberLevel.create({
    data: { shopId: shop.id, name: "一般會員", minPoints: 0, discountRate: 0, benefits: "基本服務", color: "#6b7280" },
  })
  const levelVip = await prisma.memberLevel.create({
    data: { shopId: shop.id, name: "VIP 會員", minPoints: 500, discountRate: 0.05, benefits: "95折優惠、生日禮", color: "#8b5cf6" },
  })
  const levelPlatinum = await prisma.memberLevel.create({
    data: { shopId: shop.id, name: "白金會員", minPoints: 2000, discountRate: 0.1, benefits: "9折優惠、優先預約、生日禮", color: "#f59e0b" },
  })

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
  for (const s of svcs) await prisma.service.create({ data: { ...s, shopId: shop.id } })

  console.log("🏠 建立住宿房間...")
  const rooms = [
    { name: "1號房", type: "小型", dailyRate: 500 },
    { name: "2號房", type: "小型", dailyRate: 500 },
    { name: "3號房", type: "中型", dailyRate: 800 },
    { name: "4號房", type: "中型", dailyRate: 800 },
    { name: "5號房", type: "大型", dailyRate: 1200 },
    { name: "豪華套房", type: "豪華", dailyRate: 2000 },
  ]
  const createdRooms: { id: string }[] = []
  for (const r of rooms) {
    createdRooms.push(await prisma.boardingRoom.create({ data: { ...r, shopId: shop.id } }))
  }

  console.log("📅 建立月租方案...")
  const monthlyPlan = await prisma.monthlyPlan.create({
    data: {
      shopId: shop.id,
      name: "無限洗澡月租",
      price: 2000,
      sessions: 4,
      services: "基礎洗澡",
      description: "每月4次基礎洗澡，30天內使用",
      validDays: 30,
    },
  })

  // ─── 客人 1：王小明（VIP，儲值 3000） ─────────────────────────────
  console.log("👥 建立客人與寵物...")
  const c1 = await prisma.customer.create({
    data: {
      name: "王小明",
      phone: "0912-345-678",
      lineId: "wang_ming",
      address: "台北市信義區松仁路100號",
      shopId: shop.id,
      memberLevelId: levelVip.id,
      storedValue: 3000,
      points: 650,
      notes: "對貓咪過敏，服務時請注意",
    },
  })

  const p1 = await prisma.pet.create({
    data: {
      name: "小白",
      species: "犬",
      breed: "馬爾濟斯",
      gender: "MALE",
      birthday: new Date("2020-03-15"),
      chipNumber: "123456789012345",
      vaccineRecords: JSON.stringify([
        { id: "v1", name: "狂犬病疫苗", date: "2025-01-15", nextDate: "2026-01-15", clinic: "大安動物醫院" },
        { id: "v2", name: "五合一疫苗", date: "2025-01-15", nextDate: "2026-01-15", clinic: "大安動物醫院" },
      ]),
      diseases: "無",
      allergies: "對某些洗毛精敏感，請使用低敏配方",
      customerId: c1.id,
      shopId: shop.id,
    },
  })

  const p2 = await prisma.pet.create({
    data: {
      name: "橘子",
      species: "犬",
      breed: "柴犬",
      gender: "FEMALE",
      birthday: new Date("2019-06-20"),
      vaccineRecords: JSON.stringify([
        { id: "v3", name: "狂犬病疫苗", date: "2024-11-20", nextDate: "2025-11-20", clinic: "信義寵物診所" },
      ]),
      customerId: c1.id,
      shopId: shop.id,
    },
  })

  // 小白：3筆美容紀錄
  const g1a = await prisma.groomingRecord.create({
    data: {
      petId: p1.id, shopId: shop.id, groomerId: lily.id,
      services: JSON.stringify([{ name: "全套美容", price: 1200 }, { name: "耳朵清潔", price: 150 }]),
      totalCost: 1350, skinCondition: "皮膚狀況良好", furCondition: "毛質柔順",
      notes: "客人要求毛留長一點", date: daysAgo(90),
    },
  })
  await prisma.payment.create({
    data: { shopId: shop.id, customerId: c1.id, groomingRecordId: g1a.id, amount: 1350, paymentMethod: "CASH", billingType: "SINGLE", status: "PAID", paidAt: new Date() },
  })
  await prisma.pointsHistory.create({
    data: { customerId: c1.id, shopId: shop.id, points: 13, reason: "美容消費 1350 元，累積 13 點" },
  })

  const g1b = await prisma.groomingRecord.create({
    data: {
      petId: p1.id, shopId: shop.id, groomerId: lily.id,
      services: JSON.stringify([{ name: "洗澡+基礎剪毛", price: 900 }]),
      totalCost: 900, skinCondition: "皮膚略乾，建議補充魚油", furCondition: "毛量豐厚",
      date: daysAgo(60),
    },
  })
  await prisma.payment.create({
    data: { shopId: shop.id, customerId: c1.id, groomingRecordId: g1b.id, amount: 900, paymentMethod: null, billingType: "CREDIT", status: "PAID", paidAt: new Date() },
  })
  await prisma.storedValueHistory.create({
    data: { customerId: c1.id, shopId: shop.id, amount: -900, reason: "美容消費扣款 900 元" },
  })
  await prisma.pointsHistory.create({
    data: { customerId: c1.id, shopId: shop.id, points: 9, reason: "美容消費 900 元，累積 9 點" },
  })

  const g1c = await prisma.groomingRecord.create({
    data: {
      petId: p1.id, shopId: shop.id, groomerId: jason.id,
      services: JSON.stringify([{ name: "全套美容", price: 1200 }, { name: "指甲修剪", price: 150 }]),
      totalCost: 1350, skinCondition: "皮膚健康", furCondition: "毛況極佳",
      date: daysAgo(30),
    },
  })
  await prisma.payment.create({
    data: { shopId: shop.id, customerId: c1.id, groomingRecordId: g1c.id, amount: 1350, paymentMethod: "CARD", billingType: "SINGLE", status: "PAID", paidAt: new Date() },
  })
  await prisma.pointsHistory.create({
    data: { customerId: c1.id, shopId: shop.id, points: 13, reason: "美容消費 1350 元，累積 13 點" },
  })

  // 橘子：3筆美容紀錄
  const g2a = await prisma.groomingRecord.create({
    data: {
      petId: p2.id, shopId: shop.id, groomerId: jason.id,
      services: JSON.stringify([{ name: "洗澡+基礎剪毛", price: 900 }, { name: "肛門腺清潔", price: 100 }]),
      totalCost: 1000, skinCondition: "皮膚輕微過敏", furCondition: "毛質適中",
      notes: "柴犬換毛季，毛量多，需仔細梳理", date: daysAgo(75),
    },
  })
  await prisma.payment.create({
    data: { shopId: shop.id, customerId: c1.id, groomingRecordId: g2a.id, amount: 1000, paymentMethod: "CASH", billingType: "SINGLE", status: "PAID", paidAt: new Date() },
  })
  await prisma.pointsHistory.create({
    data: { customerId: c1.id, shopId: shop.id, points: 10, reason: "美容消費 1000 元，累積 10 點" },
  })

  const g2b = await prisma.groomingRecord.create({
    data: {
      petId: p2.id, shopId: shop.id, groomerId: lily.id,
      services: JSON.stringify([{ name: "基礎洗澡", price: 600 }]),
      totalCost: 600, skinCondition: "皮膚正常", furCondition: "換毛期結束",
      date: daysAgo(45),
    },
  })
  await prisma.payment.create({
    data: { shopId: shop.id, customerId: c1.id, groomingRecordId: g2b.id, amount: 600, paymentMethod: null, billingType: "CREDIT", status: "PAID", paidAt: new Date() },
  })
  await prisma.storedValueHistory.create({
    data: { customerId: c1.id, shopId: shop.id, amount: -600, reason: "美容消費扣款 600 元" },
  })

  const g2c = await prisma.groomingRecord.create({
    data: {
      petId: p2.id, shopId: shop.id, groomerId: jason.id,
      services: JSON.stringify([{ name: "基礎洗澡", price: 600 }, { name: "耳朵清潔", price: 150 }]),
      totalCost: 750, skinCondition: "良好", furCondition: "毛色光亮",
      date: daysAgo(15),
    },
  })
  await prisma.payment.create({
    data: { shopId: shop.id, customerId: c1.id, groomingRecordId: g2c.id, amount: 750, paymentMethod: "CASH", billingType: "SINGLE", status: "PAID", paidAt: new Date() },
  })
  await prisma.pointsHistory.create({
    data: { customerId: c1.id, shopId: shop.id, points: 7, reason: "美容消費 750 元，累積 7 點" },
  })

  // 合約
  await prisma.contract.create({
    data: {
      petId: p1.id, shopId: shop.id, content: CONTRACT_TEMPLATE,
      status: "SIGNED", signedAt: new Date("2025-01-20"), signerName: "王小明",
      signatureUrl: "/uploads/sig_wang.png",
    },
  })
  await prisma.contract.create({
    data: { petId: p2.id, shopId: shop.id, content: CONTRACT_TEMPLATE, status: "PENDING" },
  })

  // ─── 客人 2：陳美華（一般，月租方案） ──────────────────────────────
  const c2 = await prisma.customer.create({
    data: {
      name: "陳美華",
      phone: "0987-654-321",
      lineId: "mei_hua_chen",
      address: "台北市中山區中山北路二段50號",
      shopId: shop.id,
      memberLevelId: levelNormal.id,
      storedValue: 500,
      points: 220,
      monthlyPlanId: monthlyPlan.id,
      monthlyPlanStartDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    },
  })

  const p3 = await prisma.pet.create({
    data: {
      name: "咪咪",
      species: "貓",
      breed: "英國短毛貓",
      gender: "FEMALE",
      birthday: new Date("2021-09-01"),
      chipNumber: "987654321098765",
      vaccineRecords: JSON.stringify([
        { id: "v4", name: "三合一疫苗", date: "2025-03-10", nextDate: "2026-03-10", clinic: "中山寵物醫院" },
        { id: "v5", name: "狂犬病疫苗", date: "2025-03-10", nextDate: "2026-03-10", clinic: "中山寵物醫院" },
      ]),
      customerId: c2.id,
      shopId: shop.id,
      notes: "貓咪較緊張，請耐心溫柔對待",
    },
  })

  const p4 = await prisma.pet.create({
    data: {
      name: "奶油",
      species: "犬",
      breed: "博美犬",
      gender: "MALE",
      birthday: new Date("2022-04-15"),
      vaccineRecords: JSON.stringify([
        { id: "v6", name: "五合一疫苗", date: "2025-04-01", nextDate: "2026-04-01", clinic: "大安動物醫院" },
      ]),
      customerId: c2.id,
      shopId: shop.id,
    },
  })

  const p5 = await prisma.pet.create({
    data: {
      name: "豆豆",
      species: "犬",
      breed: "臘腸犬",
      gender: "MALE",
      birthday: new Date("2020-11-30"),
      customerId: c2.id,
      shopId: shop.id,
    },
  })

  // 咪咪：3筆
  const g3a = await prisma.groomingRecord.create({
    data: {
      petId: p3.id, shopId: shop.id, groomerId: lily.id,
      services: JSON.stringify([{ name: "基礎洗澡", price: 600 }]),
      totalCost: 600, skinCondition: "皮膚健康", furCondition: "短毛易整理",
      notes: "貓咪配合度高", date: daysAgo(80),
    },
  })
  await prisma.payment.create({
    data: { shopId: shop.id, customerId: c2.id, groomingRecordId: g3a.id, amount: 600, paymentMethod: "CASH", billingType: "SINGLE", status: "PAID", paidAt: new Date() },
  })
  await prisma.pointsHistory.create({
    data: { customerId: c2.id, shopId: shop.id, points: 6, reason: "美容消費 600 元，累積 6 點" },
  })

  const g3b = await prisma.groomingRecord.create({
    data: {
      petId: p3.id, shopId: shop.id, groomerId: lily.id,
      services: JSON.stringify([{ name: "基礎洗澡", price: 600 }, { name: "指甲修剪", price: 150 }]),
      totalCost: 750, skinCondition: "皮膚正常", furCondition: "毛況好",
      date: daysAgo(50),
    },
  })
  await prisma.payment.create({
    data: { shopId: shop.id, customerId: c2.id, groomingRecordId: g3b.id, amount: 750, paymentMethod: "CASH", billingType: "SINGLE", status: "PAID", paidAt: new Date() },
  })
  await prisma.pointsHistory.create({
    data: { customerId: c2.id, shopId: shop.id, points: 7, reason: "美容消費 750 元，累積 7 點" },
  })

  const g3c = await prisma.groomingRecord.create({
    data: {
      petId: p3.id, shopId: shop.id, groomerId: jason.id,
      services: JSON.stringify([{ name: "基礎洗澡", price: 600 }]),
      totalCost: 600, skinCondition: "略有皮屑，建議使用藥浴", furCondition: "正常",
      date: daysAgo(20),
    },
  })
  await prisma.payment.create({
    data: { shopId: shop.id, customerId: c2.id, groomingRecordId: g3c.id, amount: 600, paymentMethod: "CASH", billingType: "SINGLE", status: "PAID", paidAt: new Date() },
  })

  // 奶油：3筆
  const g4a = await prisma.groomingRecord.create({
    data: {
      petId: p4.id, shopId: shop.id, groomerId: jason.id,
      services: JSON.stringify([{ name: "全套美容", price: 1200 }]),
      totalCost: 1200, skinCondition: "皮膚好", furCondition: "蓬鬆可愛",
      date: daysAgo(70),
    },
  })
  await prisma.payment.create({
    data: { shopId: shop.id, customerId: c2.id, groomingRecordId: g4a.id, amount: 1200, paymentMethod: "LINE_PAY", billingType: "SINGLE", status: "PAID", paidAt: new Date() },
  })
  await prisma.pointsHistory.create({
    data: { customerId: c2.id, shopId: shop.id, points: 12, reason: "美容消費 1200 元，累積 12 點" },
  })

  const g4b = await prisma.groomingRecord.create({
    data: {
      petId: p4.id, shopId: shop.id, groomerId: lily.id,
      services: JSON.stringify([{ name: "全套美容", price: 1200 }, { name: "牙齒清潔", price: 200 }]),
      totalCost: 1400, skinCondition: "健康", furCondition: "毛量豐厚",
      date: daysAgo(40),
    },
  })
  await prisma.payment.create({
    data: { shopId: shop.id, customerId: c2.id, groomingRecordId: g4b.id, amount: 1400, paymentMethod: "CASH", billingType: "SINGLE", status: "PAID", paidAt: new Date() },
  })
  await prisma.pointsHistory.create({
    data: { customerId: c2.id, shopId: shop.id, points: 14, reason: "美容消費 1400 元，累積 14 點" },
  })

  const g4c = await prisma.groomingRecord.create({
    data: {
      petId: p4.id, shopId: shop.id, groomerId: jason.id,
      services: JSON.stringify([{ name: "全套美容", price: 1200 }]),
      totalCost: 1200, skinCondition: "皮膚狀況極佳", furCondition: "蓬鬆整齊",
      date: daysAgo(10),
    },
  })
  await prisma.payment.create({
    data: { shopId: shop.id, customerId: c2.id, groomingRecordId: g4c.id, amount: 1200, paymentMethod: "CARD", billingType: "SINGLE", status: "PAID", paidAt: new Date() },
  })
  await prisma.pointsHistory.create({
    data: { customerId: c2.id, shopId: shop.id, points: 12, reason: "美容消費 1200 元，累積 12 點" },
  })

  // 豆豆：3筆
  const g5a = await prisma.groomingRecord.create({
    data: {
      petId: p5.id, shopId: shop.id, groomerId: lily.id,
      services: JSON.stringify([{ name: "洗澡+基礎剪毛", price: 900 }]),
      totalCost: 900, skinCondition: "正常", furCondition: "短腿毛剪難度高",
      date: daysAgo(65),
    },
  })
  await prisma.payment.create({
    data: { shopId: shop.id, customerId: c2.id, groomingRecordId: g5a.id, amount: 900, paymentMethod: "CASH", billingType: "SINGLE", status: "PAID", paidAt: new Date() },
  })

  const g5b = await prisma.groomingRecord.create({
    data: {
      petId: p5.id, shopId: shop.id, groomerId: jason.id,
      services: JSON.stringify([{ name: "洗澡+基礎剪毛", price: 900 }, { name: "指甲修剪", price: 150 }]),
      totalCost: 1050, skinCondition: "皮膚健康", furCondition: "毛色深褐，有光澤",
      date: daysAgo(35),
    },
  })
  await prisma.payment.create({
    data: { shopId: shop.id, customerId: c2.id, groomingRecordId: g5b.id, amount: 1050, paymentMethod: "CASH", billingType: "SINGLE", status: "PAID", paidAt: new Date() },
  })

  const g5c = await prisma.groomingRecord.create({
    data: {
      petId: p5.id, shopId: shop.id, groomerId: lily.id,
      services: JSON.stringify([{ name: "基礎洗澡", price: 600 }]),
      totalCost: 600, skinCondition: "正常", furCondition: "整潔",
      date: daysAgo(7),
    },
  })
  await prisma.payment.create({
    data: { shopId: shop.id, customerId: c2.id, groomingRecordId: g5c.id, amount: 600, paymentMethod: "CASH", billingType: "SINGLE", status: "PAID", paidAt: new Date() },
  })

  // 合約
  await prisma.contract.create({
    data: {
      petId: p3.id, shopId: shop.id, content: CONTRACT_TEMPLATE,
      status: "SIGNED", signedAt: new Date("2025-02-15"), signerName: "陳美華",
      signatureUrl: "/uploads/sig_chen.png",
    },
  })
  await prisma.contract.create({
    data: {
      petId: p4.id, shopId: shop.id, content: CONTRACT_TEMPLATE,
      status: "SIGNED", signedAt: new Date("2025-03-01"), signerName: "陳美華",
      signatureUrl: "/uploads/sig_chen2.png",
    },
  })
  await prisma.contract.create({
    data: { petId: p5.id, shopId: shop.id, content: CONTRACT_TEMPLATE, status: "PENDING" },
  })

  // ─── 客人 3：李大同（白金，高消費） ────────────────────────────────
  const c3 = await prisma.customer.create({
    data: {
      name: "李大同",
      phone: "0922-111-222",
      shopId: shop.id,
      memberLevelId: levelPlatinum.id,
      storedValue: 8000,
      points: 3500,
      notes: "白金客戶，服務優先安排",
    },
  })

  const p6 = await prisma.pet.create({
    data: {
      name: "大壯",
      species: "犬",
      breed: "黃金獵犬",
      gender: "MALE",
      birthday: new Date("2018-12-25"),
      chipNumber: "111222333444555",
      vaccineRecords: JSON.stringify([
        { id: "v7", name: "狂犬病疫苗", date: "2025-02-10", nextDate: "2026-02-10", clinic: "信義動物醫院" },
        { id: "v8", name: "八合一疫苗", date: "2025-02-10", nextDate: "2026-02-10", clinic: "信義動物醫院" },
      ]),
      diseases: "輕微關節問題",
      customerId: c3.id,
      shopId: shop.id,
    },
  })

  const p7 = await prisma.pet.create({
    data: {
      name: "可樂",
      species: "犬",
      breed: "法國鬥牛犬",
      gender: "FEMALE",
      birthday: new Date("2021-07-04"),
      vaccineRecords: JSON.stringify([
        { id: "v9", name: "五合一疫苗", date: "2025-01-05", nextDate: "2026-01-05", clinic: "信義動物醫院" },
      ]),
      customerId: c3.id,
      shopId: shop.id,
      notes: "短鼻犬，洗澡時特別注意呼吸",
    },
  })

  // 大壯：3筆（高消費）
  const g6a = await prisma.groomingRecord.create({
    data: {
      petId: p6.id, shopId: shop.id, groomerId: jason.id,
      services: JSON.stringify([{ name: "貴賓剪", price: 1500 }, { name: "牙齒清潔", price: 200 }, { name: "耳朵清潔", price: 150 }]),
      totalCost: 1850, skinCondition: "皮膚健康，偶有掉毛", furCondition: "金色亮麗，長毛需定期修剪",
      notes: "老狗，動作輕柔", date: daysAgo(85),
    },
  })
  await prisma.payment.create({
    data: { shopId: shop.id, customerId: c3.id, groomingRecordId: g6a.id, amount: 1850, paymentMethod: "CARD", billingType: "SINGLE", status: "PAID", paidAt: new Date() },
  })
  await prisma.pointsHistory.create({
    data: { customerId: c3.id, shopId: shop.id, points: 18, reason: "美容消費 1850 元，累積 18 點" },
  })

  const g6b = await prisma.groomingRecord.create({
    data: {
      petId: p6.id, shopId: shop.id, groomerId: jason.id,
      services: JSON.stringify([{ name: "貴賓剪", price: 1500 }, { name: "肛門腺清潔", price: 100 }]),
      totalCost: 1600, skinCondition: "皮膚乾燥，已建議補充保濕噴霧", furCondition: "毛量減少（老化正常現象）",
      date: daysAgo(55),
    },
  })
  await prisma.payment.create({
    data: { shopId: shop.id, customerId: c3.id, groomingRecordId: g6b.id, amount: 1600, paymentMethod: null, billingType: "CREDIT", status: "PAID", paidAt: new Date() },
  })
  await prisma.storedValueHistory.create({
    data: { customerId: c3.id, shopId: shop.id, amount: -1600, reason: "美容消費扣款 1600 元" },
  })
  await prisma.pointsHistory.create({
    data: { customerId: c3.id, shopId: shop.id, points: 16, reason: "美容消費 1600 元，累積 16 點" },
  })

  const g6c = await prisma.groomingRecord.create({
    data: {
      petId: p6.id, shopId: shop.id, groomerId: lily.id,
      services: JSON.stringify([{ name: "全套美容", price: 1200 }, { name: "指甲修剪", price: 150 }]),
      totalCost: 1350, skinCondition: "皮膚改善", furCondition: "毛況穩定",
      date: daysAgo(25),
    },
  })
  await prisma.payment.create({
    data: { shopId: shop.id, customerId: c3.id, groomingRecordId: g6c.id, amount: 1350, paymentMethod: "CARD", billingType: "SINGLE", status: "PAID", paidAt: new Date() },
  })
  await prisma.pointsHistory.create({
    data: { customerId: c3.id, shopId: shop.id, points: 13, reason: "美容消費 1350 元，累積 13 點" },
  })

  // 可樂：3筆
  const g7a = await prisma.groomingRecord.create({
    data: {
      petId: p7.id, shopId: shop.id, groomerId: lily.id,
      services: JSON.stringify([{ name: "基礎洗澡", price: 600 }, { name: "耳朵清潔", price: 150 }]),
      totalCost: 750, skinCondition: "皺褶處需特別清潔", furCondition: "短毛易清理",
      notes: "短鼻犬，全程保持冷靜環境", date: daysAgo(72),
    },
  })
  await prisma.payment.create({
    data: { shopId: shop.id, customerId: c3.id, groomingRecordId: g7a.id, amount: 750, paymentMethod: "CASH", billingType: "SINGLE", status: "PAID", paidAt: new Date() },
  })

  const g7b = await prisma.groomingRecord.create({
    data: {
      petId: p7.id, shopId: shop.id, groomerId: jason.id,
      services: JSON.stringify([{ name: "基礎洗澡", price: 600 }, { name: "指甲修剪", price: 150 }, { name: "肛門腺清潔", price: 100 }]),
      totalCost: 850, skinCondition: "皺褶清潔乾淨", furCondition: "正常",
      date: daysAgo(42),
    },
  })
  await prisma.payment.create({
    data: { shopId: shop.id, customerId: c3.id, groomingRecordId: g7b.id, amount: 850, paymentMethod: null, billingType: "CREDIT", status: "PAID", paidAt: new Date() },
  })
  await prisma.storedValueHistory.create({
    data: { customerId: c3.id, shopId: shop.id, amount: -850, reason: "美容消費扣款 850 元" },
  })

  const g7c = await prisma.groomingRecord.create({
    data: {
      petId: p7.id, shopId: shop.id, groomerId: lily.id,
      services: JSON.stringify([{ name: "基礎洗澡", price: 600 }]),
      totalCost: 600, skinCondition: "皮膚健康", furCondition: "整潔",
      date: daysAgo(12),
    },
  })
  await prisma.payment.create({
    data: { shopId: shop.id, customerId: c3.id, groomingRecordId: g7c.id, amount: 600, paymentMethod: "CASH", billingType: "SINGLE", status: "PAID", paidAt: new Date() },
  })

  // 合約
  await prisma.contract.create({
    data: {
      petId: p6.id, shopId: shop.id, content: CONTRACT_TEMPLATE,
      status: "SIGNED", signedAt: new Date("2024-12-10"), signerName: "李大同",
      signatureUrl: "/uploads/sig_lee.png",
    },
  })
  await prisma.contract.create({
    data: {
      petId: p7.id, shopId: shop.id, content: CONTRACT_TEMPLATE,
      status: "SIGNED", signedAt: new Date("2025-01-05"), signerName: "李大同",
      signatureUrl: "/uploads/sig_lee2.png",
    },
  })

  // ─── 本週 5 筆預約（不同狀態）────────────────────────────────────
  console.log("📅 建立本週預約...")
  await prisma.appointment.create({
    data: {
      petId: p1.id, shopId: shop.id, staffId: lily.id, type: "GROOMING",
      scheduledAt: thisWeekDay(0, 9), duration: 120, status: "COMPLETED",
      services: JSON.stringify([{ name: "全套美容", price: 1200 }]),
      estimatedCost: 1200, source: "LINE",
    },
  })
  await prisma.appointment.create({
    data: {
      petId: p3.id, shopId: shop.id, staffId: lily.id, type: "GROOMING",
      scheduledAt: thisWeekDay(1, 10), duration: 90, status: "CONFIRMED",
      services: JSON.stringify([{ name: "基礎洗澡", price: 600 }]),
      estimatedCost: 600, source: "PHONE",
    },
  })
  await prisma.appointment.create({
    data: {
      petId: p4.id, shopId: shop.id, staffId: jason.id, type: "GROOMING",
      scheduledAt: thisWeekDay(2, 14), duration: 150, status: "CONFIRMED",
      services: JSON.stringify([{ name: "全套美容", price: 1200 }]),
      estimatedCost: 1200, source: "WALK_IN",
      notes: "博美毛多，時間抓長一點",
    },
  })
  await prisma.appointment.create({
    data: {
      petId: p6.id, shopId: shop.id, staffId: jason.id, type: "GROOMING",
      scheduledAt: thisWeekDay(3, 11), duration: 180, status: "PENDING",
      services: JSON.stringify([{ name: "貴賓剪", price: 1500 }]),
      estimatedCost: 1500, source: "LINE",
    },
  })
  await prisma.appointment.create({
    data: {
      petId: p2.id, shopId: shop.id, type: "GROOMING",
      scheduledAt: thisWeekDay(4, 15), duration: 90, status: "CANCELLED",
      services: JSON.stringify([{ name: "洗澡+基礎剪毛", price: 900 }]),
      estimatedCost: 900, source: "PHONE",
      notes: "客人臨時取消",
    },
  })

  // ─── 2 隻寵物住宿中 ────────────────────────────────────────────
  console.log("🏠 建立住宿紀錄...")
  await prisma.boardingRecord.create({
    data: {
      petId: p6.id, shopId: shop.id, roomId: createdRooms[4].id,
      checkIn: daysAgo(3), dailyRate: 1200, status: "STAYING",
      notes: "老狗，需要特別關注，定時帶出散步",
    },
  })
  await prisma.boardingRoom.update({ where: { id: createdRooms[4].id }, data: { status: "OCCUPIED" } })

  await prisma.boardingRecord.create({
    data: {
      petId: p7.id, shopId: shop.id, roomId: createdRooms[2].id,
      checkIn: daysAgo(1), dailyRate: 800, status: "STAYING",
      notes: "法鬥注意通風，避免過熱",
    },
  })
  await prisma.boardingRoom.update({ where: { id: createdRooms[2].id }, data: { status: "OCCUPIED" } })

  // ─── 儲值補充紀錄 ─────────────────────────────────────────────
  await prisma.storedValueHistory.create({
    data: { customerId: c1.id, shopId: shop.id, amount: 3000, reason: "客人現金儲值 3000 元" },
  })
  await prisma.storedValueHistory.create({
    data: { customerId: c3.id, shopId: shop.id, amount: 10000, reason: "客人轉帳儲值 10000 元" },
  })

  console.log("\n✅ 測試資料建立完成！")
  console.log("\n🔐 超級管理員:")
  console.log("  帳號  : superadmin@system.com")
  console.log("  密碼  : superadmin2026")
  console.log("  店家ID: system")
  console.log("\n📋 登入資訊:")
  console.log("  管理員  : admin@maomao.com / admin123")
  console.log("  Lily    : lily@maomao.com  / staff123")
  console.log("  Jason   : jason@maomao.com / staff123")
  console.log("\n👥 測試客人:")
  console.log(`  王小明 (VIP, 儲值$3000)        → ${c1.id}`)
  console.log(`  陳美華 (一般, 月租方案)         → ${c2.id}`)
  console.log(`  李大同 (白金, 儲值$8000)        → ${c3.id}`)
  console.log("\n🐾 寵物 (各有 3 筆美容紀錄):")
  console.log(`  小白 (馬爾濟斯)、橘子 (柴犬)    → 王小明`)
  console.log(`  咪咪 (英短)、奶油 (博美)、豆豆  → 陳美華`)
  console.log(`  大壯 (黃金)、可樂 (法鬥)        → 李大同`)
  console.log("\n🏠 住宿中: 大壯（5號房）、可樂（3號房）")
  console.log("📅 本週預約: 5筆（已完成/已確認/待確認/已取消）")
  console.log(`\n🔗 LINE 預約連結: http://localhost:3000/booking/${shop.id}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
