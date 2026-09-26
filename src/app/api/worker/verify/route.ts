import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { buildWorkerChecks, WORKER_VERIFICATION_CHECKS } from '@/lib/verify'
import { conflict, forbidden, guard, notFound, ok, requireAnyRole, serverError } from '@/lib/http'

export const dynamic = 'force-dynamic'

/**
 * Spec §61 — POST /worker/verify
 * Spec §44 — five transparent worker checks. Never a hidden score.
 */
export async function POST(req: NextRequest) {
  return guard(async () => {
    const auth = await requireAnyRole(['PLATFORM_ADMIN', 'COOP_ADMIN', 'DISTRICT_COORD', 'TALUKA_COORD'])
    if (!auth.ok) return auth.res
    const body = (await req.json().catch(() => ({}))) as { id?: string; note?: string }
    if (!body.id) return conflict('A worker id is required.')

    const w = await db.worker.findUnique({ where: { id: body.id } })
    if (!w) return notFound('Worker not found.')
    if (auth.user.role === 'COOP_ADMIN' && auth.user.cooperativeId !== w.cooperativeId) {
      return forbidden('A cooperative may only verify its own members.')
    }

    const checks = await buildWorkerChecks(w.id)
    const allPass = checks.length > 0 && checks.every((c) => c.pass)
    if (!allPass) {
      return serverError(
        Object.assign(new Error('Every verification check must pass before a worker can be verified.'), { status: 409, checks }),
      )
    }

    const upd = await db.worker.update({ where: { id: w.id }, data: { certStatus: 'VERIFIED' } })
    await recordAudit({
      action: 'WORKER_VERIFY',
      entity: 'Worker',
      entityId: w.id,
      detail: `Verified ${w.name} · all ${checks.length} checks pass${body.note ? ` · ${String(body.note).slice(0, 120)}` : ''}`,
    })
    return ok({
      worker: { id: upd.id, name: upd.name, certStatus: upd.certStatus },
      checks,
      criteria: WORKER_VERIFICATION_CHECKS,
      note: 'Verification is criteria-based and auditable. No opaque AI trust score is used.',
    })
  })
}
