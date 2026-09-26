import 'server-only'

import { db } from '@/lib/db'
import { getSession, type SessionUser } from '@/lib/session'

/**
 * Spec §57 — Audit & Transparency: WHO did WHAT to WHICH entity and WHEN.
 *
 * SECURITY (fixed): `actor` and `actorRole` are resolved from the signed
 * httpOnly session cookie, NEVER from a request body. The previous version
 * accepted `body.updatedBy` / `body.by`, which let any caller forge a
 * plausible-looking governance record. `detail` is still caller-supplied
 * because it is descriptive text, and it is length-capped.
 *
 * Audit writes are best-effort and must never break the primary flow.
 */
export type AuditAction =
  | 'WORKER_STATUS_CHANGE' | 'WORKER_TRAINING_PROGRESS' | 'WORKER_ENROLLED'
  | 'EXCHANGE_CREATED' | 'EXCHANGE_APPROVED' | 'EXCHANGE_REJECTED'
  | 'PRICING_POLICY_UPDATED' | 'ECONOMICS_UPDATED' | 'FEE_CONFIG_UPDATED' | 'AI_WEIGHTS_UPDATED'
  | 'COMPLAINT_FILED' | 'COMPLAINT_ACK' | 'COMPLAINT_ESCALATED' | 'COMPLAINT_RESOLVED' | 'COMPLAINT_REOPENED'
  | 'TRUST_REPORT_FILED'
  | 'BOOKING_CREATED' | 'BOOKING_PAID' | 'BOOKING_RATED' | 'BOOKING_CANCELLED'
  | 'BOOKING_QUOTE_ACCEPTED' | 'BOOKING_COUNTERED' | 'BOOKING_OFFER_ACCEPTED' | 'BOOKING_OFFERS_REJECTED'
  | 'BOOKING_ADVANCED' | 'BOOKING_EVIDENCE'
  | 'INSTITUTION_REQUEST_CREATED' | 'PROCUREMENT_RAISED' | 'MAINTENANCE_SCHEDULED'
  | 'SESSION_LOGIN' | 'SESSION_LOGOUT' | 'DEMO_RESET'

export interface AuditInput {
  action: AuditAction | string
  entity: string
  entityId?: string
  detail?: string
  /** System-originated events (demo engine, schedulers) pass an explicit identity. */
  systemActor?: { actor: string; actorRole: string }
}

export async function recordAudit(e: AuditInput): Promise<void> {
  try {
    let actor = 'System'
    let actorRole = 'SYSTEM'
    if (e.systemActor) {
      actor = e.systemActor.actor
      actorRole = e.systemActor.actorRole
    } else {
      const user = await getSession()
      if (user) {
        actor = user.name
        actorRole = user.role
      }
    }
    await db.auditLog.create({
      data: {
        actor: actor.slice(0, 80),
        actorRole: actorRole.slice(0, 40),
        action: String(e.action).slice(0, 60),
        entity: String(e.entity).slice(0, 60),
        entityId: (e.entityId ?? '-').slice(0, 80),
        detail: (e.detail ?? '').slice(0, 500),
      },
    })
  } catch {
    // audit is best-effort by design
  }
}

/** Build the explicit system-actor shape the demo engine uses. */
export function systemActor(actor: string, actorRole: string) {
  return { systemActor: { actor, actorRole } }
}

/** Convenience: describe a session user for log lines. */
export function describeUser(u: SessionUser): string {
  return `${u.name} (${u.role})`
}
