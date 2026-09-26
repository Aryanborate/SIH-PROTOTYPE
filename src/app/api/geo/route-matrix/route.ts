import { NextRequest } from 'next/server'
import { z } from 'zod'
import { routeMatrix, type LatLon } from '@/lib/geoapify'
import { callerKey, guard, ok, rateLimit } from '@/lib/http'

export const dynamic = 'force-dynamic'

const Body = z.object({
  sources: z.array(z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) })).min(1).max(60),
  targets: z.array(z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) })).min(1).max(60),
})

/**
 * Spec §42 — Route Matrix API (GeoApify).
 * Many-to-many road distance + duration; the matching engine's travel factor
 * and the emergency ladder's ETA both read from this.
 */
export async function POST(req: NextRequest) {
  return guard(async () => {
    const limited = rateLimit(callerKey(req, 'geo-matrix'), 120, 60_000)
    if (limited) return limited
    let raw: unknown
    try {
      raw = await req.json()
    } catch {
      return ok({ source: 'local-grid', cells: [] })
    }
    const parsed = Body.safeParse(raw)
    if (!parsed.success) return ok({ source: 'local-grid', cells: [] })
    const { source, cells } = await routeMatrix(parsed.data.sources as LatLon[], parsed.data.targets as LatLon[])
    return ok({ source, cells })
  })
}
