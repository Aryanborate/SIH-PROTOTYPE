import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { rateBooking } from '@/lib/booking-engine'
import { conflict, forbidden, guard, notFound, ok, readJson, requireAnyRole } from '@/lib/http'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  bookingId: z.string().min(1).max(60),
  rating: z.number().min(1).max(5),
  review: z.string().max(1000).optional(),
  factors: z
    .object({
      quality: z.number().min(1).max(5).optional(),
      timeliness: z.number().min(1).max(5).optional(),
      behaviour: z.number().min(1).max(5).optional(),
      communication: z.number().min(1).max(5).optional(),
    })
    .optional(),
})

/**
 * Spec §61 — POST /ratings
 * Spec §35 — two-sided trust. Only the customer who received a COMPLETED service
 * may rate it, exactly once; the engine enforces both, so the trust surface
 * cannot be inflated by replay.
 */
export async function POST(req: NextRequest) {
  return guard(async () => {
    const auth = await requireAnyRole(['CUSTOMER', 'INSTITUTION'])
    if (!auth.ok) return auth.res
    const parsed = await readJson(req, BodySchema)
    if (!parsed.ok) return parsed.res
    const { bookingId, rating, review } = parsed.data

    const b = await db.booking.findUnique({ where: { id: bookingId }, select: { id: true, refCode: true, customerId: true, rating: true } })
    if (!b) return notFound('Booking not found.')
    if (b.customerId !== auth.user.customerId) return forbidden('This booking belongs to another customer.')
    if (b.rating != null) return conflict('This service has already been rated.')

    const clamp = (v: number | undefined) => (v == null ? undefined : Math.max(1, Math.min(5, Math.round(v))))
    const f = parsed.data.factors
    const ratingJson =
      f && (f.quality || f.timeliness || f.behaviour || f.communication)
        ? JSON.stringify({ quality: clamp(f.quality) ?? 3, timeliness: clamp(f.timeliness) ?? 3, behaviour: clamp(f.behaviour) ?? 3, communication: clamp(f.communication) ?? 3 })
        : null

    const upd = await rateBooking(bookingId, Math.round(rating), review, ratingJson)
    await recordAudit({
      action: 'BOOKING_RATED',
      entity: 'Booking',
      entityId: bookingId,
      detail: `${b.refCode} · ${Math.round(rating)}★${f ? ` · quality ${f.quality ?? '-'} timeliness ${f.timeliness ?? '-'} behaviour ${f.behaviour ?? '-'} communication ${f.communication ?? '-'}` : ''}`,
    })
    return ok({ bookingId, rating: Math.round(rating) , refCode: b.refCode, status: upd.status })
  })
}
