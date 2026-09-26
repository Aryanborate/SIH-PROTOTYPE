import { NextResponse } from 'next/server'
import { databaseStatus } from '@/lib/db'
import { guard, ok } from '@/lib/http'
import { isGeoApifyConfigured } from '@/lib/geoapify'

export const dynamic = 'force-dynamic'

/**
 * GET /api/health — deployment self-check.
 *
 * Exists because a serverless deploy with no env vars used to fail as an
 * identical, context-free "Something went wrong" on every route. This answers
 * "is this deployment wired up?" in one request, and names the exact variable
 * to set. Safe to leave public: it reports presence, never values.
 */
export async function GET() {
  return guard(async () => {
    const dbStatus = databaseStatus()

    const env = {
      DATABASE_URL: Boolean(process.env.DATABASE_URL?.trim()),
      DATABASE_AUTH_TOKEN: Boolean(process.env.DATABASE_AUTH_TOKEN?.trim()),
      AUTH_SECRET: Boolean(process.env.AUTH_SECRET?.trim()),
    }

    const geo = isGeoApifyConfigured()

    // The database is the only hard dependency: without it nothing works.
    // GeoApify degrades to the built-in grid, so it is never fatal.
    const healthy = dbStatus.ok
    const body = {
      ...(healthy ? ok({}) : {}),
      ok: healthy,
      status: healthy ? ('healthy' as const) : ('misconfigured' as const),
      environment: {
        onServerless: dbStatus.onServerless,
        nodeEnv: process.env.NODE_ENV ?? 'unknown',
        isVercel: Boolean(process.env.VERCEL),
      },
      database: {
        configured: dbStatus.ok,
        scheme: dbStatus.scheme,
        ...(dbStatus.ok ? {} : { error: dbStatus.error, hint: dbStatus.hint }),
      },
      env,
      geoapify: { configured: geo, note: 'Optional — falls back to the built-in Pune grid.' },
      ...(healthy ? {} : { hint: dbStatus.hint }),
    }

    return NextResponse.json(body, { status: healthy ? 200 : 503 })
  })
}
