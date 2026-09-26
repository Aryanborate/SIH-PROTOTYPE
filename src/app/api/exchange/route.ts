import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { badRequest, conflict, guard, notFound, ok, readJson, requireAnyRole } from '@/lib/http'

export const dynamic = 'force-dynamic'

const CreateSchema = z.object({
  skill: z.string().min(1).max(40),
  fromCoopId: z.string().max(60).optional(),
  fromCoopName: z.string().min(1).max(160),
  toCoopId: z.string().max(60).optional(),
  toCoopName: z.string().min(1).max(160),
  districtName: z.string().min(1).max(120),
  workerCount: z.coerce.number().int().min(1).max(50),
  distanceKm: z.coerce.number().min(0).max(500).optional(),
  expectedDemand: z.coerce.number().int().min(0).max(100000).optional(),
  durationDays: z.coerce.number().int().min(1).max(365).optional(),
  rationale: z.string().max(500).optional(),
  federationId: z.string().max(60).optional(),
  demo: z.boolean().optional(),
})

const PatchSchema = z.object({
  id: z.string().min(1).max(60),
  action: z.enum(['approve', 'reject']),
  /** Human-readable attribution for demo narration; the AUDIT actor is the session. */
  by: z.string().max(120).optional(),
})

/**
 * Spec §27 — Cooperative Service Exchange. THE CORE USP.
 * AI recommends; authorized cooperative/federation personnel approve. Workers
 * are NEVER auto-transferred.
 */
export async function GET() {
  return guard(async () => {
    // FIX: unbounded query — this table grows every time a recommendation lands.
    const recs = await db.exchangeRecommendation.findMany({ orderBy: { createdAt: 'desc' }, take: 200 })
    return ok({
      recommendations: recs,
      stats: {
        pending: recs.filter((r) => r.status === 'PENDING').length,
        approved: recs.filter((r) => r.status === 'APPROVED').length,
        rejected: recs.filter((r) => r.status === 'REJECTED').length,
        workersMoved: recs.filter((r) => r.status === 'APPROVED').reduce((s, r) => s + r.workerCount, 0),
      },
    })
  })
}

export async function POST(req: NextRequest) {
  return guard(async () => {
    const auth = await requireAnyRole(['PLATFORM_ADMIN', 'DISTRICT_COORD', 'STATE_ADMIN', 'NATIONAL_ADMIN', 'COOP_ADMIN', 'TALUKA_COORD'])
    if (!auth.ok) return auth.res

    const parsed = await readJson(req, CreateSchema)
    if (!parsed.ok) return parsed.res
    const b = parsed.data

    const [fromCoop, toCoop] = await Promise.all([
      b.fromCoopId ? Promise.resolve(null) : db.cooperative.findFirst({ where: { name: b.fromCoopName } }),
      b.toCoopId ? Promise.resolve(null) : db.cooperative.findFirst({ where: { name: b.toCoopName } }),
    ])
    const fromId = b.fromCoopId ?? fromCoop?.id
    const toId = b.toCoopId ?? toCoop?.id
    if (!fromId || !toId) return badRequest('Both cooperatives must exist before a transfer can be recommended.')
    if (fromId === toId) return badRequest('Source and destination cooperatives must be different.')

    const rec = await db.exchangeRecommendation.create({
      data: {
        skill: b.skill,
        fromCoopId: fromId,
        fromCoopName: b.fromCoopName,
        toCoopId: toId,
        toCoopName: b.toCoopName,
        districtName: b.districtName,
        workerCount: b.workerCount,
        distanceKm: b.distanceKm ?? 0,
        expectedDemand: b.expectedDemand ?? 0,
        durationDays: b.durationDays ?? 7,
        rationale: b.rationale ?? 'Capacity shortfall detected by demand forecast',
        // Only the platform console / demo engine may flag a row for RESET DEMO.
        isDemoScript: auth.user.role === 'PLATFORM_ADMIN' && !!b.demo,
      },
    })
    await db.notification.create({
      data: {
        audience: 'STATE',
        audienceId: b.federationId ?? 'federation',
        title: 'New capacity exchange recommendation',
        body: `${rec.workerCount} ${rec.skill}(s) ${rec.fromCoopName} → ${rec.toCoopName} — approval required`,
        type: 'WARNING',
      },
    })
    await recordAudit({
      action: 'EXCHANGE_CREATED',
      entity: 'ExchangeRecommendation',
      entityId: rec.id,
      detail: `${rec.workerCount} ${rec.skill}(s) ${rec.fromCoopName} → ${rec.toCoopName} — awaiting human approval`,
    })
    return ok({ recommendation: rec }, 201)
  })
}

export async function PATCH(req: NextRequest) {
  return guard(async () => {
    // SECURITY FIX: approving a cross-cooperative WORKER TRANSFER was an
    // unauthenticated endpoint, and the `actor` written to the audit log came
    // straight from the request body.
    const auth = await requireAnyRole(['PLATFORM_ADMIN', 'DISTRICT_COORD', 'STATE_ADMIN', 'NATIONAL_ADMIN', 'COOP_ADMIN'])
    if (!auth.ok) return auth.res

    const parsed = await readJson(req, PatchSchema)
    if (!parsed.ok) return parsed.res
    const { id, action, by } = parsed.data

    const existing = await db.exchangeRecommendation.findUnique({ where: { id } })
    if (!existing) return notFound('Recommendation not found.')
    if (existing.status !== 'PENDING') return conflict(`This recommendation was already ${existing.status.toLowerCase()}.`)

    // Attribution for the record is the signed-in person, never the body.
    const rec = await db.exchangeRecommendation.update({
      where: { id },
      data: {
        status: action === 'approve' ? 'APPROVED' : 'REJECTED',
        approvedBy: auth.user.name + (by && auth.user.role === 'PLATFORM_ADMIN' ? ` · ${by}` : ''),
        decidedAt: new Date(),
      },
    })
    await db.notification.create({
      data: {
        audience: 'COOP',
        audienceId: action === 'approve' ? rec.toCoopId : rec.fromCoopId,
        title: `Cross-cooperative transfer ${action === 'approve' ? 'approved' : 'rejected'}`,
        body: `${rec.workerCount} ${rec.skill}(s) ${rec.fromCoopName} → ${rec.toCoopName}`,
        type: action === 'approve' ? 'SUCCESS' : 'WARNING',
      },
    })
    await recordAudit({
      action: action === 'approve' ? 'EXCHANGE_APPROVED' : 'EXCHANGE_REJECTED',
      entity: 'ExchangeRecommendation',
      entityId: rec.id,
      detail: `${rec.workerCount} ${rec.skill}(s) ${rec.fromCoopName} → ${rec.toCoopName} (${rec.districtName})`,
    })
    return ok({ recommendation: rec })
  })
}
