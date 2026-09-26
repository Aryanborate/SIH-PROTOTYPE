import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, ok, requireAnyRole } from '@/lib/http'

export const dynamic = 'force-dynamic'

/** Spec §61 — GET /capacity-exchange. Spec §27 — the Cooperative Service Exchange. */
export async function GET(req: NextRequest) {
  return guard(async () => {
    const auth = await requireAnyRole(['CUSTOMER', 'INSTITUTION', 'WORKER', 'COOP_ADMIN', 'TALUKA_COORD', 'DISTRICT_COORD', 'STATE_ADMIN', 'NATIONAL_ADMIN', 'PLATFORM_ADMIN'])
    if (!auth.ok) return auth.res
    const status = req.nextUrl.searchParams.get('status') || undefined
    const recs = await db.exchangeRecommendation.findMany({
      where: status ? { status } : {},
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    return ok({
      recommendations: recs,
      stats: {
        pending: recs.filter((r) => r.status === 'PENDING').length,
        approved: recs.filter((r) => r.status === 'APPROVED').length,
        rejected: recs.filter((r) => r.status === 'REJECTED').length,
        workersMoved: recs.filter((r) => r.status === 'APPROVED').reduce((s, r) => s + r.workerCount, 0),
      },
      note: 'AI recommends; authorized cooperative or federation personnel approve. Workers are never auto-transferred.',
    })
  })
}
