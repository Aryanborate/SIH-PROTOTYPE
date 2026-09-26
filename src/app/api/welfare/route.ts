import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getWelfareProfile } from '@/lib/welfare'
import { badRequest, guard, notFound, ok, requireAnyRole } from '@/lib/http'

export const dynamic = 'force-dynamic'

const Query = z.object({ workerId: z.string().min(1).max(60) })

/** Spec §21 — Worker Welfare Wallet: insurance, social security, training, benefits. */
export async function GET(req: NextRequest) {
  return guard(async () => {
    const auth = await requireAnyRole(['WORKER', 'COOP_ADMIN', 'TALUKA_COORD', 'DISTRICT_COORD', 'PLATFORM_ADMIN'])
    if (!auth.ok) return auth.res
    const parsed = Query.safeParse({ workerId: req.nextUrl.searchParams.get('workerId') })
    if (!parsed.success) return badRequest('workerId required')
    // IDOR guard: a worker may only read their own wallet; admins may read any.
    if (auth.user.role === 'WORKER' && auth.user.workerId !== parsed.data.workerId) {
      return badRequest('You can only view your own welfare wallet.')
    }
    const profile = await getWelfareProfile(parsed.data.workerId)
    if (!profile) return notFound('worker not found')
    return ok(profile)
  })
}
