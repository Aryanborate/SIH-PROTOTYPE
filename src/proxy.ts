import { NextResponse, type NextRequest } from 'next/server'

/**
 * Spec §47 — protected routes (Next 16 `proxy` convention, formerly `middleware`).
 *
 * LAYER 1 of two, running on the Edge runtime:
 *  - rejects cross-site mutations before they reach a handler
 *  - requires the presence of a session cookie on every mutating verb
 *
 * LAYER 2 is `requireMutationFor()` inside each route (Node runtime), which
 * verifies the HMAC signature, resolves the actor, and enforces role +
 * ownership. Signature verification deliberately does NOT happen here: it needs
 * `node:crypto`, which the Edge runtime does not provide, and an unverified
 * cookie is useless anyway because every handler re-checks it authoritatively.
 */
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** Routes that must work without a session (sign-in itself + public demo reads). */
const PUBLIC = new Set([
  '/api/auth',
  '/api/session',
  '/api/categories',
  '/api/hierarchy',
  '/api/geo',
  '/api/search',
  '/api/ai/forecast',
  '/api/ai/skill-gap',
  '/api/ai/maintenance',
  '/api/procurement',
])

function reject(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status })
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (!pathname.startsWith('/api/')) return NextResponse.next()
  if (PUBLIC.has(pathname)) return NextResponse.next()

  if (MUTATING.has(req.method.toUpperCase())) {
    const site = req.headers.get('sec-fetch-site')
    if (site && site !== 'same-origin' && site !== 'same-site' && site !== 'none') {
      return reject('Cross-site request rejected.', 403)
    }
    const origin = req.headers.get('origin')
    const host = req.headers.get('host')
    if (origin && host) {
      let originHost = ''
      try {
        originHost = new URL(origin).host
      } catch {
        return reject('Cross-site request rejected.', 403)
      }
      if (originHost !== host) return reject('Cross-site request rejected.', 403)
    }
    if (!req.cookies.get('gigsetu_session')?.value) {
      return reject('Sign in to continue.', 401)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}
