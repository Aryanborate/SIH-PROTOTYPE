import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { guard } from '@/lib/http'

export const dynamic = 'force-dynamic'

/**
 * Wrapped in guard(): this route previously had no try/catch at all, so any
 * Prisma failure escaped as an unhandled 500 with an EMPTY body — which looks
 * like a network error in the browser and hides the real cause entirely.
 */
export async function GET() {
  return guard(async () => {
    const categories = await db.serviceCategory.findMany({ orderBy: { id: 'asc' } })
    return NextResponse.json({ ok: true, categories })
  })
}
