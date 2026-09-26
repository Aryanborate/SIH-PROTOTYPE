import { NextRequest } from 'next/server'
import { buildForecast, FORECAST_ZONES } from '@/lib/forecast'
import { guard, ok } from '@/lib/http'

export const dynamic = 'force-dynamic'

/**
 * Spec §61 — GET /demand-forecast
 * Spec §28 — AI Demand Forecasting. Thin, documented alias of /api/ai/forecast
 * so the spec-named endpoint exists.
 */
export async function GET(req: NextRequest) {
  return guard(async () => {
    const sp = req.nextUrl.searchParams
    const zone = (sp.get('zone') ?? '').slice(0, 40)
    const days = Math.min(14, Math.max(1, Number(sp.get('days')) || 7))
    if (!zone || !FORECAST_ZONES.some((z) => z.key === zone)) {
      return ok({ ok: false, zoneOptions: FORECAST_ZONES, error: 'Unknown or missing zone.' })
    }
    return ok(buildForecast(zone, days))
  })
}
