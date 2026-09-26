import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, ok, requireAnyRole } from '@/lib/http'

export const dynamic = 'force-dynamic'

/**
 * Spec §57 — Audit & Transparency read API.
 * GET /api/audit?limit=100&entity=Booking&action=EXCHANGE_APPROVED&q=rajesh
 *
 * FIXES: this used to publish the ENTIRE audit trail to any unauthenticated
 * caller, and loaded the whole table (no `take`) just to build a filter list.
 * It is now governance-roles only, and both queries are bounded.
 */
export async function GET(req: NextRequest) {
  return guard(async () => {
    const auth = await requireAnyRole(['COOP_ADMIN', 'TALUKA_COORD', 'DISTRICT_COORD', 'STATE_ADMIN', 'NATIONAL_ADMIN', 'PLATFORM_ADMIN'])
    if (!auth.ok) return auth.res

    const sp = req.nextUrl.searchParams
    const limit = Math.min(Math.max(Number(sp.get('limit')) || 100, 1), 500)
    const entity = sp.get('entity') || undefined
    const action = sp.get('action') || undefined
    const q = (sp.get('q') ?? '').trim().slice(0, 80)

    const where = {
      ...(entity ? { entity } : {}),
      ...(action ? { action } : {}),
      ...(q ? { OR: [{ actor: { contains: q } }, { detail: { contains: q } }, { entity: { contains: q } }, { action: { contains: q } }] } : {}),
    }

    const [rows, total, actionRows] = await Promise.all([
      db.auditLog.findMany({ where, orderBy: { at: 'desc' }, take: limit }),
      db.auditLog.count({ where }),
      // Bounded distinct-action lookup for the filter dropdown.
      db.auditLog.findMany({ select: { action: true }, distinct: ['action'], take: 200 }),
    ])

    return ok({
      entries: rows.map((r) => ({
        id: r.id,
        at: r.at.toISOString(),
        actor: r.actor,
        actorRole: r.actorRole,
        action: r.action,
        entity: r.entity,
        entityId: r.entityId,
        detail: r.detail,
      })),
      actions: Array.from(new Set(actionRows.map((r) => r.action))).sort(),
      // FIX: `total` used to be the PAGE size, so the UI could never paginate.
      total,
      limit,
    })
  })
}
