import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { badRequest, guard, notFound, ok, readJson } from '@/lib/http'
import { recordAudit } from '@/lib/audit'
import { canSwitchRole, resolveDemoIdentity } from '@/lib/identities'
import { SESSION_COOKIE, encodeSession, getSession, isRole, sessionCookieOptions } from '@/lib/session'
import type { Role } from '@/lib/types'

export const dynamic = 'force-dynamic'

const RoleSchema = z.object({ role: z.string().min(1) })

/**
 * Spec §5 — demo identity role switcher.
 *
 * SECURITY (fixed): this used to be `GET /api/session?role=X`, which handed a
 * fully-formed privileged identity to any unauthenticated caller — a role
 * escalation oracle. It now REQUIRES an existing signed session and may only
 * switch to a role that session is allowed to assume (see canSwitchRole).
 * Real sign-in happens at POST /api/auth/login.
 */
export async function POST(req: Request) {
  return guard(async () => {
    const current = await getSession()
    if (!current) return badRequest('Sign in first via POST /api/auth/login.')

    const parsed = await readJson(req, RoleSchema)
    if (!parsed.ok) return parsed.res
    if (!isRole(parsed.data.role)) return badRequest('Unknown role.')
    const target = parsed.data.role as Role

    if (!canSwitchRole(current.role, current.role, target)) {
      return badRequest(`A ${current.role} session cannot assume the ${target} role.`)
    }

    const user = await resolveDemoIdentity(target)
    if (!user) return notFound(`No demo identity available for ${target}.`)

    const jar = await cookies()
    jar.set(SESSION_COOKIE, encodeSession(user), sessionCookieOptions())
    await recordAudit({ action: 'SESSION_LOGIN', entity: 'Session', entityId: user.id, detail: `Role switched to ${user.role} · ${user.orgName}` })
    return ok({ user })
  })
}

/** Read-only: who am I right now? */
export async function GET() {
  return guard(async () => {
    const user = await getSession()
    if (!user) return ok({ user: null })
    return ok({ user: (await identityStillExists(user)) ? user : null })
  })
}

async function identityStillExists(user: {
  customerId?: string
  workerId?: string
  cooperativeId?: string
  role: string
}): Promise<boolean> {
  if (user.customerId) return !!(await db.customer.findUnique({ where: { id: user.customerId }, select: { id: true } }))
  if (user.workerId) return !!(await db.worker.findUnique({ where: { id: user.workerId }, select: { id: true } }))
  if (user.cooperativeId) return !!(await db.cooperative.findUnique({ where: { id: user.cooperativeId }, select: { id: true } }))
  return true
}
