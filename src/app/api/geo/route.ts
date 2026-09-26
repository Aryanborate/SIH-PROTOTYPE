import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getGeoData } from '@/lib/geo'
import { callerKey, guard, ok, rateLimit } from '@/lib/http'

export const dynamic = 'force-dynamic'

const Query = z.object({
  role: z.enum(['CUSTOMER', 'COOP', 'DISTRICT', 'FEDERATION']).default('CUSTOMER'),
  refId: z.string().max(80).optional(),
  area: z.string().max(120).optional(),
})

/**
 * Spec §42 — Map & geo-spatial data for the stylized map.
 * Pins/zones/heatmap are computed locally; the optional `area` is geocoded via
 * GeoApify so the map can centre on a real address. Read-only and rate-limited.
 */
export async function GET(req: NextRequest) {
  return guard(async () => {
    const limited = rateLimit(callerKey(req, 'geo-map'), 120, 60_000)
    if (limited) return limited
    const sp = req.nextUrl.searchParams
    const parsed = Query.safeParse({
      role: (sp.get('role') ?? 'CUSTOMER').toUpperCase(),
      refId: sp.get('refId') ?? undefined,
      area: sp.get('area') ?? undefined,
    })
    if (!parsed.success) return ok({ role: 'CUSTOMER', refId: '', title: '', pins: [], zones: [], summary: { workers: 0, available: 0, jobs: 0, emergencyZones: 0 }, bounds: { minX: -0.5, minY: -0.5, maxX: 16.5, maxY: 13.5 }, note: '' })

    const data = await getGeoData(parsed.data.role, parsed.data.refId ?? '')

    // Optional real-world anchor: geocode a free-text area to coordinates.
    if (parsed.data.area) {
      const { geocode } = await import('@/lib/geoapify')
      const { source, result } = await geocode(parsed.data.area)
      data.anchor = result ? { label: result.label, lat: result.lat, lon: result.lon, area: result.area } : null
      data.geoSource = source
    }
    return ok(data)
  })
}
