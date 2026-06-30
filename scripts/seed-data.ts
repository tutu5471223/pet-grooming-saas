import "dotenv/config"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"
import { PrismaClient } from "../app/generated/prisma/client"
import bcrypt from "bcryptjs"
import { randomBytes } from "crypto"

const url = process.env.DATABASE_URL!

// SEC-2: refuse to run against production unless explicitly allowed.
const isRenderProd = url.includes("render.com") || url.includes(".internal")
if ((isRenderProd || process.env.NODE_ENV === "production") && process.env.ALLOW_SEED !== "true") {
  console.error("❌ 拒絕在正式環境執行 seed-data。需設定 ALLOW_SEED=true。")
  process.exit(1)
}

const isLocal = url.includes("localhost") || url.includes("127.0.0.1") || url.startsWith("file:")
// SEC: verify TLS cert for remote DBs (consistent with lib/prisma.ts buildSsl).
const caCert = process.env.DATABASE_CA_CERT
const pool = new Pool({
  connectionString: url,
  ssl: isLocal ? undefined : caCert ? { rejectUnauthorized: true, ca: caCert } : { rejectUnauthorized: true },
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter } as any)

const SHOP_ID = "Tutu123456"
const SYSTEM_SHOP_ID = "system"

// SEC-1: passwords from env or generated + printed once; never hardcoded.
const generatedCreds: string[] = []
function seedPassword(envKey: string, label: string): string {
  const fromEnv = process.env[envKey]
  if (fromEnv) return fromEnv
  const pw = randomBytes(12).toString("base64url")
  generatedCreds.push(`  ${label.padEnd(28)} ${pw}   (env: ${envKey})`)
  return pw
}
const OWNER_EMAIL = process.env.SEED_OWNER_EMAIL ?? "owner@example.com"

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(10, 0, 0, 0)
  return d
}

function daysFromNow(n: number, hour = 10) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  d.setHours(hour, 0, 0, 0)
  return d
}

const CONTRACT_TEMPLATE = `<h2>寵物美容服務定型化契約</h2>
<p>立契約書人：________________________（以下簡稱甲方/客戶）與毛毛寵物美容（以下簡稱乙方/店家），雙方同意遵守下列條款：</p>
<h3>一、服務範圍</h3>
<p>乙方提供寵物美容、洗澡、修剪等相關服務。服務項目及費用依預約時確認之內容為準。</p>
<h3>二、寵物健康聲明</h3>
<p>甲方保證其寵物健康狀況良好，無傳染性疾病，且疫苗接種均已完成並有效。若寵物有特殊病史、過敏或行為問題，甲方應於服務前告知乙方。</p>
<h3>三、免責聲明</h3>
<p>若寵物因年齡、健康狀況或隱藏性疾病導致在美容過程中發生不適，乙方不負賠償責任，但乙方有義務給予必要之緊急處置。</p>
<h3>四、取消與改期</h3>
<p>預約取消或改期請提前24小時通知，當日取消或未到店將酌收取消費用。</p>
<p>甲方簽名即表示已閱讀並同意上述所有條款。</p>`

async function main() {
  console.log("=== 開始建立測試資料 ===\n")

  // ── 系統超管 (upsert) ─────────────────────────────────────────
  console.log("🔐 確認系統超管...")
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

  // ── 主店家 (upsert) ───────────────────────────────────────────
  console.log("🏪 確認店家...")
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

  // ── 帳號 (upsert) ─────────────────────────────────────────────
  console.log("👤 確認帳號...")
  const ownerPw = await bcrypt.hash(seedPassword("SEED_OWNER_PASSWORD", `店主 ${OWNER_EMAIL}`), 12)
  const owner = await prisma.user.upsert({
    where: { email_shopId: { email: OWNER_EMAIL, shopId: SHOP_ID } },
    // SEC: demo shop OWNER is a regular tenant owner, NOT a platform superadmin.
    // Platform superadmin is reserved for the system shop account above.
    update: { password: ownerPw, isSuperAdmin: false, isActive: true, role: "OWNER" },
    create: {
      name: "Tutu 老闆", email: OWNER_EMAIL, password: ownerPw,
      role: "OWNER", shopId: SHOP_ID, isSuperAdmin: false, isActive: true,
    },
  })

  const staffPw = await bcrypt.hash(seedPassword("SEED_STAFF_PASSWORD", "美容師 (lily/jason)"), 10)
  const lily = await prisma.user.upsert({
    where: { email_shopId: { email: "lily@maomao.com", shopId: SHOP_ID } },
    update: { isActive: true },
    create: { name: "Lily 美容師", email: "lily@maomao.com", password: staffPw, role: "STAFF", shopId: SHOP_ID },
  })
  const jason = await prisma.user.upsert({
    where: { email_shopId: { email: "jason@maomao.com", shopId: SHOP_ID } },
    update: { isActive: true },
    create: { name: "Jason 美容師", email: "jason@maomao.com", password: staffPw, role: "STAFF", shopId: SHOP_ID },
  })
  console.log(`  owner: ${owner.id}, lily: ${lily.id}, jason: ${jason.id}`)

  // ── 訂閱方案 (upsert) ─────────────────────────────────────────
  console.log("📦 確認訂閱方案...")
  const planBasic = await prisma.plan.upsert({
    where: { id: "plan-basic" },
    update: {},
    create: {
      id: "plan-basic", name: "基礎版", price: 499, interval: "MONTHLY",
      maxCustomers: 200, maxPets: 500, maxStaff: 5,
      features: JSON.stringify(["所有試用版功能", "操作稽核記錄"]),
      isActive: true,
    },
  })
  const existingSub = await prisma.subscription.findFirst({ where: { shopId: SHOP_ID } })
  if (!existingSub) {
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 30)
    await prisma.subscription.create({
      data: { shopId: shop.id, planId: planBasic.id, status: "TRIAL", currentPeriodStart: new Date(), currentPeriodEnd: trialEnd },
    })
  }

  // ── 會員等級 (upsert via name) ────────────────────────────────
  console.log("🏅 確認會員等級...")
  const existingLevels = await prisma.memberLevel.findMany({ where: { shopId: SHOP_ID } })
  let levelNormal = existingLevels.find(l => l.name === "一般會員")
  let levelVip = existingLevels.find(l => l.name === "VIP 會員")
  let levelPlatinum = existingLevels.find(l => l.name === "白金會員")

  if (!levelNormal) levelNormal = await prisma.memberLevel.create({
    data: { shopId: SHOP_ID, name: "一般會員", minPoints: 0, discountRate: 0, benefits: "基本服務", color: "#6b7280" },
  })
  if (!levelVip) levelVip = await prisma.memberLevel.create({
    data: { shopId: SHOP_ID, name: "VIP 會員", minPoints: 500, discountRate: 0.05, benefits: "95折優惠、生日禮", color: "#8b5cf6" },
  })
  if (!levelPlatinum) levelPlatinum = await prisma.memberLevel.create({
    data: { shopId: SHOP_ID, name: "白金會員", minPoints: 2000, discountRate: 0.1, benefits: "9折優惠、優先預約", color: "#f59e0b" },
  })

  // ── 服務項目 ──────────────────────────────────────────────────
  console.log("📋 確認服務項目...")
  const svcDefs = [
    { name: "基礎洗澡", category: "洗澡", price: 600, duration: 90 },
    { name: "洗澡+基礎剪毛", category: "美容", price: 900, duration: 120 },
    { name: "全套美容", category: "美容", price: 1200, duration: 150 },
    { name: "貴賓剪", category: "美容", price: 1500, duration: 180 },
    { name: "指甲修剪", category: "單項", price: 150, duration: 20 },
    { name: "耳朵清潔", category: "單項", price: 150, duration: 15 },
  ]
  const existingServices = await prisma.service.findMany({ where: { shopId: SHOP_ID } })
  for (const s of svcDefs) {
    if (!existingServices.find(es => es.name === s.name)) {
      await prisma.service.create({ data: { ...s, shopId: SHOP_ID } })
    }
  }

  // ── 住宿房間 ──────────────────────────────────────────────────
  console.log("🏠 確認住宿房間...")
  const roomDefs = [
    { name: "1號房", type: "小型", dailyRate: 500 },
    { name: "2號房", type: "小型", dailyRate: 500 },
    { name: "3號房", type: "中型", dailyRate: 800 },
    { name: "豪華套房", type: "豪華", dailyRate: 2000 },
  ]
  const existingRooms = await prisma.boardingRoom.findMany({ where: { shopId: SHOP_ID } })
  const rooms: { id: string }[] = [...existingRooms]
  for (const r of roomDefs) {
    if (!existingRooms.find(er => er.name === r.name)) {
      rooms.push(await prisma.boardingRoom.create({ data: { ...r, shopId: SHOP_ID } }))
    }
  }

  // ── 客人 1：王小明（VIP） ────────────────────────────────────
  console.log("\n👥 建立客人與寵物...")
  const c1 = await prisma.customer.create({
    data: {
      name: "王小明", phone: "0912345678", lineId: "wang_ming",
      address: "台北市信義區松仁路100號", shopId: SHOP_ID,
      memberLevelId: levelVip!.id, storedValue: 2000, points: 650,
      notes: "喜歡狗狗多留毛",
    },
  })
  const p1 = await prisma.pet.create({
    data: {
      name: "小白", species: "犬", breed: "馬爾濟斯", gender: "MALE",
      birthday: new Date("2020-03-15"),
      skinIssue: true, skinNote: "對某些洗毛精敏感，請使用低敏配方",
      customerId: c1.id, shopId: SHOP_ID,
    },
  })
  const p2 = await prisma.pet.create({
    data: { name: "橘子", species: "犬", breed: "柴犬", gender: "FEMALE", birthday: new Date("2019-06-20"), customerId: c1.id, shopId: SHOP_ID },
  })
  console.log(`  c1 王小明: ${c1.id}, p1 小白: ${p1.id}, p2 橘子: ${p2.id}`)

  // 王小明的美容紀錄
  const gr1 = await prisma.groomingRecord.create({
    data: { petId: p1.id, shopId: SHOP_ID, groomerId: lily.id, services: JSON.stringify([{ name: "全套美容", price: 1200 }, { name: "耳朵清潔", price: 150 }]), totalCost: 1350, notes: "毛留長一點", date: daysAgo(30) },
  })
  await prisma.payment.create({
    data: { shopId: SHOP_ID, customerId: c1.id, petId: p1.id, groomingRecordId: gr1.id, amount: 1350, paymentMethod: "CASH", billingType: "SINGLE", status: "PAID", paidAt: daysAgo(30) },
  })
  const gr2 = await prisma.groomingRecord.create({
    data: { petId: p2.id, shopId: SHOP_ID, groomerId: jason.id, services: JSON.stringify([{ name: "洗澡+基礎剪毛", price: 900 }]), totalCost: 900, date: daysAgo(15) },
  })
  await prisma.payment.create({
    data: { shopId: SHOP_ID, customerId: c1.id, petId: p2.id, groomingRecordId: gr2.id, amount: 900, paymentMethod: "CARD", billingType: "SINGLE", status: "PAID", paidAt: daysAgo(15) },
  })

  // 王小明的合約
  await prisma.contract.create({
    data: { petId: p1.id, shopId: SHOP_ID, content: CONTRACT_TEMPLATE, status: "SIGNED", signedAt: new Date("2025-01-20"), signerName: "王小明" },
  })

  // ── 客人 2：陳美華（一般） ───────────────────────────────────
  const c2 = await prisma.customer.create({
    data: {
      name: "陳美華", phone: "0933888555",
      shopId: SHOP_ID, memberLevelId: levelNormal!.id,
      storedValue: 0, points: 120,
    },
  })
  const p3 = await prisma.pet.create({
    data: { name: "咪咪", species: "貓", breed: "英國短毛貓", gender: "FEMALE", birthday: new Date("2021-09-01"), notes: "貓咪較緊張，請耐心", customerId: c2.id, shopId: SHOP_ID },
  })
  const p4 = await prisma.pet.create({
    data: { name: "奶油", species: "犬", breed: "博美犬", gender: "MALE", birthday: new Date("2022-04-15"), customerId: c2.id, shopId: SHOP_ID },
  })
  console.log(`  c2 陳美華: ${c2.id}, p3 咪咪: ${p3.id}, p4 奶油: ${p4.id}`)

  const gr3 = await prisma.groomingRecord.create({
    data: { petId: p3.id, shopId: SHOP_ID, groomerId: lily.id, services: JSON.stringify([{ name: "基礎洗澡", price: 600 }]), totalCost: 600, date: daysAgo(20) },
  })
  await prisma.payment.create({
    data: { shopId: SHOP_ID, customerId: c2.id, petId: p3.id, groomingRecordId: gr3.id, amount: 600, paymentMethod: "CASH", billingType: "SINGLE", status: "PAID", paidAt: daysAgo(20) },
  })

  // ── 客人 3：李大同（白金） ───────────────────────────────────
  const c3 = await prisma.customer.create({
    data: {
      name: "李大同", phone: "0922111222", shopId: SHOP_ID,
      memberLevelId: levelPlatinum!.id, storedValue: 5000, points: 3500,
      notes: "白金客戶，服務優先安排",
    },
  })
  const p5 = await prisma.pet.create({
    data: { name: "大壯", species: "犬", breed: "黃金獵犬", gender: "MALE", birthday: new Date("2018-12-25"), boneIssue: true, boneNote: "輕微關節問題", customerId: c3.id, shopId: SHOP_ID },
  })
  console.log(`  c3 李大同: ${c3.id}, p5 大壯: ${p5.id}`)

  const gr4 = await prisma.groomingRecord.create({
    data: { petId: p5.id, shopId: SHOP_ID, groomerId: jason.id, services: JSON.stringify([{ name: "貴賓剪", price: 1500 }, { name: "指甲修剪", price: 150 }]), totalCost: 1650, date: daysAgo(25) },
  })
  await prisma.payment.create({
    data: { shopId: SHOP_ID, customerId: c3.id, petId: p5.id, groomingRecordId: gr4.id, amount: 1650, paymentMethod: "CARD", billingType: "SINGLE", status: "PAID", paidAt: daysAgo(25) },
  })

  // ── 預約 ──────────────────────────────────────────────────────
  console.log("\n📅 建立預約...")
  // 待確認預約（明天）
  const appt1 = await prisma.appointment.create({
    data: { petId: p1.id, shopId: SHOP_ID, staffId: lily.id, type: "GROOMING", scheduledAt: daysFromNow(1, 10), duration: 120, status: "PENDING", services: JSON.stringify([{ name: "全套美容", price: 1200 }]), estimatedCost: 1200, source: "LINE" },
  })
  // 已確認預約（後天）
  const appt2 = await prisma.appointment.create({
    data: { petId: p3.id, shopId: SHOP_ID, staffId: lily.id, type: "GROOMING", scheduledAt: daysFromNow(2, 14), duration: 90, status: "CONFIRMED", services: JSON.stringify([{ name: "基礎洗澡", price: 600 }]), estimatedCost: 600, source: "PHONE" },
  })
  // 本週預約
  const appt3 = await prisma.appointment.create({
    data: { petId: p5.id, shopId: SHOP_ID, staffId: jason.id, type: "GROOMING", scheduledAt: daysFromNow(3, 11), duration: 150, status: "PENDING", services: JSON.stringify([{ name: "貴賓剪", price: 1500 }]), estimatedCost: 1500, source: "WALK_IN" },
  })
  // 過去已完成預約
  const appt4 = await prisma.appointment.create({
    data: { petId: p2.id, shopId: SHOP_ID, staffId: jason.id, type: "GROOMING", scheduledAt: daysAgo(15), duration: 90, status: "COMPLETED", services: JSON.stringify([{ name: "洗澡+基礎剪毛", price: 900 }]), estimatedCost: 900 },
  })
  console.log(`  appt1(PENDING): ${appt1.id}`)
  console.log(`  appt2(CONFIRMED): ${appt2.id}`)
  console.log(`  appt3(PENDING): ${appt3.id}`)
  console.log(`  appt4(COMPLETED): ${appt4.id}`)

  // ── 住宿紀錄 ──────────────────────────────────────────────────
  console.log("\n🏠 建立住宿紀錄...")
  const roomToUse = rooms[0]
  if (roomToUse) {
    const boarding = await prisma.boardingRecord.create({
      data: { petId: p5.id, shopId: SHOP_ID, roomId: roomToUse.id, checkIn: daysAgo(2), dailyRate: 500, status: "STAYING", notes: "大型犬，需寬敞空間" },
    })
    await prisma.boardingRoom.update({ where: { id: roomToUse.id }, data: { status: "OCCUPIED" } })
    // 每日護理記錄
    await prisma.boardingDailyLog.create({
      data: { boardingRecordId: boarding.id, shopId: SHOP_ID, date: daysAgo(1), note: "進食正常，精神良好", condition: "良好", createdBy: lily.id },
    })
    console.log(`  boarding: ${boarding.id}, room: ${roomToUse.id}`)
  }

  // ── 商品 ──────────────────────────────────────────────────────
  console.log("\n🛍️ 確認商品...")
  const existingProducts = await prisma.product.findMany({ where: { shopId: SHOP_ID } })
  if (existingProducts.length === 0) {
    await prisma.product.createMany({
      data: [
        { shopId: SHOP_ID, name: "低敏洗毛精", category: "GROOMING", price: 350, stock: 20, unit: "瓶" },
        { shopId: SHOP_ID, name: "寵物潤毛乳", category: "GROOMING", price: 280, stock: 15, unit: "瓶" },
        { shopId: SHOP_ID, name: "寵物零食禮盒", category: "FOOD", price: 450, stock: 10, unit: "盒" },
      ],
    })
  }

  console.log("\n✅ 測試資料建立完成！")
  console.log("\n🔐 登入資訊:")
  console.log(`  Shop ID  : ${SHOP_ID}`)
  console.log(`  Email    : ${OWNER_EMAIL}`)
  if (generatedCreds.length > 0) {
    console.log("\n🔑 本次自動產生的密碼（請立即記下，不會再顯示）:")
    for (const line of generatedCreds) console.log(line)
  } else {
    console.log("  （密碼來自 SEED_*_PASSWORD 環境變數）")
  }
  console.log("\n📊 建立摘要:")
  console.log(`  客人: 王小明(${c1.id.slice(0,8)}), 陳美華(${c2.id.slice(0,8)}), 李大同(${c3.id.slice(0,8)})`)
  console.log(`  寵物: 小白/橘子/咪咪/奶油/大壯`)
  console.log(`  預約: 4筆 (1待確認/1已確認/1待確認/1已完成)`)
  console.log(`  美容紀錄: 4筆`)
  console.log(`  住宿: 1筆 (大壯 入住中)`)
}

main().catch(e => { console.error("ERROR:", e.message, e.stack); process.exit(1) }).finally(() => prisma.$disconnect())
