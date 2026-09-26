import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { guard, badRequest, notFound, ok, readJson } from '@/lib/http'
import { recordAudit } from '@/lib/audit'
import { resolveDemoIdentity } from '@/lib/identities'
import { SESSION_COOKIE, encodeSession, getSession, isRole, sessionCookieOptions } from '@/lib/session'
import type { Role } from '@/lib/types'

export const dynamic = 'force-dynamic'

const LoginSchema = z.object({ role: z.string().min(1) })

/**
 * Spec §61 — POST /auth/login  ·  spec §5 — mock login accounts.
 *
 * The prototype uses MOCK CREDENTIALS BY DESIGN. Picking a role on the login
 * screen exchanges it for a signed, httpOnly session cookie. That cookie is the
 * real trust boundary: it is what every mutating route authorises against, so a
 * caller can no longer become PLATFORM_ADMIN by editing a query string. The
 * role is validated against the allowlist and resolved from seeded records — it
 * is never trusted as an arbitrary string.
 */
export async function POST(req: Request) {
  return guard(async () => {
    const parsed = await readJson(req, LoginSchema)
    if (!parsed.ok) return parsed.res
    if (!isRole(parsed.data.role)) return badRequest('Unknown role.')
    const role = parsed.data.role as Role

    const user = await resolveDemoIdentity(role)
    if (!user) return notFound(`No demo identity available for ${role}. Run the seed first: npm run db:seed`)

    const jar = await cookies()
    jar.set(SESSION_COOKIE, encodeSession(user), sessionCookieOptions())
    await recordAudit({ action: 'SESSION_LOGIN', entity: 'Session', entityId: user.id, detail: `Signed in as ${user.role} · ${user.orgName}` })
    return ok({ user })
  })
}

export async function DELETE() {
  return guard(async () => {
    const jar = await cookies()
    jar.delete(SESSION_COOKIE)
    await recordAudit({ action: 'SESSION_LOGOUT', entity: 'Session' })
    return ok({ signedOut: true })
  })
}

/** Current session (or null) — lets the client rehydrate after a reload. */
export async function GET() {
  return guard(async () => ok({ user: await getSession() }))
}

/** Cheap liveness probe. */
export async function HEAD() {
  const user = await getSession()
  return new NextResponse(null, { status: user ? 204 : 401 })
}
