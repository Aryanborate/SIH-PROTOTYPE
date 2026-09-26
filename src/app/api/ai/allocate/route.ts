import { NextRequest, NextResponse } from 'next/server'
import { allocateWorker } from '@/lib/matching'
import type { Urgency } from '@/lib/types'

export const dynamic = 'force-dynamic'

// Workforce Allocation Engine — input: service request + location + skill + urgency + time.
// Output: ONE recommended worker with full explainability.
export async function POST(req: NextRequest) {
  try {
    const { categoryKey, area, urgency, scheduledAt, customerId } = await req.json()
    if (!categoryKey || !area) {
      return NextResponse.json({ ok: false, error: 'categoryKey and area required' }, { status: 400 })
    }
    const result = await allocateWorker({
      categoryKey,
      area,
      urgency: (urgency ?? 'NORMAL') as Urgency,
      scheduledAt,
      customerId,
    })
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
