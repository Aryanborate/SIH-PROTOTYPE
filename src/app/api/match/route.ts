import { NextRequest, NextResponse } from 'next/server'
import { serverError } from '@/lib/http'
import { matchWorkers } from '@/lib/matching'
import type { Urgency } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { categoryKey, area, urgency, scheduledAt, customerId } = await req.json()
    // Name the offending field. A single "categoryKey and area required" reads
    // as a server fault when it is really a missing input, and the booking flow
    // cannot recover from it.
    if (!categoryKey) return NextResponse.json({ ok: false, error: 'categoryKey is required' }, { status: 400 })
    if (!area) return NextResponse.json({ ok: false, error: 'area is required' }, { status: 400 })
    const result = await matchWorkers({
      categoryKey,
      area,
      urgency: (urgency ?? 'NORMAL') as Urgency,
      scheduledAt,
      customerId,
    })
    return NextResponse.json(result)
  } catch (e) {
    return serverError(e)
  }
}
