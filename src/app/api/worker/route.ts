import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { hydrateBookings, tickMany, serializeBooking, releaseActiveJob } from '@/lib/booking-engine'
import { recordAudit } from '@/lib/audit'
import {
  badRequest, conflict, forbidden, guard, notFound, ok, readJson,
  requireAnyRole, safeArray,
} from '@/lib/http'

export const dynamic = 'force-dynamic'

const PatchSchema = z.object({
  id: z.string().min(1).max(60),
  action: z.enum(['availability', 'acceptJob', 'advance', 'rejectJob', 'enroll', 'trainingProgress']),
  value: z.unknown().optional(),
  bookingId: z.string().max(60).optional(),
})

const AvailabilitySchema = z.enum(['AVAILABLE', 'BUSY', 'OFFLINE'])
const ProgressSchema = z.object({ enrollmentId: z.string().min(1), progress: z.coerce.number().min(0).max(100) })

function wOut(w: Awaited<ReturnType<typeof db.worker.findUnique>> & object) {
  // FIX: these four unguarded JSON.parse calls sat in a handler with no
  // try/catch — one malformed column returned a raw 500.
  return {
    ...w,
    secondarySkills: safeArray<string>(w.secondarySkills),
    languages: safeArray<string>(w.languages),
    serviceAreas: safeArray<string>(w.serviceAreas),
    skills: safeArray<string>(w.skillsJson),
  }
}

export async function GET(req: NextRequest) {
  return guard(async () => {
    const sp = req.nextUrl.searchParams
    const id = sp.get('id')
    const section = sp.get('section') ?? 'home'
    if (!id) return badRequest('id required')

    const w = await db.worker.findUnique({ where: { id }, include: { cooperative: true } })
    if (!w) return notFound('worker not found')

    if (section === 'home') {
      const startOfDay = new Date()
      startOfDay.setHours(0, 0, 0, 0)
      const rows = await db.booking.findMany({ where: { workerId: id, scheduledAt: { gte: new Date(Date.now() - 7 * 86400000) } }, orderBy: { scheduledAt: 'desc' }, take: 20 })
      const ticked = await tickMany(rows)
      const jobs = await hydrateBookings(ticked)
      const todayJobs = jobs.filter((b) => new Date(b.scheduledAt) >= startOfDay)
      const todayEarnings = todayJobs.filter((b) => b.payment).reduce((s, b) => s + (b.payment?.workerShare ?? 0), 0)
      const weekEarnings = jobs.filter((b) => b.payment).reduce((s, b) => s + (b.payment?.workerShare ?? 0), 0)
      const notes = await db.notification.findMany({ where: { audience: 'WORKER', audienceId: id }, orderBy: { createdAt: 'desc' }, take: 12 })
      return ok({
        worker: wOut(w),
        cooperative: { id: w.cooperative.id, name: w.cooperative.name, sector: w.cooperative.sector },
        todayJobs,
        todayEarnings,
        weekEarnings,
        notifications: notes,
        stats: { completedJobs: w.completedJobs, rating: w.rating, completionRate: w.completionRate, monthEarnings: w.earningsMonthRs, welfare: w.welfareBalanceRs },
      })
    }

    if (section === 'jobs') {
      const rows = await db.booking.findMany({ where: { workerId: id }, orderBy: { scheduledAt: 'desc' }, take: 30 })
      const ticked = await tickMany(rows)
      return ok({ jobs: await hydrateBookings(ticked) })
    }

    if (section === 'passport') {
      // Spec §20 — portable professional identity. Consent-framed, minimal data.
      const portable = {
        note: 'Portable professional record — follows the worker across participating cooperatives with worker consent and applicable data-sharing rules. Sensitive personal data is not exposed.',
        portableFields: ['Skills', 'Certifications', 'Training', 'Completed jobs', 'Work history', 'Welfare status'],
      }
      return ok({
        worker: wOut(w),
        cooperative: { id: w.cooperative.id, name: w.cooperative.name, regNo: w.cooperative.regNo, taluka: w.cooperative.talukaId },
        portable,
      })
    }

    if (section === 'earnings') {
      const rows = await db.booking.findMany({ where: { workerId: id, paymentJson: { not: null } }, orderBy: { scheduledAt: 'desc' }, take: 50 })
      const paid = await hydrateBookings(rows)
      const byDay: Record<string, { date: string; jobs: number; earnings: number }> = {}
      paid.forEach((b) => {
        const d = new Date(b.scheduledAt).toISOString().slice(0, 10)
        byDay[d] = byDay[d] ?? { date: d, jobs: 0, earnings: 0 }
        byDay[d].jobs += 1
        byDay[d].earnings += b.payment?.workerShare ?? 0
      })
      const daily = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)).slice(-14)
      return ok({ daily, monthTotal: w.earningsMonthRs, lifetimeJobs: w.completedJobs, payouts: paid.slice(0, 10) })
    }

    if (section === 'welfare') {
      const ledger = await db.welfareLedger.findMany({ where: { workerId: id }, orderBy: { createdAt: 'desc' }, take: 30 })
      const contributions = ledger.filter((l) => l.type === 'CONTRIBUTION').reduce((s, l) => s + l.amount, 0)
      const benefits = ledger.filter((l) => l.type === 'BENEFIT').reduce((s, l) => s + l.amount, 0)
      return ok({
        balance: w.welfareBalanceRs,
        contributions,
        benefits,
        ledger,
        schemes: [
          { name: 'Accident insurance cover', status: w.safetyValid ? 'ACTIVE' : 'LAPSED', detail: 'Group accident cover via federation (prototype)' },
          { name: 'Skill upgrade scholarship', status: 'ELIGIBLE', detail: '50% course fee support for next NSQF course' },
          { name: 'Children education support', status: 'CLAIMED', detail: 'Annual benefit via welfare wallet' },
          { name: 'Tool purchase finance', status: 'ELIGIBLE', detail: '0% cooperative loan for toolkits' },
        ],
      })
    }

    if (section === 'training') {
      const courses = await db.trainingCourse.findMany({ orderBy: { title: 'asc' } })
      const enrollments = await db.trainingEnrollment.findMany({ where: { workerId: id }, include: { course: true } })
      const recommended = courses.filter((c) => c.categoryKey === w.primarySkill).slice(0, 2)
      return ok({ courses, enrollments, recommended, trainingsDone: w.trainingsDone })
    }

    if (section === 'ratings') {
      const rows = await db.booking.findMany({ where: { workerId: id, rating: { not: null } }, orderBy: { scheduledAt: 'desc' }, take: 20 })
      return ok({ reviews: await hydrateBookings(rows), rating: w.rating, completionRate: w.completionRate, completedJobs: w.completedJobs })
    }

    return badRequest('unknown section')
  })
}

export async function PATCH(req: NextRequest) {
  return guard(async () => {
    const auth = await requireAnyRole(['WORKER', 'COOP_ADMIN', 'TALUKA_COORD', 'DISTRICT_COORD', 'PLATFORM_ADMIN'])
    if (!auth.ok) return auth.res
    const user = auth.user

    const parsed = await readJson(req, PatchSchema)
    if (!parsed.ok) return parsed.res
    const { id, action, value, bookingId } = parsed.data

    // SECURITY FIX (ownership): the old route let ANY caller change ANY worker's
    // availability, and its `acceptJob` check compared two attacker-supplied
    // values (`row.workerId !== id`) so it was trivially bypassable. The target
    // worker must now be the signed-in worker, or a coordinator acting on their
    // own cooperative.
    const target = await db.worker.findUnique({ where: { id }, select: { id: true, cooperativeId: true } })
    if (!target) return notFound('worker not found')
    const self = user.role === 'WORKER' && user.workerId === id
    const admin =
      user.role === 'PLATFORM_ADMIN' ||
      ((user.role === 'COOP_ADMIN' || user.role === 'TALUKA_COORD' || user.role === 'DISTRICT_COORD') &&
        (user.cooperativeId ? user.cooperativeId === target.cooperativeId : true))
    if (!self && !admin) return forbidden('You can only manage your own worker record.')

    switch (action) {
      case 'availability': {
        const v = AvailabilitySchema.safeParse(value)
        if (!v.success) return badRequest('availability must be AVAILABLE, BUSY or OFFLINE')
        const w = await db.worker.update({ where: { id }, data: { availability: v.data } })
        await recordAudit({
          action: 'WORKER_STATUS_CHANGE',
          entity: 'Worker',
          entityId: id,
          detail: `Availability → ${v.data}${self ? '' : ` (by ${user.name})`}`,
        })
        return ok({ worker: wOut(w) })
      }

      case 'acceptJob': {
        if (!bookingId) return badRequest('bookingId required')
        const row = await db.booking.findUnique({ where: { id: bookingId } })
        if (!row) return notFound('booking not found')
        if (row.workerId !== id) return forbidden('This job is not assigned to you.')
        if (row.status !== 'REQUESTED') return conflict(`This job is already ${row.status.replace('_', ' ')}.`)
        const timeline = safeArray<{ status: string; at: string; note?: string }>(row.timelineJson)
        timeline.push({ status: 'ACCEPTED', at: new Date().toISOString(), note: `Accepted by ${user.name}` })
        const upd = await db.booking.update({
          where: { id: bookingId },
          data: { status: 'ACCEPTED', timelineJson: JSON.stringify(timeline), autoStageAt: new Date(Date.now() + 25000) },
        })
        await db.worker.update({ where: { id }, data: { activeJobsToday: { increment: 1 }, availability: 'BUSY' } }).catch(() => {})
        await db.notification.create({ data: { audience: 'CUSTOMER', audienceId: row.customerId, title: 'Worker accepted', body: `Job ${row.refCode} accepted.`, type: 'SUCCESS' } })
        await recordAudit({ action: 'BOOKING_ADVANCED', entity: 'Booking', entityId: bookingId, detail: `${row.refCode} · REQUESTED → ACCEPTED by worker` })
        return ok({ booking: serializeBooking(upd) })
      }

      case 'advance': {
        if (!bookingId) return badRequest('bookingId required')
        const row = await db.booking.findUnique({ where: { id: bookingId } })
        if (!row) return notFound('booking not found')
        if (row.workerId !== id) return forbidden('This job is not assigned to you.')
        const order = ['ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS', 'COMPLETED']
        const idx = order.indexOf(row.status)
        if (idx === -1 || idx === order.length - 1) return conflict('Nothing to advance.')
        const next = order[idx + 1]
        const timeline = safeArray<{ status: string; at: string; note?: string }>(row.timelineJson)
        timeline.push({ status: next, at: new Date().toISOString(), note: `Updated by ${user.name}` })
        if (next === 'COMPLETED') await releaseActiveJob(id)
        const upd = await db.booking.update({ where: { id: bookingId }, data: { status: next, timelineJson: JSON.stringify(timeline), autoStageAt: null } })
        await recordAudit({ action: 'BOOKING_ADVANCED', entity: 'Booking', entityId: bookingId, detail: `${row.refCode} · ${row.status} → ${next}` })
        return ok({ booking: serializeBooking(upd) })
      }

      case 'rejectJob': {
        // FIX: this used to `return ok: true` while doing nothing at all. A real
        // rejection now releases the job back to cooperative matching, notifies
        // the customer and leaves an audit trail.
        if (!bookingId) return badRequest('bookingId required')
        const row = await db.booking.findUnique({ where: { id: bookingId } })
        if (!row) return notFound('booking not found')
        if (row.workerId !== id) return forbidden('This job is not assigned to you.')
        if (!['REQUESTED', 'ACCEPTED'].includes(row.status)) return conflict('This job can no longer be declined.')
        const timeline = safeArray<{ status: string; at: string; note?: string }>(row.timelineJson)
        timeline.push({ status: 'REQUESTED', at: new Date().toISOString(), note: `Declined by worker — returned to cooperative matching` })
        await db.booking.update({
          where: { id: bookingId },
          data: { status: 'REQUESTED', workerId: null, timelineJson: JSON.stringify(timeline), autoAcceptAt: null, autoStageAt: null },
        })
        await db.worker.update({ where: { id }, data: { availability: 'AVAILABLE' } }).catch(() => {})
        await db.notification.create({
          data: { audience: 'CUSTOMER', audienceId: row.customerId, title: 'Finding a replacement', body: `Your worker could not take job ${row.refCode}. The cooperative is re-matching now.`, type: 'WARNING' },
        })
        await recordAudit({ action: 'BOOKING_ADVANCED', entity: 'Booking', entityId: bookingId, detail: `${row.refCode} · declined by worker, returned to cooperative matching` })
        return ok({ requeued: true })
      }

      case 'enroll': {
        const courseId = typeof value === 'string' ? value : ''
        if (!courseId) return badRequest('courseId required')
        const exists = await db.trainingCourse.findUnique({ where: { id: courseId }, select: { id: true, title: true } })
        if (!exists) return notFound('Course not found.')
        const dupe = await db.trainingEnrollment.findFirst({ where: { workerId: id, courseId } })
        if (dupe) return conflict('Already enrolled in this course.')
        const enrollment = await db.trainingEnrollment.create({ data: { workerId: id, courseId, status: 'IN_PROGRESS', progress: 0 } })
        await recordAudit({ action: 'WORKER_ENROLLED', entity: 'TrainingEnrollment', entityId: enrollment.id, detail: `Enrolled: ${exists.title}` })
        return ok({ enrollment })
      }

      case 'trainingProgress': {
        const v = ProgressSchema.safeParse(value)
        if (!v.success) return badRequest('enrollmentId and a progress value between 0 and 100 are required.')
        const enrollment = await db.trainingEnrollment.findUnique({ where: { id: v.data.enrollmentId }, select: { id: true, workerId: true, status: true } })
        // FIX: this was an unauthenticated IDOR — any caller could complete any
        // enrolment and inflate any worker's trainingsDone counter.
        if (!enrollment) return notFound('Enrolment not found.')
        if (enrollment.workerId !== id) return forbidden('That enrolment belongs to another worker.')
        const progress = Math.round(v.data.progress)
        const status = progress >= 100 ? 'COMPLETED' : progress > 0 ? 'IN_PROGRESS' : 'ENROLLED'
        const updated = await db.trainingEnrollment.update({ where: { id: enrollment.id }, data: { progress, status } })
        if (status === 'COMPLETED' && enrollment.status !== 'COMPLETED') {
          await db.worker.update({ where: { id }, data: { trainingsDone: { increment: 1 } } })
        }
        await recordAudit({ action: 'WORKER_TRAINING_PROGRESS', entity: 'TrainingEnrollment', entityId: enrollment.id, detail: `${progress}% · ${status}` })
        return ok({ enrollment: updated })
      }

      default:
        return badRequest('unknown action')
    }
  })
}
