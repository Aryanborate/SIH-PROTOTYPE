import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getFeeConfig, validateFeeConfig } from '@/lib/fees'
import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { badRequest, guard, ok, readJson, requireAnyRole, safeJson } from '@/lib/http'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

const FeeSchema = z.object({
  workerSharePct: z.number().min(0).max(100),
  coopPct: z.number().min(0).max(100),
  welfarePct: z.number().min(0).max(100),
  platformPct: z.number().min(0).max(100),
})

/** Spec §38 — configurable (not hard-coded) fee model + payment history. */
export async function GET(req: NextRequest) {
  return guard(async () => {
    const sp = req.nextUrl.searchParams
    const customerId = sp.get('customerId')
    const workerId = sp.get('workerId')
    const coopId = sp.get('coopId')
    const config = await getFeeConfig()

    // IDOR guard: a customer/worker may only read their OWN payments.
    const session = await getSession()
    if (session && (session.role === 'CUSTOMER' || session.role === 'INSTITUTION') && customerId && customerId !== session.customerId) {
      return badRequest('You can only view your own payments.')
    }
    if (session?.role === 'WORKER' && workerId && workerId !== session.workerId) {
      return badRequest('You can only view your own payments.')
    }

    const bookings = await db.booking
      .findMany({
        where: customerId ? { customerId } : workerId ? { workerId } : coopId ? { cooperativeId: coopId } : {},
        orderBy: { updatedAt: 'desc' },
        take: 40,
        select: { refCode: true, title: true, status: true, paymentJson: true, finalPrice: true, estimatedPrice: true, updatedAt: true, customerId: true, workerId: true, cooperativeId: true },
      })
      .catch(() => [])

    // FIX: unguarded JSON.parse in a handler with no try/catch.
    const payments = bookings
      .filter((b) => b.paymentJson)
      .map((b) => {
        const p = safeJson<Record<string, unknown>>(b.paymentJson, {})
        return {
          refCode: b.refCode, title: b.title, method: p.method, amount: p.amount,
          workerShare: p.workerShare, coopCommission: p.coopCommission, welfare: p.welfare,
          platformFee: p.platformFee, txnId: p.txnId, paidAt: p.paidAt,
        }
      })

    return ok({
      config,
      payments,
      note: 'Prototype payments — mock settlement over UPI/Razorpay rails, no real keys or live transactions.',
    })
  })
}

export async function PUT(req: Request) {
  return guard(async () => {
    // FIX: was an unauthenticated platform-admin operation, and `updatedBy`
    // came from the request body so the audit entry was forgeable.
    const auth = await requireAnyRole(['PLATFORM_ADMIN'])
    if (!auth.ok) return auth.res

    const parsed = await readJson(req, FeeSchema)
    if (!parsed.ok) return parsed.res
    const input = parsed.data
    const check = validateFeeConfig(input)
    if (!check.ok) return badRequest(check.error ?? 'Invalid fee split.')

    await db.feeConfig.upsert({
      where: { id: 'default' },
      update: { ...input, updatedBy: auth.user.name },
      create: { id: 'default', ...input, updatedBy: auth.user.name },
    })
    await recordAudit({
      action: 'FEE_CONFIG_UPDATED',
      entity: 'FeeConfig',
      entityId: 'default',
      detail: `Fee split → worker ${input.workerSharePct}% · coop ${input.coopPct}% · welfare ${input.welfarePct}% · platform ${input.platformPct}%`,
    })
    return ok({ config: await getFeeConfig() })
  })
}
