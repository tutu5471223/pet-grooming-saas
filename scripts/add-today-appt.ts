import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import { PrismaClient } from '../app/generated/prisma/client'

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter } as any)

async function main() {
  const pets = await prisma.pet.findMany({ where: { shopId: 'Tutu123456' }, select: { id: true, name: true }, take: 2 })
  const users = await prisma.user.findMany({ where: { shopId: 'Tutu123456', role: 'STAFF' }, take: 1 })
  console.log('pets:', JSON.stringify(pets))
  console.log('staff:', JSON.stringify(users))

  const today = new Date()
  today.setHours(14, 0, 0, 0)
  const appt = await prisma.appointment.create({
    data: {
      petId: pets[0].id,
      shopId: 'Tutu123456',
      staffId: users[0]?.id ?? null,
      type: 'GROOMING',
      scheduledAt: today,
      duration: 90,
      status: 'CONFIRMED',
      services: JSON.stringify([{ name: '全套美容', price: 1200 }]),
      estimatedCost: 1200,
      source: 'PHONE',
    }
  })
  console.log('Created today appt:', appt.id)
}
main().catch(e => console.error(e.message)).finally(() => prisma.$disconnect())
