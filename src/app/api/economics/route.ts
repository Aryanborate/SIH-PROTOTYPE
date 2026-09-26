import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getEconomics, saveEconomics, DEFAULT_SOURCES, type RevenueSource } from '@/lib/economics'
import { recordAudit } from '@/lib/audit'
import { guard, ok, readJson, requireAnyRole } from '@/lib/http'

export const dynamic = 'force-dynamic'

const SourceSchema = z.object({
  key: z.string().min(1).max(40),
  label: z.string().min(1).max(80),
  priceRs: z.coerce.number().min(0).max(10_000_000),
  unit: z.string().max(40),
  active: z.boolean(),
  note: z.string().max(200).default(''),
})

const BodySchema = z.object({
  sources: z.array(SourceSchema).min(1).max(24).optional(),
})

/** Spec §40 — configurable cooperative revenue model. Never a hard-coded price. */
export async function GET() {
  return guard(async () => ok(await getEconomics()))
}

export async function PUT(req: NextRequest) {
  return guard(async () => {
    // SECURITY FIX: was unauthenticated, and `updatedBy` came from the body.
    const auth = await requireAnyRole(['PLATFORM_ADMIN', 'COOP_ADMIN', 'STATE_ADMIN'])
    if (!auth.ok) return auth.res

    const parsed = await readJson(req, BodySchema)
    if (!parsed.ok) return parsed.res
    const sources: RevenueSource[] = parsed.data.sources?.length ? parsed.data.sources : DEFAULT_SOURCES

    const data = await saveEconomics(sources, auth.user.name)
    await recordAudit({
      action: 'ECONOMICS_UPDATED',
      entity: 'EconomicsConfig',
      entityId: 'default',
      detail: `${sources.length} revenue sources saved (${sources.filter((s) => s.active).length} active): ${sources.map((s) => s.label).join(', ').slice(0, 300)}`,
    })
    return ok(data)
  })
}
