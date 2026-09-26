import { NextRequest } from 'next/server'
import { z } from 'zod'
import { escalateEmergency } from '@/lib/emergency'
import { matchWorkers, inferCategory, inferUrgency } from '@/lib/matching'
import { generateRefCode, serializeBooking } from '@/lib/booking-engine'
import { recordAudit } from '@/lib/audit'
import { badRequest, conflict, guard, notFound, ok, readJson, requireAnyRole, safeStr } from '@/lib/http'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

const TriageSchema = z.object({
  categoryKey: z.string().max(40).optional(),
  area: z.string().max(120).optional(),
  description: z.string().max(2000).optional(),
  urgency: z.enum(['NORMAL', 'URGENT', 'EMERGENCY']).optional(),
  customerId: z.string().max(60).optional(),
  /** Triaged against a specific slot (optional; defaults to "now"). */
  scheduledAt: z.string().max(40).optional(),
})

const DispatchSchema = TriageSchema.extend({
  customerId: z.string().min(1).max(60),
  categoryKey: z.string().min(1).max(40),
  area: z.string().min(1).max(120),
  title: z.string().max(160).optional(),
  address: z.string().max(400).optional(),
  demoScript: z.boolean().optional(),
})

/**
 * Spec §61 — POST /emergency
 * Spec §16/#17 — the prominent EMERGENCY SERVICE flow: locate → required skill →
 * nearest verified available worker → local cooperative → taluka reserve →
 * district reserve → federation emergency pool.
 *
 * `dispatch: true` creates the real booking; the default is a dry triage so the
 * UI can show the whole ladder before the customer commits.
 */
export async function POST(req: NextRequest) {
  return guard(async () => {
    const auth = await requireAnyRole(['CUSTOMER', 'INSTITUTION', 'PLATFORM_ADMIN', 'COOP_ADMIN', 'DISTRICT_COORD'])
    if (!auth.ok) return auth.res

    const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const dispatch = raw.dispatch === true
    // Two schemas: a permissive triage, and a strict dispatch that requires an
    // identified customer, trade and location.
    const triage = TriageSchema.safeParse(raw)
    if (!triage.success) return badRequest('Provide a service (or description) and a location.')
    const full = dispatch ? DispatchSchema.safeParse(raw) : null
    if (dispatch && !full?.success) return badRequest('An emergency dispatch needs a service, a location and your account.')
    const b = (dispatch ? (full as { data: z.infer<typeof DispatchSchema> }).data : triage.data)

    const categoryKey = b.categoryKey ?? (b.description ? inferCategory(b.description) : 'other')
    const urgency = b.urgency ?? (b.description ? inferUrgency(b.description) : 'EMERGENCY')
    const area = (b.area ?? '').trim() || 'Kothrud'
    const scheduledAt = b.scheduledAt

    const ladder = await escalateEmergency(categoryKey, area)

    if (!dispatch) {
      return ok({ dispatch: false, ...ladder })
    }

    // --- real dispatch ---
    const customerId = auth.user.role === 'PLATFORM_ADMIN' || auth.user.role === 'COOP_ADMIN' || auth.user.role === 'DISTRICT_COORD' ? b.customerId : auth.user.customerId
    if (!customerId || customerId !== b.customerId) return badRequest('You can only raise an emergency for your own account.')
    const customer = await db.customer.findUnique({ where: { id: customerId }, select: { id: true } })
    if (!customer) return notFound('Unknown customer.')

    const m = await matchWorkers({ categoryKey, area, urgency: 'EMERGENCY', scheduledAt, customerId })
    if (!m.best) return conflict('No verified worker is free right now — the cooperative has been notified. Please call the helpline.')

    const refCode = await generateRefCode()
    const when = scheduledAt ? new Date(scheduledAt) : new Date()
    if (Number.isNaN(when.getTime())) return badRequest('scheduledAt is not a valid date.')
    const coop = await db.worker.findUnique({ where: { id: m.best.id }, select: { cooperativeId: true } })

    const booking = await db.booking.create({
      data: {
        refCode,
        customerId,
        categoryKey,
        title: safeStr('title' in b ? b.title : undefined, 160, `Emergency ${categoryKey}`) || `Emergency ${categoryKey}`,
        description: safeStr(b.description, 2000, 'Emergency request'),
        area,
        address: safeStr('address' in b ? b.address : undefined, 400, `${area}, Pune (emergency — confirm on call)`),
        scheduledAt: when,
        urgency: 'EMERGENCY',
        mode: 'INSTANT',
        status: 'REQUESTED',
        workerId: m.best.id,
        cooperativeId: coop?.cooperativeId ?? null,
        estimatedPrice: m.priceEstimate.total,
        lang: 'en',
        isDemoScript: auth.user.role === 'PLATFORM_ADMIN' && 'demoScript' in b && !!b.demoScript,
        timelineJson: JSON.stringify([
          { status: 'REQUESTED', at: new Date().toISOString(), note: `Emergency dispatched from ${ladder.dispatchedFrom ?? 'local cooperative roster'}` },
        ]),
        autoAcceptAt: new Date(Date.now() + 6000),
        autoStageAt: null,
      },
    })
    if (coop?.cooperativeId) {
      await db.cooperative.update({ where: { id: coop.cooperativeId }, data: { jobsToday: { increment: 1 } } }).catch(() => {})
      await db.notification.create({
        data: {
          audience: 'COOP',
          audienceId: coop.cooperativeId,
          title: 'EMERGENCY job active',
          body: `${booking.refCode} · ${categoryKey} emergency in ${area} — ${m.best.name} dispatched (${m.best.distanceKm} km, ETA ${m.best.etaMin} min).`,
          type: 'EMERGENCY',
        },
      })
    }
    await recordAudit({
      action: 'BOOKING_CREATED',
      entity: 'Booking',
      entityId: booking.id,
      detail: `${booking.refCode} · EMERGENCY ${categoryKey} @ ${area} · ladder level: ${ladder.dispatchedFrom ?? 'n/a'}`,
    })
    return ok({ dispatch: true, ...ladder, booking: serializeBooking(booking) }, 201)
  })
}
