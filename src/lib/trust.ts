// GigSetu Phase 5 — Two-Sided Trust (#35)
// Transparent, explainable trust: customer multi-factor ratings (on Booking)
// + worker-side reports. NO hidden/derived "trust scores".

import { db } from './db'

export interface RatingBreakdown {
  quality: number
  timeliness: number
  behaviour: number
  communication: number
}

export interface WorkerTrustDTO {
  workerId: string
  workerName: string
  totalRatings: number
  average: number
  factors: { key: keyof RatingBreakdown; label: string; avg: number }[]
  complaintsOpen: number
  reportsAgainst: number
  note: string
}

export interface CoopTrustDTO {
  coopId: string
  totalRatings: number
  factors: { key: string; avg: number }[]
  workerReports: { category: string; count: number; resolved: number }[]
  openComplaints: number
  totalComplaints: number
  note: string
}

export const REPORT_CATEGORIES: Record<string, string> = {
  UNSAFE_ENV: 'Unsafe work environment',
  ABUSIVE_BEHAVIOUR: 'Abusive behaviour',
  REPEAT_CANCELLATION: 'Repeated cancellation',
  PAYMENT_ISSUE: 'Payment issue',
}

/** Aggregate multi-factor ratings for one worker from its bookings (transparent math). */
export async function getWorkerTrust(workerId: string): Promise<WorkerTrustDTO | null> {
  const worker = await db.worker.findUnique({ where: { id: workerId } })
  if (!worker) return null
  const rated = await db.booking.findMany({
    where: { workerId, ratingJson: { not: null } },
    select: { ratingJson: true },
    take: 300,
  })
  const parsed = rated.map((r) => JSON.parse(r.ratingJson as string) as RatingBreakdown)
  const avg = (arr: number[]) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100 : 0)
  const openComplaints = await db.complaint.count({ where: { workerId, status: { in: ['OPEN', 'RESOLVING'] } } })
  const reportsAgainst = await db.trustReport.count({ where: { workerId } })
  return {
    workerId,
    workerName: worker.name,
    totalRatings: parsed.length,
    average: worker.rating,
    factors: [
      { key: 'quality', label: 'Quality', avg: parsed.length ? avg(parsed.map((p) => p.quality)) : 0 },
      { key: 'timeliness', label: 'Timeliness', avg: parsed.length ? avg(parsed.map((p) => p.timeliness)) : 0 },
      { key: 'behaviour', label: 'Behaviour', avg: parsed.length ? avg(parsed.map((p) => p.behaviour)) : 0 },
      { key: 'communication', label: 'Communication', avg: parsed.length ? avg(parsed.map((p) => p.communication)) : 0 },
    ],
    complaintsOpen: openComplaints,
    reportsAgainst,
    note: 'Transparent ratings — only customer-submitted values, no hidden trust score.',
  }
}

/** Cooperative-level trust rollup: customer ratings + worker reports + complaints. */
export async function getCoopTrust(coopId: string): Promise<CoopTrustDTO | null> {
  const coop = await db.cooperative.findUnique({ where: { id: coopId } })
  if (!coop) return null
  const workers = await db.worker.findMany({ where: { cooperativeId: coopId }, select: { id: true } })
  const ids = workers.map((w) => w.id)
  const rated = ids.length
    ? await db.booking.findMany({
        where: { workerId: { in: ids }, ratingJson: { not: null } },
        select: { ratingJson: true },
        take: 500,
      })
    : []
  const parsed = rated.map((r) => JSON.parse(r.ratingJson as string) as RatingBreakdown)
  const avg = (arr: number[]) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100 : 0)
  const reports = ids.length ? await db.trustReport.findMany({ where: { workerId: { in: ids } } }) : []
  const byCat = new Map<string, { count: number; resolved: number }>()
  for (const r of reports) {
    const slot = byCat.get(r.category) ?? { count: 0, resolved: 0 }
    slot.count++
    if (r.status === 'RESOLVED') slot.resolved++
    byCat.set(r.category, slot)
  }
  const openComplaints = await db.complaint.count({ where: { cooperativeId: coopId, status: { in: ['OPEN', 'RESOLVING'] } } })
  const totalComplaints = await db.complaint.count({ where: { cooperativeId: coopId } })
  return {
    coopId,
    totalRatings: parsed.length,
    factors: [
      { key: 'quality', avg: avg(parsed.map((p) => p.quality)) },
      { key: 'timeliness', avg: avg(parsed.map((p) => p.timeliness)) },
      { key: 'behaviour', avg: avg(parsed.map((p) => p.behaviour)) },
      { key: 'communication', avg: avg(parsed.map((p) => p.communication)) },
    ],
    workerReports: [...byCat.entries()].map(([category, v]) => ({ category, ...v })),
    openComplaints,
    totalComplaints,
    note: 'Transparent cooperative trust — customer ratings, worker reports and the public complaint register. No hidden scores.',
  }
}

/** Worker files a report (unsafe environment, abusive behaviour, cancellation abuse, payment issue). */
export async function fileTrustReport(input: { workerId: string; bookingId?: string | null; category: string; detail: string }) {
  if (!REPORT_CATEGORIES[input.category]) throw new Error('Unknown report category')
  return db.trustReport.create({
    data: {
      workerId: input.workerId,
      bookingId: input.bookingId ?? null,
      category: input.category,
      detail: input.detail.slice(0, 500),
      status: 'OPEN',
    },
  })
}
