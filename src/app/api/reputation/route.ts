import { NextRequest } from 'next/server'
import { getCoopReputation } from '@/lib/reputation'
import { badRequest, guard, notFound, ok } from '@/lib/http'

export const dynamic = 'force-dynamic'

/** Spec -36 - cooperative-level service performance (public reputation signal). */
export async function GET(req: NextRequest) {
  return guard(async () => {
    const coopId = req.nextUrl.searchParams.get('coopId')
    if (!coopId) return badRequest('coopId required')
    const data = await getCoopReputation(coopId)
    if (!data) return notFound('cooperative not found')
    return ok(data)
  })
}