import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getInstitutionPortal, createInstitutionRequest } from '@/lib/institution'
import { recordAudit } from '@/lib/audit'
import { badRequest, guard, notFound, ok, readJson, requireAnyRole, safeStr } from '@/lib/http'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

const RequestSchema = z.object({
  customerId: z.string().min(1).max(60),
  type: z.enum(['BULK', 'RECURRING', 'MAINTENANCE', 'EMERGENCY']),
  categoryKey: z.string().min(1).max(40),
  title: z.string().min(3).max(160),
  detail: z.string().max(600).optional(),
  area: z.string().min(1).max(120),
  headcount: z.coerce.number().int().min(1).max(50).optional(),
  schedule: z.object({ freq: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']), day: z.string().max(20).optional(), slot: z.string().max(20).optional() }).optional(),
  scheduledAt: z.string().max(40).optional(),
  contractId: z.string().max(60).optional(),
})

/** Spec §32 — Institutional Customer Portal. */
export async function GET(req: NextRequest) {
  return guard(async () => {
    const auth = await requireAnyRole(['CUSTOMER', 'INSTITUTION', 'COOP_ADMIN', 'PLATFORM_ADMIN'])
    if (!auth.ok) return auth.res
    const requested = req.nextUrl.searchParams.get('customerId')
    const customerId =
      auth.user.role === 'CUSTOMER' || auth.user.role === 'INSTITUTION' ? auth.user.customerId : (requested ?? auth.user.customerId)
    if (!customerId) return badRequest('customerId required')
    // IDOR guard.
    if ((auth.user.role === 'CUSTOMER' || auth.user.role === 'INSTITUTION') && requested && requested !== auth.user.customerId) {
      return badRequest('You can only view your own institution portal.')
    }
    const data = await getInstitutionPortal(customerId)
    if (!data) return notFound('institution not found')
    return ok(data)
  })
}

export async function POST(req: NextRequest) {
  return guard(async () => {
    const auth = await requireAnyRole(['CUSTOMER', 'INSTITUTION', 'COOP_ADMIN', 'PLATFORM_ADMIN'])
    if (!auth.ok) return auth.res
    const parsed = await readJson(req, RequestSchema)
    if (!parsed.ok) return parsed.res
    const b = parsed.data

    if ((auth.user.role === 'CUSTOMER' || auth.user.role === 'INSTITUTION') && b.customerId !== auth.user.customerId) {
      return badRequest('You can only raise requests for your own organisation.')
    }
    if (auth.user.role === 'COOP_ADMIN' && auth.user.customerId && auth.user.customerId !== b.customerId) {
      return badRequest('You can only raise requests for your own organisation.')
    }

    const created = await createInstitutionRequest({
      customerId: b.customerId,
      type: b.type,
      categoryKey: b.categoryKey,
      title: safeStr(b.title, 160),
      detail: safeStr(b.detail, 600),
      area: b.area,
      headcount: b.headcount ?? 1,
      schedule: b.schedule,
      scheduledAt: b.scheduledAt,
      contractId: b.contractId ?? null,
    })
    await recordAudit({
      action: 'INSTITUTION_REQUEST_CREATED',
      entity: 'InstitutionRequest',
      entityId: created.id,
      detail: `${b.type} · ${b.categoryKey} · ${b.headcount ?? 1} worker(s) · ${b.area}`,
    })
    return ok({ request: created }, 201)
  })
}

export { getSession }
