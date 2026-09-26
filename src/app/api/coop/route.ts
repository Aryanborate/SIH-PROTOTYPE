import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { hydrateBookings, tickMany } from '@/lib/booking-engine'
import { guard, notFound, ok, safeArray, safeObject } from '@/lib/http'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  return guard(async () => {
  let id = req.nextUrl.searchParams.get('id')

  // Graceful default for coordination roles without a home cooperative
  // (taluka/district/state viewers, platform admin): fall back to the featured society.
  if (!id) {
    const featured = await db.cooperative.findFirst({ where: { featured: true }, select: { id: true } })
    if (!featured) return notFound('No cooperative available. Run the seed first.')
    id = featured.id
  }

  const coop = await db.cooperative.findUnique({ where: { id } })
  if (!coop) return notFound('Cooperative not found.')

  const [workers, jobsRows, complaints, exchange, notes] = await Promise.all([
    db.worker.findMany({ where: { cooperativeId: id }, orderBy: [{ availability: 'asc' }, { rating: 'desc' }] }),
    db.booking.findMany({ where: { cooperativeId: id }, orderBy: { createdAt: 'desc' }, take: 40 }),
    db.complaint.findMany({ where: { cooperativeId: id }, orderBy: { createdAt: 'desc' }, take: 100 }),
    db.exchangeRecommendation.findMany({ where: { OR: [{ fromCoopId: id }, { toCoopId: id }] }, orderBy: { createdAt: 'desc' }, take: 50 }),
    db.notification.findMany({ where: { audience: 'COOP', audienceId: id }, orderBy: { createdAt: 'desc' }, take: 10 }),
  ])
  const jobs = await hydrateBookings(await tickMany(jobsRows))

  const certExpiring = workers.filter((w) => w.certStatus === 'EXPIRING' || (w.certExpiry && new Date(w.certExpiry) < new Date(Date.now() + 45 * 86400000)))
  const unavailable = workers.filter((w) => w.availability === 'OFFLINE')
  const serious = complaints.filter((c) => c.severity === 'SERIOUS' && c.status !== 'RESOLVED')

  const bySkillMap: Record<string, { skill: string; count: number; available: number; avgRating: number }> = {}
  workers.forEach((w) => {
    bySkillMap[w.primarySkill] = bySkillMap[w.primarySkill] ?? { skill: w.primarySkill, count: 0, available: 0, avgRating: 0 }
    const e = bySkillMap[w.primarySkill]
    e.count += 1
    if (w.availability !== 'OFFLINE') e.available += 1
    e.avgRating += w.rating
  })
  const bySkill = Object.values(bySkillMap).map((s) => ({ ...s, avgRating: Math.round((s.avgRating / Math.max(1, s.count)) * 100) / 100 }))

  const completedPaid = jobs.filter((b) => b.payment)
  const earningsByDay: Record<string, { date: string; total: number; jobs: number }> = {}
  completedPaid.forEach((b) => {
    const d = new Date(b.scheduledAt).toISOString().slice(0, 10)
    earningsByDay[d] = earningsByDay[d] ?? { date: d, total: 0, jobs: 0 }
    earningsByDay[d].total += b.payment?.amount ?? 0
    earningsByDay[d].jobs += 1
  })

  // Derived, not hardcoded: members whose primary trade has an open training course and who have not completed one.
  const openCourses = await db.trainingCourse.findMany({ select: { categoryKey: true } })
  const courseTrades = new Set(openCourses.map((c) => c.categoryKey))
  const enrolledWorkerIds = new Set((await db.trainingEnrollment.findMany({ where: { status: 'COMPLETED' }, select: { workerId: true } })).map((e) => e.workerId))
  const needTraining = workers.filter((w) => courseTrades.has(w.primarySkill) && !enrolledWorkerIds.has(w.id)).length
  const attention = {
    certExpiring: certExpiring.length,
    seriousComplaints: serious.length,
    unavailable: unavailable.length,
    needTraining,
    items: [
      { label: `${certExpiring.length} certifications expiring within 45 days`, severity: 'WARNING', action: 'certifications' },
      { label: `${serious.length} serious complaints open`, severity: 'SERIOUS', action: 'complaints' },
      { label: `${unavailable.length} workers unavailable today`, severity: 'INFO', action: 'workers' },
      { label: `${needTraining} workers need upskilling (federation queue)`, severity: 'WARNING', action: 'training' },
    ],
  }

  const pricingPolicy = safeObject<Record<string, unknown>>(coop.pricingPolicyJson)
  const emergencyPool = workers.filter((w) => w.emergencyPool)

  return ok({
    cooperative: {
      ...coop,
      pricingPolicyJson: undefined,
      pricingPolicy,
    },
    workers: workers.map((w) => ({ ...w, secondarySkills: safeArray(w.secondarySkills), languages: safeArray(w.languages), serviceAreas: safeArray(w.serviceAreas), skills: safeArray(w.skillsJson) })),
    bySkill,
    certifications: workers.filter((w) => w.certStatus !== 'VERIFIED').map((w) => ({ id: w.id, name: w.name, certName: w.certName, certStatus: w.certStatus, certExpiry: w.certExpiry })),
    attention,
    jobs,
    complaints,
    exchange,
    earnings: {
      month: coop.earningsMonthRs,
      byDay: Object.values(earningsByDay).sort((a, b) => a.date.localeCompare(b.date)),
      workerPayouts: completedPaid.slice(0, 8).map((b) => ({ job: b.refCode, worker: b.workerName, amount: b.payment?.workerShare ?? 0 })),
    },
    emergencyPool: emergencyPool.map((w) => ({ id: w.id, name: w.name, skill: w.primarySkill, rating: w.rating, availability: w.availability })),
    analytics: {
      utilization: coop.utilizationPct,
      jobsToday: coop.jobsToday,
      activeToday: coop.activeToday,
      demandMix: bySkill.map((s) => ({ skill: s.skill, count: s.count, available: s.available })),
      statusMix: [
        { status: 'Completed', count: jobs.filter((b) => ['COMPLETED', 'PAID', 'REVIEWED'].includes(b.status)).length },
        { status: 'In flight', count: jobs.filter((b) => ['REQUESTED', 'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS'].includes(b.status)).length },
        { status: 'Quote/negotiation', count: jobs.filter((b) => ['QUOTE_REQUESTED', 'QUOTED', 'NEGOTIATING'].includes(b.status)).length },
        { status: 'Cancelled', count: jobs.filter((b) => b.status === 'CANCELLED').length },
      ],
    },
    notifications: notes,
  })
  })
}
