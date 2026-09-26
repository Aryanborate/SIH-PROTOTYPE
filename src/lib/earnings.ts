// GigSetu Phase 5 — Worker Earnings dashboard aggregation (#39)
// Today / week / month / pending settlement derived from PAID bookings,
// plus a 7-day sparkline series for simple charts.

import { db } from './db'

export interface EarningsPoint {
  day: string // Mon..Sun
  date: string // ISO
  amount: number
  jobs: number
}

export interface WorkerEarningsDTO {
  today: number
  week: number
  month: number
  pending: number // COMPLETED jobs awaiting customer payment (worker share estimate)
  completedJobs: number
  todayJobs: number
  weekSeries: EarningsPoint[]
  categoryMix: { key: string; label: string; amount: number }[]
  prototypeNote: string
}

function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export async function getWorkerEarnings(workerId: string): Promise<WorkerEarningsDTO | null> {
  const worker = await db.worker.findUnique({ where: { id: workerId } })
  if (!worker) return null

  const bookings = await db.booking.findMany({
    where: { workerId, status: { in: ['PAID', 'REVIEWED', 'COMPLETED'] } },
    orderBy: { updatedAt: 'desc' },
    take: 400,
  })

  const now = new Date()
  const today0 = startOfDay(now)
  const week0 = new Date(today0)
  week0.setDate(week0.getDate() - 6)
  const month0 = new Date(now.getFullYear(), now.getMonth(), 1)

  let today = 0
  let week = 0
  let month = 0
  let todayJobs = 0
  let completedJobs = 0
  let pending = 0

  const seriesMap = new Map<string, { amount: number; jobs: number; date: string }>()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today0)
    d.setDate(d.getDate() - i)
    seriesMap.set(d.toDateString(), { amount: 0, jobs: 0, date: d.toISOString() })
  }
  const catMap = new Map<string, number>()

  for (const b of bookings) {
    const amount = b.finalPrice ?? 0
    const workerShare = b.paymentJson ? (JSON.parse(b.paymentJson as string).workerShare as number) ?? 0 : 0
    const paidAt = b.paymentJson ? new Date(JSON.parse(b.paymentJson as string).paidAt as string) : b.updatedAt
    if (b.status === 'COMPLETED') {
      completedJobs++
      pending += workerShare || Math.round(amount * 0.86)
      continue
    }
    // PAID / REVIEWED → settled earnings
    completedJobs++
    const day = startOfDay(paidAt)
    if (day.getTime() >= today0.getTime()) {
      today += workerShare
      todayJobs++
    }
    if (day.getTime() >= week0.getTime()) {
      week += workerShare
      const slot = seriesMap.get(day.toDateString())
      if (slot) {
        slot.amount += workerShare
        slot.jobs++
      }
    }
    if (paidAt >= month0) month += workerShare
    catMap.set(b.categoryKey, (catMap.get(b.categoryKey) ?? 0) + workerShare)
  }

  const weekSeries: EarningsPoint[] = [...seriesMap.entries()].map(([ts, v]) => ({
    day: DAY_LABELS[new Date(ts).getDay()],
    date: v.date,
    amount: v.amount,
    jobs: v.jobs,
  }))

  const catTotal = [...catMap.values()].reduce((a, b) => a + b, 0) || 1
  const categoryMix = [...catMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([key, amount]) => ({ key, label: key, amount, pct: Math.round((amount / catTotal) * 100) }))

  return {
    today,
    week,
    month,
    pending: Math.round(pending),
    completedJobs,
    todayJobs,
    weekSeries,
    categoryMix,
    prototypeNote: 'Prototype data — earnings derived from simulated bookings; settlement runs T+1 in the designed production flow.',
  }
}
