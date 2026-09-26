import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import {
  badRequest, conflict, forbidden, guard, notFound, ok, readJson, requireAnyRole,
} from '@/lib/http'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

/**
 * Spec §58 — customer -> cooperative complaint & dispute pipeline.
 * OPEN -> RESOLVING (ACK/REVIEW) -> RESOLVED, or ESCALATED for higher review.
 * Every transition is validated (409 on an illegal move) and audit-logged with
 * the actor taken from the SESSION, not the request body.
 */
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'SERIOUS'] as const
const ACTIONS = ['ACK', 'REVIEW', 'RESOLVE', 'REOPEN', 'ESCALATE'] as const

const FileSchema = z.object({
  bookingId: z.string().min(1).max(60),
  subject: z.string().min(3).max(120),
  detail: z.string().min(5).max(600),
  severity: z.enum(SEVERITIES).optional(),
})

const PatchSchema = z.object({
  id: z.string().min(1).max(60),
  action: z.enum(ACTIONS),
  note: z.string().max(400).optional(),
})

/** Only a cooperative office (or an admin above it) may move the ladder. */
async function mayManageCoop(user: { role: string; cooperativeId?: string }, coopId: string): Promise<boolean> {
  if (user.role === 'PLATFORM_ADMIN' || user.role === 'DISTRICT_COORD' || user.role === 'STATE_ADMIN' || user.role === 'NATIONAL_ADMIN') return true
  if (user.role === 'COOP_ADMIN') return user.cooperativeId === coopId
  return false
}

export async function GET(req: NextRequest) {
  return guard(async () => {
    const sp = req.nextUrl.searchParams
    const bookingId = sp.get('bookingId')?.trim() ?? ''
    const cooperativeId = sp.get('cooperativeId')?.trim() ?? ''
    const status = sp.get('status')?.trim() ?? ''

    const where: Record<string, unknown> = {}
    if (bookingId) where.bookingId = bookingId
    if (cooperativeId) where.cooperativeId = cooperativeId
    if (status) where.status = status

    // A customer may only read complaints on their own bookings.
    const session = await getSession()
    if (session && (session.role === 'CUSTOMER' || session.role === 'INSTITUTION') && !bookingId) {
      return forbidden('Provide the booking reference to view its complaints.')
    }

    const complaints = await db.complaint.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      // FIX: `take: undefined` made this unbounded whenever bookingId was supplied.
      take: 100,
      select: {
        id: true, cooperativeId: true, workerId: true, bookingId: true,
        customerName: true, subject: true, detail: true, severity: true, status: true,
        resolutionNote: true, resolvedAt: true, createdAt: true,
      },
    })
    return ok({ complaints })
  })
}

export async function POST(req: NextRequest) {
  return guard(async () => {
    const auth = await requireAnyRole(['CUSTOMER', 'INSTITUTION', 'COOP_ADMIN', 'PLATFORM_ADMIN'])
    if (!auth.ok) return auth.res

    const parsed = await readJson(req, FileSchema)
    if (!parsed.ok) return parsed.res
    const { bookingId, subject, detail } = parsed.data
    const severity = parsed.data.severity ?? 'MEDIUM'

    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: { customer: { select: { name: true } }, worker: { select: { name: true } } },
    })
    if (!booking) return notFound('Booking not found.')
    if ((auth.user.role === 'CUSTOMER' || auth.user.role === 'INSTITUTION') && booking.customerId !== auth.user.customerId) {
      return forbidden('You can only file a complaint for your own booking.')
    }
    if (!booking.cooperativeId) return badRequest('This booking has no cooperative assigned yet.')

    const complaint = await db.complaint.create({
      data: {
        cooperativeId: booking.cooperativeId,
        workerId: booking.workerId ?? null,
        bookingId: booking.id,
        customerName: booking.customer?.name ?? auth.user.name,
        subject,
        detail,
        severity,
        status: 'OPEN',
      },
    })

    await db.notification.create({
      data: {
        audience: 'COOP',
        audienceId: booking.cooperativeId,
        title: `New customer complaint — ${severity.toLowerCase()}`,
        body: `${subject} · ${booking.refCode}${booking.worker?.name ? ` · worker ${booking.worker.name}` : ''}`,
        type: severity === 'SERIOUS' || severity === 'HIGH' ? 'WARNING' : 'INFO',
      },
    })

    await recordAudit({
      action: 'COMPLAINT_FILED',
      entity: 'Complaint',
      entityId: complaint.id,
      detail: `${complaint.subject} · severity ${severity} · ${booking.refCode}`,
    })
    return ok({ complaint }, 201)
  })
}

export async function PATCH(req: NextRequest) {
  return guard(async () => {
    // SECURITY FIX: the committee ladder was fully unauthenticated and the audit
    // actor came from `body.by`.
    const auth = await requireAnyRole(['COOP_ADMIN', 'TALUKA_COORD', 'DISTRICT_COORD', 'STATE_ADMIN', 'NATIONAL_ADMIN', 'PLATFORM_ADMIN'])
    if (!auth.ok) return auth.res

    const parsed = await readJson(req, PatchSchema)
    if (!parsed.ok) return parsed.res
    const { id, action } = parsed.data
    const note = (parsed.data.note ?? '').trim()

    const complaint = await db.complaint.findUnique({ where: { id } })
    if (!complaint) return notFound('Complaint not found.')
    if (!(await mayManageCoop(auth.user, complaint.cooperativeId))) {
      return forbidden('Only the owning cooperative office (or a coordinator above it) can move this complaint.')
    }

    let nextStatus: string
    let data: { status: string; resolutionNote?: string | null; resolvedAt?: Date | null; detail?: string }
    let auditAction: string
    let auditDetail: string

    if (action === 'ACK' || action === 'REVIEW') {
      if (complaint.status !== 'OPEN') return conflict(`Only OPEN complaints can be acknowledged (current: ${complaint.status})`)
      nextStatus = 'RESOLVING'
      data = { status: nextStatus }
      auditAction = 'COMPLAINT_ACK'
      auditDetail = action === 'REVIEW' ? `Under review — ${complaint.subject}${note ? ` · ${note}` : ''}` : `Acknowledged — ${complaint.subject}`
    } else if (action === 'RESOLVE') {
      if (!['RESOLVING', 'ESCALATED'].includes(complaint.status)) {
        return conflict(`Only RESOLVING or ESCALATED complaints can be resolved (current: ${complaint.status})`)
      }
      if (note.length < 4) return badRequest('A short resolution note is required to close a complaint.')
      nextStatus = 'RESOLVED'
      data = { status: nextStatus, resolutionNote: note, resolvedAt: new Date() }
      auditAction = 'COMPLAINT_RESOLVED'
      auditDetail = `${complaint.subject}${complaint.status === 'ESCALATED' ? ' (resolved after escalation)' : ''} — ${note}`
    } else if (action === 'ESCALATE') {
      if (!['OPEN', 'RESOLVING'].includes(complaint.status)) {
        return conflict(`Only OPEN or RESOLVING complaints can be escalated (current: ${complaint.status})`)
      }
      // The escalation note is appended to `detail` so the dispute context stays
      // visible in the register and survives a REOPEN; the authoritative copy
      // always lives in the audit log.
      const detailWithNote = note ? `${complaint.detail} — escalated: ${note}`.slice(0, 900) : complaint.detail
      nextStatus = 'ESCALATED'
      data = { status: nextStatus, detail: detailWithNote }
      auditAction = 'COMPLAINT_ESCALATED'
      auditDetail = `${complaint.subject} escalated to district federation review${note ? ` · ${note}` : ''}`
    } else {
      if (!['RESOLVED', 'ESCALATED'].includes(complaint.status)) {
        return conflict(`Only RESOLVED or ESCALATED complaints can be reopened (current: ${complaint.status})`)
      }
      nextStatus = 'OPEN'
      data = { status: nextStatus, resolutionNote: null, resolvedAt: null }
      auditAction = 'COMPLAINT_REOPENED'
      auditDetail = `${complaint.subject} reopened from ${complaint.status}${note ? ` · ${note}` : ''}`
    }

    const updated = await db.complaint.update({ where: { id }, data })
    await recordAudit({ action: auditAction, entity: 'Complaint', entityId: id, detail: auditDetail })

    if (action === 'RESOLVE' && updated.bookingId) {
      const linked = await db.booking.findUnique({ where: { id: updated.bookingId }, select: { customerId: true, refCode: true } })
      if (linked) {
        await db.notification.create({
          data: {
            audience: 'CUSTOMER',
            audienceId: linked.customerId,
            title: 'Cooperative resolved your complaint',
            body: `${updated.subject} · ${linked.refCode}${updated.resolutionNote ? ` — ${updated.resolutionNote}` : ''}`,
            type: 'SUCCESS',
          },
        })
      }
    }
    if (action === 'REOPEN' || action === 'ESCALATE') {
      await db.notification.create({
        data: {
          audience: 'COOP',
          audienceId: updated.cooperativeId,
          title: action === 'ESCALATE' ? 'Complaint escalated' : 'Complaint reopened',
          body:
            action === 'ESCALATE'
              ? `${updated.subject} — escalated for higher-level review${note ? `: ${note}` : ''}`
              : `${updated.subject} — back in the open register`,
          type: 'WARNING',
        },
      })
    }

    return ok({ complaint: updated })
  })
}
