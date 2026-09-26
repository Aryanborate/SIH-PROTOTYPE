import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { buildVerificationBadges, WORKER_VERIFICATION_CHECKS } from '@/lib/verify'
import { conflict, forbidden, guard, notFound, ok, requireAnyRole, safeObject } from '@/lib/http'

export const dynamic = 'force-dynamic'

/**
 * Spec §61 — POST /cooperative/verify and POST /worker/verify
 * Spec §44 — Verification System. Cooperative status:
 *   🟢 Organization Verified · 🔵 Service Ready · 🟣 Welfare Ready · ⭐ Operationally Trusted
 * Worker status: identity / cooperative / skill / certification / safety training.
 * Transparent criteria only — never a fabricated "AI trust score".
 */
export async function POST(req: NextRequest) {
  return guard(async () => {
    const auth = await requireAnyRole(['PLATFORM_ADMIN', 'STATE_ADMIN', 'DISTRICT_COORD'])
    if (!auth.ok) return auth.res
    const body = (await req.json().catch(() => ({}))) as { id?: string; note?: string }
    if (!body.id) return conflict('A cooperative id is required.')

    const coop = await db.cooperative.findUnique({ where: { id: body.id } })
    if (!coop) return notFound('Cooperative not found.')
    if (coop.verification === 'VERIFIED') return conflict('This cooperative is already verified.')

    const badges = await buildVerificationBadges(coop.id)
    const policy = safeObject<Record<string, unknown>>(coop.pricingPolicyJson)
    const upd = await db.cooperative.update({
      where: { id: coop.id },
      data: {
        verification: 'VERIFIED',
        status: 'OPERATIONAL',
        pricingPolicyJson: JSON.stringify({ ...policy, verifiedAt: new Date().toISOString() }),
      },
    })
    await recordAudit({
      action: 'WORKER_VERIFY',
      entity: 'Cooperative',
      entityId: coop.id,
      detail: `Verified ${coop.name} · badges: ${badges.map((b) => b.key).join(', ')}${body.note ? ` · ${String(body.note).slice(0, 120)}` : ''}`,
    })
    return ok({
      cooperative: { id: upd.id, name: upd.name, verification: upd.verification, status: upd.status },
      badges,
      criteria: WORKER_VERIFICATION_CHECKS,
      note: 'Verification is criteria-based and auditable. No opaque AI trust score is used.',
    })
  })
}
