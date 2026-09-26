import { guard, ok } from '@/lib/http'
import { resolveDemoIdentity } from '@/lib/identities'
import type { Role } from '@/lib/types'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/identities — read-only roster of the seeded demo personas.
 *
 * The platform console shows every persona side by side. It used to do that by
 * calling `GET /api/session?role=X` once per role, which was wrong twice over:
 * that endpoint now only answers "who am I" (it returns `{ user: null }` when
 * logged out), and signing in is a POST. This lists the personas WITHOUT
 * touching the current session.
 *
 * No secrets are exposed — these are the same mock accounts the login screen
 * already lists, and a caller could resolve each one anyway via POST /api/auth.
 */
const ROLES: Role[] = [
  'CUSTOMER',
  'WORKER',
  'COOP_ADMIN',
  'TALUKA_COORD',
  'DISTRICT_COORD',
  'STATE_ADMIN',
  'NATIONAL_ADMIN',
  'INSTITUTION',
  'PLATFORM_ADMIN',
]

export async function GET() {
  return guard(async () => {
    const identities = (
      await Promise.all(
        ROLES.map(async (role) => {
          const u = await resolveDemoIdentity(role)
          return u ? { role, name: u.name, orgName: u.orgName ?? '—', title: u.title } : null
        })
      )
    ).filter((x): x is { role: Role; name: string; orgName: string; title: string } => x !== null)

    return ok({ identities })
  })
}
