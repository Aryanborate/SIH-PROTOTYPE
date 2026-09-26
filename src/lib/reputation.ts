// GigSetu Phase 5 — Cooperative Reputation (#36)
// Cooperative-level service performance (not just individual worker ratings).

import { db } from './db'

export interface CoopReputationDTO {
  coopId: string
  name: string
  jobsCompleted: number
  onTimePct: number
  complaintRatePct: number
  avgRating: number
  verifiedWorkersPct: number
  emergencyResponseMin: number
  repeatCustomerPct: number
  workerCount: number
  memberCount: number
  verificationBadges: string[]
  note: string
}

export async function getCoopReputation(coopId: string): Promise<CoopReputationDTO | null> {
  const coop = await db.cooperative.findUnique({
    where: { id: coopId },
    include: { workers: { select: { certStatus: true, rating: true, id: true } }, registration: true },
  })
  if (!coop) return null

  const ids = coop.workers.map((w) => w.id)
  const completed = ids.length
    ? await db.booking.count({ where: { workerId: { in: ids }, status: { in: ['COMPLETED', 'PAID', 'REVIEWED'] } } })
    : 0
  const rated = ids.length
    ? await db.booking.findMany({ where: { workerId: { in: ids }, rating: { not: null } }, select: { rating: true }, take: 500 })
    : []
  const avgRating = rated.length ? Math.round((rated.reduce((a, b) => a + (b.rating ?? 0), 0) / rated.length) * 100) / 100 : 0
  const complaints = await db.complaint.count({ where: { cooperativeId: coopId } })
  const jobsCompleted = coop.jobsToday * 22 + completed // completed-this-month = daily rate × working days + verified rows
  const complaintRatePct = jobsCompleted ? Math.round((complaints / jobsCompleted) * 1000) / 10 : 0
  const verifiedWorkersPct = coop.workers.length
    ? Math.round((coop.workers.filter((w) => w.certStatus === 'VERIFIED').length / coop.workers.length) * 1000) / 10
    : 0

  // Real counts where available, honest synthetic fallback for on-time% and response
  // (prototype: on-time/response derive from utilization + SLA policy, clearly synthetic)
  const onTimePct = Math.min(98, Math.max(85, Math.round(coop.utilizationPct + 18)))
  const emergencyResponseMin = Math.max(6, Math.round(18 - coop.emergencyPoolSize / 10))

  const badges: string[] = []
  if (coop.verification === 'VERIFIED' || coop.registration) badges.push('ORG_VERIFIED')
  if (coop.activeToday > 0) badges.push('SERVICE_READY')
  if (coop.welfareFundRs > 0) badges.push('WELFARE_READY')
  if (verifiedWorkersPct >= 90 && complaintRatePct < 3) badges.push('OPERATIONALLY_TRUSTED')

  return {
    coopId,
    name: coop.name,
    jobsCompleted,
    onTimePct,
    complaintRatePct,
    avgRating,
    verifiedWorkersPct,
    emergencyResponseMin,
    repeatCustomerPct: Math.min(46, Math.round(completed / 40) + 18),
    workerCount: coop.workers.length,
    memberCount: coop.memberCount,
    verificationBadges: badges,
    note: 'Cooperative-level service performance — prototype figures combine verified booking rows with synthetic aggregate rates.',
  }
}
