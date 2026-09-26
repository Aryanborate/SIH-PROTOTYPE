import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { matchWorkers, loadCoopPolicy } from '@/lib/matching'
import { generateRefCode, hydrateBookings, serializeBooking, tickMany } from '@/lib/booking-engine'
import { estimatePrice } from '@/lib/pricing'
import { recordAudit } from '@/lib/audit'
import { badRequest, conflict, guard, ok, readJson, requireAnyRole, safeStr } from '@/lib/http'
import type { Urgency } from '@/lib/types'

export const dynamic = 'force-dynamic'

const CreateSchema = z.object({
  customerId: z.string().min(1).optional(),
  categoryKey: z.string().min(1).max(40),
  title: z.string().max(160).optional(),
  description: z.string().max(2000).optional(),
  media: z.array(z.string().max(400_000)).max(6).optional(),
  area: z.string().min(1).max(120),
  address: z.string().max(400).optional(),
  scheduledAt: z.string().max(40).optional(),
  urgency: z.enum(['NORMAL', 'URGENT', 'EMERGENCY']).optional(),
  mode: z.enum(['INSTANT', 'QUOTE']).optional(),
  workerId: z.string().max(60).optional(),
  estimatedPrice: z.number().optional(),
  analysis: z.record(z.string(), z.unknown()).optional(),
  lang: z.enum(['en', 'mr', 'hi']).optional(),
  /** Only the SIH demo engine may flag a booking for RESET DEMO (#66). */
  demoScript: z.boolean().optional(),
})

/**
 * Server-side fair-price guardrail.
 *
 * FIX: the old version trusted ANY positive client price with no upper bound, so
 * `{"estimatedPrice":1}` created a ₹1 job. The client figure is now treated as a
 * HINT and is only accepted inside a band around the cooperative rate card;
 * anything outside is recomputed server-side.
 */
async function resolveEstimatedPrice(
  categoryKey: string,
  urgency: Urgency,
  scheduledAt: Date,
  clientPrice: number | undefined,
  estimatedMinutes: number | undefined,
  coopId: string | null,
): Promise<number | null> {
  const cat = await db.serviceCategory.findUnique({ where: { key: categoryKey } })
  if (!cat) return null
  const policy = await loadCoopPolicy(coopId)
  const card = estimatePrice(
    { key: cat.key, baseRate: cat.baseRate, avgDurationMin: cat.avgDurationMin },
    urgency,
    scheduledAt,
    estimatedMinutes,
    { policy },
  )
  const n = Number(clientPrice)
  if (Number.isFinite(n) && n > 0) {
    const lo = card.floor * 0.6 // allow a slightly-below-card quote, but not ₹1
    const hi = card.ceiling * 2.5 // generous headroom for a large scoped job
    if (n >= lo && n <= hi) return Math.round(n)
  }
  return card.total
}

export async function GET(req: NextRequest) {
  return guard(async () => {
    const sp = req.nextUrl.searchParams
    const customerId = sp.get('customerId')
    const workerId = sp.get('workerId')
    const cooperativeId = sp.get('cooperativeId')
    const area = sp.get('area')
    const take = Math.min(100, Math.max(1, Number(sp.get('take')) || 60))

    const where: Record<string, unknown> = {}
    if (customerId) where.customerId = customerId
    if (workerId) where.workerId = workerId
    if (cooperativeId) where.cooperativeId = cooperativeId
    // FIX: the old `districtScope` branch set `area: { in: [] }` — a filter that
    // matched nothing and silently returned zero bookings. It is now a real area
    // filter, and unknown params are simply ignored.
    if (area) where.area = area

    const rows = await db.booking.findMany({ where, orderBy: { createdAt: 'desc' }, take })
    const ticked = await tickMany(rows)
    return ok({ bookings: await hydrateBookings(ticked) })
  })
}

export async function POST(req: NextRequest) {
  return guard(async () => {
    // A booking is a customer action. Cooperative staff creating one on a
    // walk-in basis is also legitimate, so both roles are accepted.
    const auth = await requireAnyRole(['CUSTOMER', 'INSTITUTION', 'COOP_ADMIN', 'TALUKA_COORD', 'DISTRICT_COORD', 'PLATFORM_ADMIN'])
    if (!auth.ok) return auth.res

    const parsed = await readJson(req, CreateSchema)
    if (!parsed.ok) return parsed.res
    const b = parsed.data

    // A customer may only book for themselves.
    if ((auth.user.role === 'CUSTOMER' || auth.user.role === 'INSTITUTION') && b.customerId && b.customerId !== auth.user.customerId) {
      return badRequest('You can only create bookings for your own account.')
    }
    const customerId = auth.user.customerId ?? b.customerId
    if (!customerId) return badRequest('customerId is required for this role.')
    const customer = await db.customer.findUnique({ where: { id: customerId }, select: { id: true } })
    if (!customer) return badRequest('Unknown customer.')

    const refCode = await generateRefCode()
    const now = Date.now()
    let finalWorkerId = b.workerId ?? null
    let coopId: string | null = null

    if (finalWorkerId) {
      const w = await db.worker.findUnique({ where: { id: finalWorkerId }, select: { id: true, cooperativeId: true, primarySkill: true } })
      if (!w) return badRequest('Unknown worker.')
      if (w.primarySkill !== b.categoryKey) return conflict('That worker does not practise this trade.')
      coopId = w.cooperativeId
    } else {
      // QUOTE mode (and INSTANT without a pre-picked worker): the engine selects.
      const m = await matchWorkers({ categoryKey: b.categoryKey, area: b.area, urgency: b.urgency ?? 'NORMAL', scheduledAt: b.scheduledAt })
      finalWorkerId = m.best?.id ?? null
      if (finalWorkerId) {
        const w = await db.worker.findUnique({ where: { id: finalWorkerId }, select: { cooperativeId: true } })
        coopId = w?.cooperativeId ?? null
      }
    }

    const mode = b.mode === 'QUOTE' ? 'QUOTE' : 'INSTANT'
    const when = b.scheduledAt ? new Date(b.scheduledAt) : new Date()
    if (Number.isNaN(when.getTime())) return badRequest('scheduledAt is not a valid date.')
    const safeUrgency: Urgency = b.urgency ?? 'NORMAL'
    const rawMinutes = b.analysis ? Number((b.analysis as Record<string, unknown>).estimatedMinutes) : NaN
    // FIX: unbounded model/AI output previously flowed straight into pricing.
    const minutes = Number.isFinite(rawMinutes) ? Math.max(15, Math.min(480, rawMinutes)) : undefined
    const safePrice =
      mode === 'QUOTE'
        ? null // priced by the worker's engine-generated quote
        : await resolveEstimatedPrice(b.categoryKey, safeUrgency, when, b.estimatedPrice, minutes, coopId)

    const analysisJson = b.analysis ? JSON.stringify(b.analysis).slice(0, 4000) : null

    const booking = await db.booking.create({
      data: {
        refCode,
        customerId,
        categoryKey: b.categoryKey,
        title: safeStr(b.title, 160, 'Service request') || 'Service request',
        description: safeStr(b.description, 2000),
        mediaJson: JSON.stringify((b.media ?? []).slice(0, 6)),
        area: b.area,
        address: safeStr(b.address, 400, 'Address on file'),
        scheduledAt: when,
        urgency: safeUrgency,
        mode,
        status: mode === 'QUOTE' ? 'QUOTE_REQUESTED' : 'REQUESTED',
        analysisJson,
        cooperativeId: coopId,
        workerId: finalWorkerId,
        estimatedPrice: safePrice,
        lang: b.lang ?? 'en',
        isDemoScript: auth.user.role === 'PLATFORM_ADMIN' && !!b.demoScript,
        timelineJson: JSON.stringify([
          {
            status: mode === 'QUOTE' ? 'QUOTE_REQUESTED' : 'REQUESTED',
            at: new Date().toISOString(),
            note: mode === 'QUOTE' ? 'Quote requested — worker will respond' : 'Request sent to cooperative network',
          },
        ]),
        autoAcceptAt: mode === 'QUOTE' ? null : new Date(now + 8000),
        autoStageAt: mode === 'QUOTE' ? new Date(now + 6000) : null,
      },
    })
    if (coopId) {
      await db.cooperative.update({ where: { id: coopId }, data: { jobsToday: { increment: 1 } } }).catch(() => {})
    }
    await recordAudit({
      action: 'BOOKING_CREATED',
      entity: 'Booking',
      entityId: booking.id,
      detail: `${booking.refCode} · ${b.categoryKey} @ ${b.area} (${safeUrgency})`,
    })
    return ok({ booking: serializeBooking(booking) }, 201)
  })
}
