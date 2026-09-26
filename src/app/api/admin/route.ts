import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAdminOverview } from '@/lib/admin-overview'
import { guard, ok, requireAnyRole } from '@/lib/http'

export const dynamic = 'force-dynamic'

/** Spec §43/#55 — Platform Admin aggregate + the live Impact dashboard (spec §79). */
export async function GET(req: NextRequest) {
  return guard(async () => {
    // FIX: was a fully public platform-wide dump (revenue, counts, integrations).
    const auth = await requireAnyRole(['PLATFORM_ADMIN'])
    if (!auth.ok) return auth.res
    return ok(await getAdminOverview())
  })
}
