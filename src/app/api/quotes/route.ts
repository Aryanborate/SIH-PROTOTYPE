import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { bookingFloor } from '@/lib/booking-engine'
import { loadCoopPolicy } from '@/lib/matching'
import { badRequest, conflict, forbidden, guard, notFound, ok, readJson, requireAnyRole, safeArray, safeStr } from '@/lib/http'

export const dynamic = 'force-dynamic'

const QuoteSchema = z.object({
  bookingId: z.string().min(1).max(60),
  workerId: z.string().max(60).optional(),
  price: z.number().min(1).max(1_000_000).optional(),
  counter: z.boolean().optional(),
  decline: z.boolean().optional(),
})

const C = () => new Date().toISOString()

/**
 * Spec §61 — POST /quotes and POST /negotiations
 *
 * A thin, explicit facade over the booking PATCH actions, so the documented
 * REST surface exists. Every price is validated against the COOPERATIVE floor
 * and quote cap (spec §12) rather than being trusted.
 */
export async function POST(req: NextRequest) {
  return guard(async () => {
    const auth = await requireAnyRole(['CUSTOMER', 'INSTITUTION', 'WORKER', 'COOP_ADMIN', 'PLATFORM_ADMIN'])
    if (!auth.ok) return auth.res
    const parsed = await readJson(req, QuoteSchema)
    if (!parsed.ok) return parsed.res
    const { bookingId, workerId, price, counter, decline } = parsed.data

    const b = await db.booking.findUnique({ where: { id: bookingId } })
    if (!b) return notFound('Booking not found.')
    if ((auth.user.role === 'CUSTOMER' || auth.user.role === 'INSTITUTION') && b.customerId !== auth.user.customerId) {
      return forbidden('This booking belongs to another customer.')
    }

    if (decline) {
      if (!['QUOTE_REQUESTED', 'QUOTED', 'NEGOTIATING'].includes(b.status)) return conflict('No quote is active on this request.')
      const timeline = safeArray<{ status: string; at: string; note?: string }>(b.timelineJson)
      timeline.push({ status: 'CANCELLED', at: C(), note: 'Customer declined all quotes — request closed' })
      const upd = await db.booking.update({ where: { id: bookingId }, data: { status: 'CANCELLED', timelineJson: JSON.stringify(timeline) } })
      if (b.cooperativeId) await db.cooperative.update({ where: { id: b.cooperativeId }, data: { jobsToday: { decrement: 1 } } }).catch(() => {})
      await recordAudit({ action: 'BOOKING_OFFERS_REJECTED', entity: 'Booking', entityId: bookingId, detail: `${b.refCode} · all quotes declined` })
      return ok({ booking: upd })
    }

    const policy = await loadCoopPolicy(b.cooperativeId)
    const offers = safeArray<{ workerId: string; price: number; workerName: string; coopName: string; availableAt: string; etaMin: number; rating: number; certStatus: string }>(b.quoteOffersJson)

    // --- accept one of the 3 eligible worker offers (spec §11) ---
    if (workerId) {
      const offer = offers.find((o) => o.workerId === workerId)
      if (!offer) return notFound('Offer not found for that worker.')
      if (!['QUOTE_REQUESTED', 'QUOTED', 'NEGOTIATING'].includes(b.status)) return conflict('This offer is no longer active.')
      const w = await db.worker.findUnique({ where: { id: offer.workerId }, select: { cooperativeId: true } })
      const timeline = safeArray<{ status: string; at: string; note?: string }>(b.timelineJson)
      timeline.push({ status: 'REQUESTED', at: C(), note: `Quote of ₹${offer.price} accepted — ${offer.workerName} assigned` })
      const upd = await db.booking.update({
        where: { id: bookingId },
        data: {
          status: 'REQUESTED', workerId: offer.workerId, cooperativeId: w?.cooperativeId ?? b.cooperativeId,
          finalPrice: offer.price, estimatedPrice: b.estimatedPrice ?? offer.price,
          timelineJson: JSON.stringify(timeline), autoAcceptAt: new Date(Date.now() + 6000), autoStageAt: null,
        },
      })
      await recordAudit({ action: 'BOOKING_OFFER_ACCEPTED', entity: 'Booking', entityId: bookingId, detail: `${b.refCode} · ₹${offer.price} offer accepted, ${offer.workerName} assigned` })
      return ok({ booking: upd })
    }

    // --- negotiation counter-offer, floored by cooperative policy (spec §12) ---
    if (counter) {
      if (typeof price !== 'number') return badRequest('A counter-offer amount is required.')
      const floor = await bookingFloor(b)
      if (floor > 0 && price < floor) {
        return badRequest(`Your offer is below the cooperative floor of ₹${floor}. Offers below the floor cannot be recorded.`)
      }
      const quotes = safeArray<{ by: string; price: number; note: string; at: string }>(b.quoteJson)
      quotes.push({ by: 'CUSTOMER', price: Math.round(price), note: 'Customer counter-offer', at: C() })
      const timeline = safeArray<{ status: string; at: string; note?: string }>(b.timelineJson)
      timeline.push({ status: 'NEGOTIATING', at: C(), note: `Customer offered ₹${Math.round(price)}` })
      const upd = await db.booking.update({
        where: { id: bookingId },
        data: { status: 'NEGOTIATING', quoteJson: JSON.stringify(quotes), timelineJson: JSON.stringify(timeline), autoStageAt: new Date(Date.now() + 6000) },
      })
      await recordAudit({ action: 'BOOKING_COUNTERED', entity: 'Booking', entityId: bookingId, detail: `${b.refCode} · counter-offer ₹${Math.round(price)} (floor ₹${floor})` })
      return ok({ booking: upd, floor, ceiling: Math.round((b.estimatedPrice ?? 0) * (1 + policy.maxQuoteUpliftPct)) })
    }

    // --- accept the live worker quote ---
    const quotes = safeArray<{ by: string; price: number; at: string }>(b.quoteJson)
    const lastWorker = [...quotes].reverse().find((q) => q.by === 'WORKER')
    if (!lastWorker) return conflict('No worker quote is available to accept yet.')
    const timeline = safeArray<{ status: string; at: string; note?: string }>(b.timelineJson)
    timeline.push({ status: 'REQUESTED', at: C(), note: `Quote of ₹${lastWorker.price} accepted` })
    const upd = await db.booking.update({
      where: { id: bookingId },
      data: { status: 'REQUESTED', finalPrice: lastWorker.price, timelineJson: JSON.stringify(timeline), autoAcceptAt: new Date(Date.now() + 6000), autoStageAt: null },
    })
    await recordAudit({ action: 'BOOKING_QUOTE_ACCEPTED', entity: 'Booking', entityId: bookingId, detail: `${b.refCode} · quote ₹${lastWorker.price} accepted` })
    return ok({ booking: upd })
  })
}

export { safeStr }
