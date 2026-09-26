import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getWorkerEarnings } from '@/lib/earnings'
import { badRequest, guard, notFound, ok, requireAnyRole } from '@/lib/http'

export const dynamic = 'force-dynamic'

const Query = z.object({ workerId: z.string().min(1).max(60) })

/** Spec §39 — Worker Earnings: today / week / month / pending + 7-day series. */
export async function GET(req: NextRequest) {
  return guard(async () => {
    // FIX: financial PII was readable for any workerId by any caller.
    const auth = await requireAnyRole(['WORKER', 'COOP_ADMIN', 'TALUKA_COORD', 'DISTRICT_COORD', 'PLATFORM_ADMIN'])
    if (!auth.ok) return auth.res
    const parsed = Query.safeParse({ workerId: req.nextUrl.searchParams.get('workerId') })
    if (!parsed.success) return badRequest('workerId required')
    if (auth.user.role === 'WORKER' && auth.user.workerId !== parsed.data.workerId) {
      return badRequest('You can only view your own earnings.')
    }
    const data = await getWorkerEarnings(parsed.data.workerId)
    if (!data) return notFound('worker not found')
    return ok(data)
  })
}
