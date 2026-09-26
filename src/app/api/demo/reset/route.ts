import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { guard, ok, requireAnyRole } from '@/lib/http'

export const dynamic = 'force-dynamic'

/**
 * Spec §66 — RESET DEMO.
 *
 * Removes every artifact the SIH demo engine created (bookings flagged
 * isDemoScript + their notifications/complaints + demo exchange records) so the
 * golden-path demo always starts from a clean, judge-ready state. Seeded
 * dashboard history is intentionally preserved.
 *
 * SECURITY FIX: this used to be an unauthenticated mass delete, so any page a
 * demo user visited could wipe the dataset with a cross-origin form POST. It is
 * now restricted to the platform admin and CSRF-protected by the middleware.
 */
export async function POST(req: NextRequest) {
  return guard(async () => {
    const auth = await requireAnyRole(['PLATFORM_ADMIN'])
    if (!auth.ok) return auth.res

    const demoBookings = await db.booking.findMany({ where: { isDemoScript: true }, select: { id: true, refCode: true } })
    const bookingIds = demoBookings.map((b) => b.id)

    let complaints = 0
    let notifications = 0
    let exchange = 0
    let bookings = 0

    if (bookingIds.length > 0) {
      const delC = await db.complaint.deleteMany({ where: { bookingId: { in: bookingIds } } })
      complaints = delC.count

      // Notifications are not FK-linked — match demo booking refCodes in the body.
      let delN = { count: 0 }
      for (const b of demoBookings) {
        const r = await db.notification.deleteMany({
          where: { OR: [{ body: { contains: b.refCode } }, { title: { contains: b.refCode } }] },
        })
        delN = { count: delN.count + r.count }
      }
      notifications = delN.count

      const delB = await db.booking.deleteMany({ where: { id: { in: bookingIds } } })
      bookings = delB.count
    }

    const delX = await db.exchangeRecommendation.deleteMany({ where: { isDemoScript: true } })
    exchange = delX.count

    // The reset actor is the signed-in operator, not a hardcoded string.
    await recordAudit({
      action: 'DEMO_RESET',
      entity: 'Demo',
      detail: `bookings=${bookings} notifications=${notifications} complaints=${complaints} exchange=${exchange}`,
    })
    return ok({ bookings, notifications, complaints, exchange })
  })
}

/** Dry run so the console can show what RESET DEMO would remove. */
export async function GET() {
  return guard(async () => {
    const auth = await requireAnyRole(['PLATFORM_ADMIN'])
    if (!auth.ok) return auth.res
    const [bookings, exchange] = await Promise.all([
      db.booking.count({ where: { isDemoScript: true } }),
      db.exchangeRecommendation.count({ where: { isDemoScript: true } }),
    ])
    return ok({ pendingBookings: bookings, pendingExchange: exchange })
  })
}
