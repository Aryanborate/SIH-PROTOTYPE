import 'server-only'

// GigSetu demo session (spec §47 — role-based access control, protected routes).
//
// The prototype uses MOCK CREDENTIALS BY DESIGN (spec §5 / §47): picking a role
// on the login screen exchanges it for a signed, httpOnly, SameSite=Lax cookie.
// That is a real server-side trust boundary — a caller can no longer just append
// `?role=PLATFORM_ADMIN` to a URL and become an administrator, because every
// mutating route now resolves the actor from THIS cookie, never from the body.
//
// The signature is HMAC-SHA256 over the payload using AUTH_SECRET. It is
// intentionally dependency-free so the prototype still runs with zero infra.

import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Role } from './types'

export const SESSION_COOKIE = 'gigsetu_session'

/**
 * Presence-only check for the Edge proxy, which cannot verify the HMAC
 * (`node:crypto` is unavailable there). The authoritative signature check is
 * `decodeSession()`, which every route handler runs on the Node runtime.
 */
export function hasSessionCookie(token: string | undefined | null): boolean {
  return typeof token === 'string' && token.length > 20 && token.includes('.')
}
const MAX_AGE_SECONDS = 60 * 60 * 12 // 12h — a full demo day

/** Roles permitted to sign in (spec §5 — nine roles). */
export const ALL_ROLES: Role[] = [
  'CUSTOMER', 'WORKER', 'COOP_ADMIN', 'TALUKA_COORD', 'DISTRICT_COORD',
  'STATE_ADMIN', 'NATIONAL_ADMIN', 'INSTITUTION', 'PLATFORM_ADMIN',
]

export function isRole(v: unknown): v is Role {
  return typeof v === 'string' && (ALL_ROLES as string[]).includes(v)
}

export interface SessionUser {
  id: string
  name: string
  role: Role
  title: string
  orgId?: string
  orgName: string
  customerId?: string
  workerId?: string
  talukaId?: string
  districtId?: string
  federationId?: string
  cooperativeId?: string
}

function secret(): string {
  const s = process.env.AUTH_SECRET
  if (!s || s.length < 16) {
    // Fail loudly in production, degrade to a fixed dev secret in the demo so
    // the prototype is still runnable when .env is missing.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_SECRET is not set. Copy .env.example to .env and set a random value.')
    }
    return 'gigsetu-insecure-development-secret'
  }
  return s
}

function b64url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url')
}
function unb64url(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8')
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function encodeSession(user: SessionUser, issuedAt = Date.now()): string {
  const body = b64url(JSON.stringify({ u: user, i: issuedAt }))
  return `${body}.${sign(body)}`
}

export function decodeSession(token: string | undefined | null): { user: SessionUser; issuedAt: number } | null {
  if (!token) return null
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const body = token.slice(0, dot)
  const mac = token.slice(dot + 1)
  let expected: string
  try {
    expected = sign(body)
  } catch {
    return null
  }
  const a = Buffer.from(mac)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const parsed = JSON.parse(unb64url(body)) as { u: SessionUser; i: number }
    if (!parsed?.u || !isRole(parsed.u.role)) return null
    return { user: parsed.u, issuedAt: parsed.i }
  } catch {
    return null
  }
}

/** Read + verify the current session. Returns null when signed out / tampered / expired. */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies()
  const decoded = decodeSession(store.get(SESSION_COOKIE)?.value)
  if (!decoded) return null
  if (Date.now() - decoded.issuedAt > MAX_AGE_SECONDS * 1000) return null
  return decoded.user
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  }
}

/**
 * Role hierarchy for cooperative governance. A higher rank satisfies a lower
 * requirement, so a State Federation Admin may act on district-level records
 * (spec §75 — federation supervises the whole network).
 */
const RANK: Record<Role, number> = {
  CUSTOMER: 0,
  INSTITUTION: 0,
  WORKER: 1,
  COOP_ADMIN: 2,
  TALUKA_COORD: 3,
  DISTRICT_COORD: 4,
  STATE_ADMIN: 5,
  NATIONAL_ADMIN: 6,
  PLATFORM_ADMIN: 7,
}

export function roleAtLeast(role: Role, min: Role): boolean {
  return RANK[role] >= RANK[min]
}

/** True when the session may act on the given cooperative (own coop or any admin above it). */
export function canActOnCoop(user: SessionUser, coopId: string | null | undefined): boolean {
  if (user.role === 'PLATFORM_ADMIN' || roleAtLeast(user.role, 'DISTRICT_COORD')) return true
  return !!coopId && user.cooperativeId === coopId
}
