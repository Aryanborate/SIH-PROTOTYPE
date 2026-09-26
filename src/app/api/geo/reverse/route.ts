import { NextRequest } from 'next/server'
import { z } from 'zod'
import { reverseGeocode } from '@/lib/geoapify'
import { guard, ok, rateLimit, callerKey } from '@/lib/http'

export const dynamic = 'force-dynamic'

const Query = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
})

/**
 * Spec §42 — Reverse Geocoding API (GeoApify).
 * Backs the customer "Use current location" button, which previously called
 * navigator.geolocation and then discarded the fix.
 */
export async function GET(req: NextRequest) {
  return guard(async () => {
    const limited = rateLimit(callerKey(req, 'geo-reverse'), 60, 60_000)
    if (limited) return limited
    const sp = req.nextUrl.searchParams
    const parsed = Query.safeParse({ lat: sp.get('lat'), lon: sp.get('lon') })
    if (!parsed.success) return ok({ source: 'local-grid', result: null })
    const { source, result } = await reverseGeocode(parsed.data.lat, parsed.data.lon)
    return ok({ source, result })
  })
}
