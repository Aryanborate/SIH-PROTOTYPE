
// Shared HTTP plumbing for every GigSetu route handler (spec §47):
//  - uniform, non-leaking error responses
//  - a `safeJson` parser so one malformed DB column can never 500 a dashboard
//  - session + role guards for mutations
//  - CSRF defence via Sec-Fetch-Site / Origin on state-changing verbs
//  - small in-memory rate limiting for the expensive AI/geo relays

import { NextResponse } from 'next/server'
import { ZodError, type ZodType } from 'zod'
import { getSession, roleAtLeast, type SessionUser } from './session'
import { DatabaseConfigurationError } from './db'
import type { Role } from './types'
export { safeJson, safeArray, safeObject, clampNumber, safeDate, safeIso, safeStr } from './safe'
import { safeStr } from './safe'

/** Never leak Prisma/SQLite internals to the browser. */
const SAFE_ERROR = 'Something went wrong handling that request.'

/**
 * A misconfigured database is an operator problem, not a client problem, so it
 * gets a 503 plus the exact remedy. Without this, every route returned an
 * opaque "Something went wrong" (or, worse, leaked the raw Prisma message) and
 * a Vercel deploy with no env vars looked identical to an application bug.
 */
function serviceUnavailable(err: DatabaseConfigurationError) {
  return NextResponse.json(
    {
      ok: false,
      error: err.message,
      hint: err.hint,
      code: 'DATABASE_NOT_CONFIGURED',
    },
    { status: 503 }
  )
}

/** Prisma throws a plain Error for a missing/blank datasource URL. Detect it. */
function looksLikeMissingDatasource(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? '')
  return /You must provide a nonempty URL|Environment variable not found: DATABASE_URL|datasource.*db.*url/i.test(msg)
}

export function ok<T extends object>(data: T, status = 200) {
  return NextResponse.json({ ok: true, ...data }, { status })
}

export function badRequest(error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error, ...extra }, { status: 400 })
}

/** Business-rule / state conflict — 409, not 400. */
export function conflict(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 409 })
}

export function unauthorized(error = 'Sign in to continue.') {
  return NextResponse.json({ ok: false, error }, { status: 401 })
}

export function forbidden(error = 'Your role is not permitted to do that.') {
  return NextResponse.json({ ok: false, error }, { status: 403 })
}

export function notFound(error = 'Not found.') {
  return NextResponse.json({ ok: false, error }, { status: 404 })
}

export function serverError(e?: unknown) {
  if (e instanceof ZodError) {
    return badRequest('Some fields need attention.', { fields: e.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) })
  }
  if (e instanceof DatabaseConfigurationError) return serviceUnavailable(e)
  if (looksLikeMissingDatasource(e)) {
    return serviceUnavailable(
      new DatabaseConfigurationError(
        'The database is not configured on this deployment.',
        process.env.VERCEL
          ? 'Set DATABASE_URL to a libsql:// URL and DATABASE_AUTH_TOKEN to your Turso token in Vercel → Settings → Environment Variables.'
          : 'Copy .env.example to .env and set DATABASE_URL, then run `npm run setup`.'
      )
    )
  }
  // Business-rule failures carry their own HTTP status (409/400/404) instead of
  // collapsing into a blanket 500.
  if (e && typeof e === 'object' && typeof (e as { status?: unknown }).status === 'number') {
    const status = (e as { status: number }).status
    const message = typeof (e as { message?: unknown }).message === 'string' ? (e as Error).message : SAFE_ERROR
    if (status === 400) return badRequest(message)
    if (status === 404) return notFound(message)
    if (status === 409) return conflict(message)
    if (status === 403) return forbidden(message)
  }
  if (process.env.NODE_ENV !== 'production') {
    console.error('[gigsetu]', e)
  }
  return NextResponse.json({ ok: false, error: SAFE_ERROR }, { status: 500 })
}

/** Validate `req.json()` against a zod schema; returns 400 with field detail on failure. */
export async function readJson<T>(req: Request, schema: ZodType<T>): Promise<{ ok: true; data: T } | { ok: false; res: NextResponse }> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return { ok: false, res: badRequest('Expected a JSON body.') }
  }
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, res: serverError(parsed.error) }
  }
  return { ok: true, data: parsed.data }
}

/** Wrap a handler so nothing escapes as an unhandled 500. */
export async function guard(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn()
  } catch (e) {
    return serverError(e)
  }
}

// Pure helpers live in ./safe so engine code stays runnable outside Next.

// ---------- session / role guards ----------

/** Session required. */
export async function requireSession(): Promise<{ ok: true; user: SessionUser } | { ok: false; res: NextResponse }> {
  const user = await getSession()
  if (!user) return { ok: false, res: unauthorized() }
  return { ok: true, user }
}

/** Session required AND role at or above `min` (spec §47 role hierarchy). */
export async function requireRole(min: Role): Promise<{ ok: true; user: SessionUser } | { ok: false; res: NextResponse }> {
  const s = await requireSession()
  if (!s.ok) return s
  if (!roleAtLeast(s.user.role, min)) return { ok: false, res: forbidden(`Requires ${min} or above. You are signed in as ${s.user.role}.`) }
  return s
}

/** Session required AND one of the exact roles. */
export async function requireAnyRole(roles: Role[]): Promise<{ ok: true; user: SessionUser } | { ok: false; res: NextResponse }> {
  const s = await requireSession()
  if (!s.ok) return s
  if (!roles.includes(s.user.role)) return { ok: false, res: forbidden(`Requires one of: ${roles.join(', ')}.`) }
  return s
}

// ---------- CSRF ----------

/**
 * Same-origin defence for state-changing verbs. A cross-site form POST / fetch
 * cannot set Sec-Fetch-Site: same-origin, and browsers always send Origin on
 * cross-origin mutations, so a mismatch is a reliable reject signal.
 */
const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export function csrfGuard(req: Request): NextResponse | null {
  if (!MUTATING.has(req.method.toUpperCase())) return null
  const site = req.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin' && site !== 'same-site' && site !== 'none') {
    return forbidden('Cross-site request rejected.')
  }
  const origin = req.headers.get('origin')
  if (origin) {
    const host = req.headers.get('host')
    if (host) {
      let originHost = ''
      try {
        originHost = new URL(origin).host
      } catch {
        return forbidden('Cross-site request rejected.')
      }
      if (originHost !== host) return forbidden('Cross-site request rejected.')
    }
  }
  return null
}

/** Combined guard for a mutating route: CSRF + session + minimum role. */
export async function requireMutationFor(req: Request, min: Role): Promise<{ ok: true; user: SessionUser } | { ok: false; res: NextResponse }> {
  const csrf = csrfGuard(req)
  if (csrf) return { ok: false, res: csrf }
  return requireRole(min)
}

// ---------- rate limiting (in-memory; prototype scale) ----------

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

/** Fixed-window limiter. Returns a 429 response when the caller is over budget. */
export function rateLimit(key: string, limit: number, windowMs: number): NextResponse | null {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return null
  }
  b.count += 1
  if (b.count > limit) {
    const retry = Math.ceil((b.resetAt - now) / 1000)
    return NextResponse.json({ ok: false, error: `Too many requests. Try again in ${retry}s.` }, { status: 429, headers: { 'Retry-After': String(retry) } })
  }
  return null
}

/** Stable per-caller bucket key without logging raw IPs. */
export function callerKey(req: Request, scope: string): string {
  const fwd = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = fwd && req.headers.get('x-forwarded-for') ? fwd : 'local'
  return `${scope}:${ip}`
}


