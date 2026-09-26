import { NextRequest } from 'next/server'
import { getProcurementDemand } from '@/lib/procurement'
import { guard, ok } from '@/lib/http'

export const dynamic = 'force-dynamic'

/** Spec -37 - collective procurement: aggregated bulk-purchase opportunities. */
export async function GET(req: NextRequest) {
  return guard(async () => {
    // District name is length-capped and passed as a Prisma filter parameter.
    const district = (req.nextUrl.searchParams.get('district') ?? 'Pune').slice(0, 80)
    return ok(await getProcurementDemand(district))
  })
}