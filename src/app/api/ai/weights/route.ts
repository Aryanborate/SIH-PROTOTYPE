import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getMatchWeights, saveMatchWeights, WEIGHT_META, DEFAULT_WEIGHTS } from '@/lib/matching'
import { recordAudit } from '@/lib/audit'
import { guard, ok, readJson, requireAnyRole } from '@/lib/http'
import type { MatchWeights } from '@/lib/matching'

export const dynamic = 'force-dynamic'

const WeightsSchema = z
  .object({
    skillMatch: z.number().min(0).max(100).optional(),
    certification: z.number().min(0).max(100).optional(),
    distance: z.number().min(0).max(100).optional(),
    availability: z.number().min(0).max(100).optional(),
    workload: z.number().min(0).max(100).optional(),
    serviceHistory: z.number().min(0).max(100).optional(),
  })
  .refine((v) => Object.values(v).some((x) => typeof x === 'number'), { message: 'Provide at least one weight to change.' })

export async function GET() {
  return guard(async () => {
    const weights = await getMatchWeights()
    return ok({ weights, meta: WEIGHT_META, defaults: DEFAULT_WEIGHTS })
  })
}

export async function PUT(req: NextRequest) {
  return guard(async () => {
    // FIX: was unauthenticated, and accepted ANY finite number (including 0 and
    // negatives) because there was no range validation.
    const auth = await requireAnyRole(['PLATFORM_ADMIN'])
    if (!auth.ok) return auth.res

    const parsed = await readJson(req, WeightsSchema)
    if (!parsed.ok) return parsed.res
    const patch = parsed.data as Partial<MatchWeights>

    const saved = await saveMatchWeights(patch, auth.user.name)
    const detail =
      Object.keys(patch).length
        ? (Object.entries(saved as unknown as Record<string, number>)
            .filter(([k]) => k in DEFAULT_WEIGHTS)
            .map(([k, v]) => `${k} ${Math.round(v)}`)
            .join(' · ') || 'weights unchanged')
        : 'reset to built-in defaults'

    await recordAudit({ action: 'AI_WEIGHTS_UPDATED', entity: 'MatchWeightConfig', entityId: 'default', detail })
    return ok({ weights: saved, meta: WEIGHT_META })
  })
}

/** Convenience for the console's "Reset to defaults" affordance. */
export async function DELETE() {
  return guard(async () => {
    const auth = await requireAnyRole(['PLATFORM_ADMIN'])
    if (!auth.ok) return auth.res
    const saved = await saveMatchWeights({}, auth.user.name)
    await recordAudit({ action: 'AI_WEIGHTS_UPDATED', entity: 'MatchWeightConfig', entityId: 'default', detail: 'reset to built-in defaults' })
    return ok({ weights: saved, meta: WEIGHT_META })
  })
}
