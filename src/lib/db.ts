import 'server-only'
import { PrismaClient } from '@prisma/client'

/**
 * Database client that works in BOTH places this app runs:
 *
 *   local dev / self-hosted  ->  DATABASE_URL="file:../db/custom.db"  (plain SQLite)
 *   Vercel (serverless)      ->  DATABASE_URL="libsql://db-x.turso.io"
 *                               + DATABASE_AUTH_TOKEN="..."
 *
 * WHY THE SWITCH IS NECESSARY
 * ----------------------------
 * Vercel's filesystem is read-only apart from /tmp, and it is not shared
 * between serverless instances. A `file:` SQLite database therefore cannot work
 * there: the file is neither writable nor present in the deployment. That is
 * why the app appeared fine locally and 500'd on every API route once deployed
 * — and why simply adding DATABASE_URL to Vercel's env vars is not enough.
 *
 * libSQL (Turso) speaks the SQLite dialect, so the schema and every query stay
 * byte-identical; only the transport changes, via Prisma's driver adapter.
 *
 * The whole surface is chosen by the DATABASE_URL scheme, so nothing in the app
 * has to know which environment it is in.
 */

export class DatabaseConfigurationError extends Error {
  readonly hint: string
  constructor(message: string, hint: string) {
    super(message)
    this.name = 'DatabaseConfigurationError'
    this.hint = hint
  }
}

const HINT_LOCAL = 'Run `npm run setup` to create and seed db/custom.db.'
const HINT_REMOTE =
  'Set DATABASE_URL to a libsql:// URL and DATABASE_AUTH_TOKEN to your Turso token (Vercel → Settings → Environment Variables).'

function isLibsql(url: string): boolean {
  return url.startsWith('libsql://') || url.startsWith('https://') || url.startsWith('wss://')
}

function resolveUrl(): string {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    throw new DatabaseConfigurationError(
      'DATABASE_URL is not set.',
      process.env.VERCEL
        ? HINT_REMOTE
        : `Copy .env.example to .env and set DATABASE_URL. ${HINT_LOCAL}`
    )
  }
  if (url.startsWith('file:') && process.env.VERCEL) {
    // Failing here with an explanation beats a confusing "unable to open
    // database file" from deep inside the driver.
    throw new DatabaseConfigurationError(
      'DATABASE_URL points at a SQLite file, but this deployment has no writable filesystem.',
      HINT_REMOTE
    )
  }
  return url
}

function create(): PrismaClient {
  const url = resolveUrl()

  if (!isLibsql(url)) {
    // Local / self-hosted SQLite — no adapter, identical to before.
    return new PrismaClient({ log: ['error'] })
  }

  // Serverless libSQL. Required lazily so a `file:` setup never has to load it.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaLibSQL } = require('@prisma/adapter-libsql') as typeof import('@prisma/adapter-libsql')
  const token = process.env.DATABASE_AUTH_TOKEN?.trim()
  if (!token) {
    throw new DatabaseConfigurationError(
      'DATABASE_AUTH_TOKEN is not set, so the libSQL database cannot authenticate.',
      HINT_REMOTE
    )
  }
  const adapter = new PrismaLibSQL({ url, authToken: token })
  return new PrismaClient({ adapter, log: ['error'] })
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; prismaError?: unknown }

function resolveClient(): PrismaClient {
  // Reuse the instance across hot reloads in dev; on serverless each cold start
  // builds its own, which is correct — the pool lives in the driver adapter.
  if (globalForPrisma.prisma) return globalForPrisma.prisma
  if (globalForPrisma.prismaError) throw globalForPrisma.prismaError
  try {
    const client = create()
    globalForPrisma.prisma = client
    return client
  } catch (e) {
    // Cache the configuration failure so every request reports the same clear
    // message instead of re-running client construction (and re-importing the
    // adapter) on each call.
    globalForPrisma.prismaError = e
    throw e
  }
}

/**
 * A Proxy defers client construction to first use, so merely importing this
 * module on a misconfigured deployment does not throw at import time — which
 * Next.js would render as an opaque module-scope crash.
 */
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_t, prop) {
    const client = resolveClient()
    const value = client[prop as keyof PrismaClient]
    return typeof value === 'function' ? value.bind(client) : value
  },
})

/** Non-throwing config probe used by /api/health and the startup banner. */
export function databaseStatus(): {
  ok: boolean
  scheme: string
  onServerless: boolean
  error?: string
  hint?: string
} {
  const onServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME)
  const raw = process.env.DATABASE_URL?.trim() ?? ''
  const scheme = raw ? raw.split(':')[0] : '(unset)'
  try {
    resolveClient()
    return { ok: true, scheme, onServerless }
  } catch (e) {
    const err = e as DatabaseConfigurationError
    return { ok: false, scheme, onServerless, error: err.message, hint: err.hint }
  }
}
