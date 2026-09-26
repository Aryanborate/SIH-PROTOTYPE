import { NextRequest } from 'next/server'
import { z } from 'zod'
import { autocomplete } from '@/lib/geoapify'
import { guard, ok, rateLimit, callerKey } from '@/lib/http'

export const dynamic = 'force-dynamic'

const Query = z.object({ q: z.string().min(2).max(120) })

/** Spec §42 — Address Autocomplete (GeoApify) with an offline grid fallback. */
export async function GET(req: NextRequest) {
  return guard(async () => {
    const limited = rateLimit(callerKey(req, 'geo-autocomplete'), 60, 60_000)
    if (limited) return limited
    const parsed = Query.safeParse({ q: req.nextUrl.searchParams.get('q') ?? '' })
    if (!parsed.success) return ok({ source: 'local-grid', results: [] })
    const { source, results } = await autocomplete(parsed.data.q)
    return ok({ source, results })
  })
}
