import { NextRequest } from 'next/server'
import { z } from 'zod'
import { matchWorkers, inferCategory, inferUrgency } from '@/lib/matching'
import { guard, ok, readJson, requireAnyRole } from '@/lib/http'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  description: z.string().min(1).max(2000),
  area: z.string().max(120).optional(),
  customerId: z.string().max(60).optional(),
  scheduledAt: z.string().max(40).optional(),
  urgency: z.enum(['NORMAL', 'URGENT', 'EMERGENCY']).optional(),
  mode: z.enum(['INSTANT', 'QUOTE']).optional(),
  /** Skip the worker search and only return the structured request. */
  analyseOnly: z.boolean().optional(),
})

/**
 * Spec §61 — POST /service-requests
 *
 * A first-class "understand the request" endpoint: multilingual free text in,
 * a structured ServiceRequest out (category, problem, urgency, schedule,
 * location), plus the fair-price range and the ONE recommended worker.
 * The booking itself is created by POST /bookings.
 */
export async function POST(req: NextRequest) {
  return guard(async () => {
    const auth = await requireAnyRole(['CUSTOMER', 'INSTITUTION', 'PLATFORM_ADMIN', 'COOP_ADMIN'])
    if (!auth.ok) return auth.res
    const parsed = await readJson(req, BodySchema)
    if (!parsed.ok) return parsed.res
    const b = parsed.data

    const { inferProblemLabel } = await import('@/lib/matching')
    const categoryKey = inferCategory(b.description)
    const urgency = b.urgency ?? inferUrgency(b.description)
    const area = b.area?.trim() || (auth.user.role === 'CUSTOMER' ? 'Kothrud' : 'Kothrud')

    const request: Record<string, unknown> = {
      categoryKey,
      problem: inferProblemLabel(b.description, categoryKey),
      description: b.description,
      urgency,
      area,
      scheduledAt: b.scheduledAt ?? new Date().toISOString(),
      mode: b.mode ?? 'INSTANT',
    }
    if (b.analyseOnly) return ok({ request, matched: null, priceEstimate: null, pipeline: [] })

    const m = await matchWorkers({ categoryKey, area, urgency, scheduledAt: b.scheduledAt, customerId: b.customerId })
    return ok({
      request,
      matched: m.best ? { workerId: m.best.id, name: m.best.name, cooperative: m.best.cooperativeName, distanceKm: m.best.distanceKm, etaMin: m.best.etaMin, rating: m.best.rating, score: m.best.score } : null,
      priceEstimate: m.priceEstimate,
      pipeline: m.pipeline,
      geoSource: m.geoSource,
    })
  })
}
