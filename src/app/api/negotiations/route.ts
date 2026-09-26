import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { bookingFloor } from '@/lib/booking-engine'
import { respondToCounter } from '@/lib/pricing'
import { loadCoopPolicy } from '@/lib/matching'
import { badRequest, conflict, forbidden, guard, notFound, ok, readJson, requireAnyRole, safeArray } from '@/lib/http'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  bookingId: z.string().min(1).max(60),
  offer: z.number().min(1).max(1_000_000),
  /** Simulation flag: resolve the counter immediately instead of waiting for the tick. */
  resolveNow: z.boolean().optional(),
})

/**
 * Spec §61 — POST /negotiations
 * Spec §12 — Controlled Negotiation. Unlimited uncontrolled bargaining is NOT
 * allowed: an offer below the cooperative floor is REJECTED, and the worker
 * agent may only accept, meet in the middle, or counter at/above the floor.
 */
export async function POST(req: NextRequest) {
  return guard(async () => {
    const auth = await requireAnyRole(['CUSTOMER', 'INSTITUTION', 'COOP_ADMIN', 'PLATFORM_ADMIN'])
    if (!auth.ok) return auth.res
    const parsed = await readJson(req, BodySchema)
    if (!parsed.ok) return parsed.res
    const { bookingId, offer, resolveNow } = parsed.data

    const b = await db.booking.findUnique({ where: { id: bookingId } })
    if (!b) return notFound('Booking not found.')
    if ((auth.user.role === 'CUSTOMER' || auth.user.role === 'INSTITUTION') && b.customerId !== auth.user.customerId) {
      return forbidden('This booking belongs to another customer.')
    }
    if (!['QUOTED', 'NEGOTIATING', 'QUOTE_REQUESTED'].includes(b.status)) {
      return conflict(`This booking is ${b.status.replace('_', ' ')} — there is nothing to negotiate.`)
    }

    const policy = await loadCoopPolicy(b.cooperativeId)
    const floor = await bookingFloor(b)
    if (floor > 0 && offer < floor) {
      return badRequest(`Your offer of ₹${Math.round(offer)} is below the cooperative floor of ₹${floor}. Negotiation is protected by cooperative pricing policy.`)
    }

    const quotes = safeArray<{ by: string; price: number; note: string; at: string }>(b.quoteJson)
    const lastWorker = [...quotes].reverse().find((q) => q.by === 'WORKER')
    const estimated = b.estimatedPrice ?? 400
    const lastWorkerPrice = lastWorker?.price ?? Math.round(estimated * 1.15)

    quotes.push({ by: 'CUSTOMER', price: Math.round(offer), note: 'Customer counter-offer', at: new Date().toISOString() })
    const resolution = respondToCounter(Math.round(offer), lastWorkerPrice, floor)
    quotes.push({ by: 'WORKER', price: resolution.price, note: resolution.note, at: new Date().toISOString() })

    const timeline = safeArray<{ status: string; at: string; note?: string }>(b.timelineJson)
    timeline.push({ status: 'NEGOTIATING', at: new Date().toISOString(), note: `Customer offered ₹${Math.round(offer)}` })
    if (resolution.accepted) {
      timeline.push({ status: 'QUOTED', at: new Date().toISOString(), note: resolution.note })
    }

    const upd = await db.booking.update({
      where: { id: bookingId },
      data: {
        quoteJson: JSON.stringify(quotes),
        timelineJson: JSON.stringify(timeline),
        status: 'QUOTED',
        ...(resolution.accepted ? { finalPrice: resolution.price, autoAcceptAt: new Date(Date.now() + 6000), autoStageAt: null } : { autoStageAt: new Date(Date.now() + 6000) }),
      },
    })

    await recordAudit({
      action: 'BOOKING_COUNTERED',
      entity: 'Booking',
      entityId: bookingId,
      detail: `${b.refCode} · offer ₹${Math.round(offer)} → ${resolution.accepted ? `agreed ₹${resolution.price}` : `countered ₹${resolution.price}`} (floor ₹${floor}, cap +${Math.round(policy.maxQuoteUpliftPct * 100)}%)`,
    })
    return ok({ booking: upd, resolution, floor, ceiling: Math.round(estimated * (1 + policy.maxQuoteUpliftPct)), policyNote: 'Negotiation protected by cooperative pricing policy.' })
  })
}
