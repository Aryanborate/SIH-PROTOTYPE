import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { forbidden, guard, ok, requireSession } from '@/lib/http'

export const dynamic = 'force-dynamic'

/**
 * SECURITY FIX: this route previously had NO auth, NO ownership check, NO
 * validation and NO audit — and `updateMany({ where: { audience } })` let any
 * caller mark EVERY customer's notifications as read. It now resolves the
 * caller's own audience/id from the signed session, so a caller can only ever
 * touch their own notification stream.
 */
function ownStream(user: { role: string; customerId?: string; workerId?: string; cooperativeId?: string; talukaId?: string; districtId?: string; federationId?: string }): { audience: string; audienceId: string } | null {
  if (user.role === 'CUSTOMER' || user.role === 'INSTITUTION') return user.customerId ? { audience: 'CUSTOMER', audienceId: user.customerId } : null
  if (user.role === 'WORKER') return user.workerId ? { audience: 'WORKER', audienceId: user.workerId } : null
  if (user.role === 'COOP_ADMIN') return user.cooperativeId ? { audience: 'COOP', audienceId: user.cooperativeId } : null
  if (user.role === 'TALUKA_COORD') return user.talukaId ? { audience: 'TALUKA', audienceId: user.talukaId } : null
  if (user.role === 'DISTRICT_COORD') return user.districtId ? { audience: 'DISTRICT', audienceId: user.districtId } : null
  if (user.role === 'STATE_ADMIN' || user.role === 'NATIONAL_ADMIN') {
    return user.federationId ? { audience: 'STATE', audienceId: user.federationId } : null
  }
  return null
}

export async function GET(req: NextRequest) {
  return guard(async () => {
    const auth = await requireSession()
    if (!auth.ok) return auth.res
    const own = ownStream(auth.user)
    if (!own) return forbidden('No notification stream for this identity.')

    const items = await db.notification.findMany({
      where: { audience: own.audience, audienceId: own.audienceId },
      orderBy: { createdAt: 'desc' },
      take: 40,
    })
    return ok({ notifications: items, unread: items.filter((n) => !n.read).length })
  })
}

export async function PATCH(req: NextRequest) {
  return guard(async () => {
    const auth = await requireSession()
    if (!auth.ok) return auth.res
    const own = ownStream(auth.user)
    if (!own) return forbidden('No notification stream for this identity.')

    const body = (await req.json().catch(() => ({}))) as { id?: string }
    if (body.id) {
      // Scoped by the caller's own stream, so an arbitrary id is a no-op.
      const r = await db.notification.updateMany({
        where: { id: body.id, audience: own.audience, audienceId: own.audienceId },
        data: { read: true },
      })
      return ok({ updated: r.count })
    }
    const r = await db.notification.updateMany({
      where: { audience: own.audience, audienceId: own.audienceId, read: false },
      data: { read: true },
    })
    return ok({ updated: r.count })
  })
}
