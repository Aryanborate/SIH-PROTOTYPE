import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getWorkerTrust, getCoopTrust, fileTrustReport } from '@/lib/trust'
import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { badRequest, forbidden, guard, notFound, ok, readJson, requireAnyRole } from '@/lib/http'

export const dynamic = 'force-dynamic'

const CATEGORIES = ['UNSAFE_ENV', 'ABUSIVE_BEHAVIOUR', 'REPEAT_CANCELLATION', 'PAYMENT_ISSUE'] as const

const FileSchema = z.object({
  workerId: z.string().min(1).max(60),
  bookingId: z.string().max(60).optional(),
  category: z.enum(CATEGORIES),
  detail: z.string().min(5).max(600),
})

/** Spec §35 — two-sided trust: transparent ratings, and a worker-side report channel. */
export async function GET(req: NextRequest) {
  return guard(async () => {
    const sp = req.nextUrl.searchParams
    const workerId = sp.get('workerId')
    const coopId = sp.get('coopId')

    if (workerId) {
      const data = await getWorkerTrust(workerId)
      if (!data) return notFound('worker not found')
      return ok({ scope: 'WORKER', ...data })
    }
    if (coopId) {
      const data = await getCoopTrust(coopId)
      if (!data) return notFound('coop not found')
      return ok({ scope: 'COOP', ...data })
    }
    return badRequest('workerId or coopId required')
  })
}

export async function POST(req: NextRequest) {
  return guard(async () => {
    // SECURITY FIX: this was unauthenticated and unvalidated, so any caller
    // could file a report against any worker — and `body.category.replace()`
    // threw a TypeError (500) for a non-string category.
    const auth = await requireAnyRole(['CUSTOMER', 'INSTITUTION', 'WORKER', 'COOP_ADMIN', 'PLATFORM_ADMIN'])
    if (!auth.ok) return auth.res

    const parsed = await readJson(req, FileSchema)
    if (!parsed.ok) return parsed.res
    const { workerId, category, detail } = parsed.data

    // A worker may only report their own experience; a customer may only report
    // against a worker who actually served them.
    if (auth.user.role === 'WORKER') {
      if (auth.user.workerId !== workerId) return forbidden('You can only file a report about your own work.')
    } else if (auth.user.role === 'CUSTOMER' || auth.user.role === 'INSTITUTION') {
      const served = await db.booking.findFirst({
        where: { customerId: auth.user.customerId, workerId },
        select: { id: true },
      })
      if (!served) return forbidden('You can only report a worker who served you.')
    }

    const report = await fileTrustReport({
      workerId,
      bookingId: parsed.data.bookingId ?? null,
      category,
      detail,
    })

    const worker = await db.worker.findUnique({ where: { id: workerId }, select: { cooperativeId: true, name: true } })
    if (worker?.cooperativeId) {
      await db.notification.create({
        data: {
          audience: 'COOP',
          audienceId: worker.cooperativeId,
          title: 'Worker report filed',
          body: `${worker.name} reported a ${category.replace(/_/g, ' ').toLowerCase()} issue. Review in the trust register.`,
          type: 'WARNING',
        },
      })
    }
    await recordAudit({
      action: 'TRUST_REPORT_FILED',
      entity: 'TrustReport',
      entityId: report.id,
      detail: `${category.replace(/_/g, ' ').toLowerCase()} reported against worker ${worker?.name ?? workerId}`,
    })
    return ok({ report: { id: report.id, category: report.category, status: report.status, createdAt: report.createdAt } }, 201)
  })
}
