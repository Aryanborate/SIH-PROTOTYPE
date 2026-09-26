import { NextRequest } from 'next/server'
import { z } from 'zod'
import { allocateWorker } from '@/lib/matching'
import { guard, ok, readJson } from '@/lib/http'

export const dynamic = 'force-dynamic'

const BodySchema = z.object({
  categoryKey: z.string().min(1).max(40),
  area: z.string().min(1).max(120),
  urgency: z.enum(['NORMAL', 'URGENT', 'EMERGENCY']).default('NORMAL'),
  scheduledAt: z.string().max(40).optional(),
  customerId: z.string().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(10).default(3),
})

/**
 * Spec §61 — GET /workforce-recommendations
 * Spec §30 — Workforce Allocation Engine, with the explainability that §62
 * demands ("Recommended X because: ✓ …"), never a bare "AI selected X".
 */
export async function GET(req: NextRequest) {
  return guard(async () => {
    const sp = req.nextUrl.searchParams
    const parsed = BodySchema.safeParse({
      categoryKey: sp.get('categoryKey') ?? undefined,
      area: sp.get('area') ?? undefined,
      urgency: sp.get('urgency') ?? undefined,
      scheduledAt: sp.get('scheduledAt') ?? undefined,
      customerId: sp.get('customerId') ?? undefined,
      limit: sp.get('limit') ?? undefined,
    })
    if (!parsed.success) {
      return ok({ ok: false, error: 'categoryKey and area are required.', explain: [], recommendations: [] })
    }
    const a = await allocateWorker(parsed.data)
    return ok({
      ok: a.ok,
      aiLabel: a.aiLabel,
      input: a.input,
      explain: a.explain,
      policyNotes: a.policyNotes,
      factorTable: a.factorTable,
      etaMin: a.etaMin,
      priceRange: a.priceRange,
      recommendations: [a.recommended, ...a.alternatives].filter(Boolean).slice(0, parsed.data.limit),
    })
  })
}

export async function POST(req: NextRequest) {
  return guard(async () => {
    const parsed = await readJson(req, BodySchema)
    if (!parsed.ok) return parsed.res
    const a = await allocateWorker(parsed.data)
    return ok({
      ok: a.ok,
      aiLabel: a.aiLabel,
      input: a.input,
      explain: a.explain,
      policyNotes: a.policyNotes,
      factorTable: a.factorTable,
      etaMin: a.etaMin,
      priceRange: a.priceRange,
      recommendations: [a.recommended, ...a.alternatives].filter(Boolean).slice(0, parsed.data.limit),
    })
  })
}
