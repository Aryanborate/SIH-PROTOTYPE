import { NextRequest } from 'next/server'
import { z } from 'zod'
import { route } from '@/lib/geoapify'
import { callerKey, guard, ok, rateLimit } from '@/lib/http'

export const dynamic = 'force-dynamic'

const Query = z.object({
  fromLat: z.coerce.number().min(-90).max(90),
  fromLon: z.coerce.number().min(-180).max(180),
  toLat: z.coerce.number().min(-90).max(90),
  toLon: z.coerce.number().min(-180).max(180),
})

/**
 * Spec §42 — Routing API (GeoApify).
 * Drives the customer live-tracking route line and the worker's turn-by-turn
 * "on the way" directions. Falls back to a straight-line estimate offline.
 */
export async function GET(req: NextRequest) {
  return guard(async () => {
    const limited = rateLimit(callerKey(req, 'geo-route'), 120, 60_000)
    if (limited) return limited
    const sp = req.nextUrl.searchParams
    const parsed = Query.safeParse({
      fromLat: sp.get('fromLat'),
      fromLon: sp.get('fromLon'),
      toLat: sp.get('toLat'),
      toLon: sp.get('toLon'),
    })
    if (!parsed.success) return ok({ source: 'local-grid', distanceKm: 0, durationMin: 0, polyline: null, steps: [] })
    const result = await route(
      { lat: parsed.data.fromLat, lon: parsed.data.fromLon },
      { lat: parsed.data.toLat, lon: parsed.data.toLon },
    )
    return ok(result)
  })
}
