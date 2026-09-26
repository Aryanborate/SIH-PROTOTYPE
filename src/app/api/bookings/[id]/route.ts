import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import {
  bookingFloor, CANCELLABLE, hydrateBookings, payBooking, rateBooking, serializeBooking, tickBooking,
} from '@/lib/booking-engine'
import { recordAudit } from '@/lib/audit'
import { badRequest, conflict, forbidden, guard, notFound, ok, readJson, requireAnyRole, safeArray, safeStr } from '@/lib/http'

export const dynamic = 'force-dynamic'

const PatchSchema = z.object({
  action: z.enum([
    'cancel', 'acceptQuote', 'counter', 'acceptOffer', 'rejectOffers',
    'advance', 'pay', 'evidence', 'rate',
  ]),
  price: z.number().optional(),
  workerId: z.string().max(60).optional(),
  method: z.string().max(40).optional(),
  rating: z.number().min(1).max(5).optional(),
  review: z.string().max(1000).optional(),
  notes: z.string().max(1000).optional(),
  photo: z.string().max(400_000).optional(),
  factors: z
    .object({
      quality: z.number().min(1).max(5),
      timeliness: z.number().min(1).max(5),
      behaviour: z.number().min(1).max(5),
      communication: z.number().min(1).max(5),
    })
    .partial()
    .optional(),
})

/** Roles that legitimately drive a booking forward regardless of ownership. */
const OPERATOR_ROLES = ['WORKER', 'COOP_ADMIN', 'TALUKA_COORD', 'DISTRICT_COORD', 'STATE_ADMIN', 'NATIONAL_ADMIN', 'PLATFORM_ADMIN'] as const

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const { id } = await ctx.params
    const row = await db.booking.findUnique({ where: { id } })
    if (!row) return notFound('Booking not found.')
    const ticked = await tickBooking(row)
    const [dto] = await hydrateBookings([ticked])
    // The REAL cooperative negotiation floor travels with the booking so the
    // client never has to invent one (it previously hardcoded estimate*0.9).
    return ok({ booking: dto, floor: await bookingFloor(ticked) })
  })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const { id } = await ctx.params
    const auth = await requireAnyRole(['CUSTOMER', 'INSTITUTION', ...OPERATOR_ROLES])
    if (!auth.ok) return auth.res
    const user = auth.user

    const parsed = await readJson(req, PatchSchema)
    if (!parsed.ok) return parsed.res
    const body = parsed.data

    const row = await db.booking.findUnique({ where: { id } })
    if (!row) return notFound('Booking not found.')

    // Ownership: a customer may only touch their own bookings; a worker only
    // jobs assigned to them; admins may act anywhere.
    const isCustomerSide = user.role === 'CUSTOMER' || user.role === 'INSTITUTION'
    const isOperator = (OPERATOR_ROLES as readonly string[]).includes(user.role)
    if (isCustomerSide && row.customerId !== user.customerId) return forbidden('This booking belongs to another customer.')
    if (user.role === 'WORKER' && row.workerId !== user.workerId) return forbidden('This job is not assigned to you.')

    const timeline = safeArray<{ status: string; at: string; note?: string }>(row.timelineJson)
    const push = (status: string, note?: string) => {
      if (timeline.length === 0 || timeline[timeline.length - 1].status !== status) {
        timeline.push({ status, at: new Date().toISOString(), note })
      }
    }

    switch (body.action) {
      case 'cancel': {
        if (!CANCELLABLE.includes(row.status)) return conflict('This booking can no longer be cancelled.')
        push('CANCELLED', `Cancelled by ${user.name}`)
        const upd = await db.booking.update({ where: { id }, data: { status: 'CANCELLED', timelineJson: JSON.stringify(timeline) } })
        if (row.cooperativeId) {
          await db.cooperative.update({ where: { id: row.cooperativeId }, data: { jobsToday: { decrement: 1 } } }).catch(() => {})
        }
        await recordAudit({ action: 'BOOKING_CANCELLED', entity: 'Booking', entityId: id, detail: `${row.refCode} cancelled at stage ${row.status}` })
        return ok({ booking: serializeBooking(upd) })
      }

      case 'acceptQuote': {
        if (!isOperator && row.status !== 'QUOTED' && row.status !== 'NEGOTIATING') {
          return conflict('There is no live quote to accept.')
        }
        const quotes = safeArray<{ by: string; price: number }>(row.quoteJson)
        const lastWorker = [...quotes].reverse().find((q) => q.by === 'WORKER')
        const price = lastWorker?.price ?? row.estimatedPrice ?? 0
        if (price <= 0) return conflict('No price has been quoted yet.')
        push('REQUESTED', `Quote of ₹${price} accepted`)
        const upd = await db.booking.update({
          where: { id },
          data: { status: 'REQUESTED', finalPrice: price, timelineJson: JSON.stringify(timeline), autoAcceptAt: new Date(Date.now() + 6000), autoStageAt: null },
        })
        await recordAudit({ action: 'BOOKING_QUOTE_ACCEPTED', entity: 'Booking', entityId: id, detail: `${row.refCode} · quote ₹${price} accepted` })
        return ok({ booking: serializeBooking(upd) })
      }

      case 'counter': {
        // SPEC §12: "System prevents offers below configured minimum." The old
        // route accepted any price > 0; it now rejects offers under the real
        // cooperative floor.
        const price = Number(body.price)
        if (!Number.isFinite(price) || price <= 0) return badRequest('Enter a counter-offer amount.')
        const floor = await bookingFloor(row)
        if (floor > 0 && price < floor) {
          return badRequest(`Your offer is below the cooperative floor of ₹${floor}. Offers below the floor cannot be recorded.`)
        }
        const quotes = safeArray<{ by: string; price: number; note: string; at: string }>(row.quoteJson)
        quotes.push({ by: 'CUSTOMER', price: Math.round(price), note: 'Customer counter-offer', at: new Date().toISOString() })
        push('NEGOTIATING', `Customer offered ₹${Math.round(price)}`)
        const upd = await db.booking.update({
          where: { id },
          data: { status: 'NEGOTIATING', quoteJson: JSON.stringify(quotes), timelineJson: JSON.stringify(timeline), autoStageAt: new Date(Date.now() + 6000) },
        })
        await recordAudit({ action: 'BOOKING_COUNTERED', entity: 'Booking', entityId: id, detail: `${row.refCode} · counter-offer ₹${Math.round(price)} (floor ₹${floor})` })
        return ok({ booking: serializeBooking(upd) })
      }

      case 'acceptOffer': {
        if (!['QUOTE_REQUESTED', 'QUOTED', 'NEGOTIATING'].includes(row.status)) return conflict('This offer is no longer active.')
        const offers = safeArray<{ workerId: string; price: number; workerName: string }>(row.quoteOffersJson)
        const offer = offers.find((o) => o.workerId === body.workerId)
        if (!offer) return notFound('Offer not found.')
        const w = await db.worker.findUnique({ where: { id: offer.workerId }, select: { cooperativeId: true, name: true } })
        push('REQUESTED', `Quote of ₹${offer.price} accepted — ${offer.workerName} assigned`)
        const upd = await db.booking.update({
          where: { id },
          data: {
            status: 'REQUESTED',
            workerId: offer.workerId,
            cooperativeId: w?.cooperativeId ?? row.cooperativeId,
            finalPrice: offer.price,
            estimatedPrice: row.estimatedPrice ?? offer.price,
            timelineJson: JSON.stringify(timeline),
            autoAcceptAt: new Date(Date.now() + 6000),
            autoStageAt: null,
          },
        })
        await recordAudit({ action: 'BOOKING_OFFER_ACCEPTED', entity: 'Booking', entityId: id, detail: `${row.refCode} · ₹${offer.price} offer accepted, ${offer.workerName} assigned` })
        return ok({ booking: serializeBooking(upd) })
      }

      case 'rejectOffers': {
        if (!isCustomerSide && !isOperator) return forbidden('Not permitted.')
        push('CANCELLED', 'Customer declined all quotes — request closed')
        const upd = await db.booking.update({ where: { id }, data: { status: 'CANCELLED', timelineJson: JSON.stringify(timeline) } })
        if (row.cooperativeId) {
          await db.cooperative.update({ where: { id: row.cooperativeId }, data: { jobsToday: { decrement: 1 } } }).catch(() => {})
        }
        await recordAudit({ action: 'BOOKING_OFFERS_REJECTED', entity: 'Booking', entityId: id, detail: `${row.refCode} · all quotes declined` })
        return ok({ booking: serializeBooking(upd) })
      }

      case 'advance': {
        if (user.role !== 'WORKER' && !isOperator) return forbidden('Only the assigned worker or a coordinator can advance this job.')
        const order = ['ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS', 'COMPLETED']
        const idx = order.indexOf(row.status)
        if (idx === -1 || idx === order.length - 1) return conflict('Nothing to advance.')
        const next = order[idx + 1]
        push(next, `Updated by ${user.name}`)
        if (next === 'COMPLETED' && row.workerId) {
          const { releaseActiveJob } = await import('@/lib/booking-engine')
          await releaseActiveJob(row.workerId)
        }
        const upd = await db.booking.update({ where: { id }, data: { status: next, timelineJson: JSON.stringify(timeline), autoStageAt: null } })
        await recordAudit({ action: 'BOOKING_ADVANCED', entity: 'Booking', entityId: id, detail: `${row.refCode} · ${row.status} → ${next}` })
        return ok({ booking: serializeBooking(upd) })
      }

      case 'pay': {
        if (isCustomerSide && row.customerId !== user.customerId) return forbidden('This booking belongs to another customer.')
        const upd = await payBooking(id, safeStr(body.method, 40, 'UPI (Prototype)'))
        const [dto] = await hydrateBookings([upd])
        const p = safeJsonRecord(dto?.payment)
        await recordAudit({
          action: 'BOOKING_PAID',
          entity: 'Booking',
          entityId: id,
          detail: `${row.refCode} · ₹${p.amount ?? '?'} via ${p.method ?? 'UPI'} → worker ₹${p.workerShare ?? '?'} / coop ₹${p.coopCommission ?? '?'} / welfare ₹${p.welfare ?? '?'} / platform ₹${p.platformFee ?? '?'}`,
        })
        return ok({ booking: dto })
      }

      case 'evidence': {
        if (user.role !== 'WORKER' && !isOperator) return forbidden('Only the worker or a coordinator can file service evidence.')
        const evidence = { notes: safeStr(body.notes, 1000), photo: body.photo ?? null, at: new Date().toISOString(), by: user.name }
        const upd = await db.booking.update({ where: { id }, data: { evidenceJson: JSON.stringify(evidence) } })
        const [dto] = await hydrateBookings([upd])
        await recordAudit({ action: 'BOOKING_EVIDENCE', entity: 'Booking', entityId: id, detail: `${row.refCode} · evidence filed` })
        return ok({ booking: dto })
      }

      case 'rate': {
        if (!isCustomerSide) return forbidden('Only the customer who received the service can rate it.')
        const rating = Math.max(1, Math.min(5, Math.round(Number(body.rating) || 5)))
        const ratingJson = body.factors
          ? JSON.stringify({
              quality: clamp5(body.factors.quality),
              timeliness: clamp5(body.factors.timeliness),
              behaviour: clamp5(body.factors.behaviour),
              communication: clamp5(body.factors.communication),
            })
          : null
        const upd = await rateBooking(id, rating, safeStr(body.review, 1000) || undefined, ratingJson)
        const [dto] = await hydrateBookings([upd])
        const f = body.factors
        await recordAudit({
          action: 'BOOKING_RATED',
          entity: 'Booking',
          entityId: id,
          detail: `${row.refCode} · ${rating}★${f ? ` · quality ${f.quality} timeliness ${f.timeliness} behaviour ${f.behaviour} communication ${f.communication}` : ''}${body.review ? ` · "${String(body.review).slice(0, 80)}"` : ''}`,
        })
        return ok({ booking: dto })
      }

      default:
        return badRequest('Unknown action.')
    }
  })
}

function clamp5(v: number | undefined): number {
  return Math.max(1, Math.min(5, Math.round(Number(v) || 3)))
}

function safeJsonRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {}
}
