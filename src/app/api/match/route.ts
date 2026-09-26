import { NextRequest, NextResponse } from 'next/server'
import { serverError } from '@/lib/http'
import { matchWorkers } from '@/lib/matching'
import type { Urgency } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const { categoryKey, area, urgency, scheduledAt, customerId } = await req.json()
    if (!categoryKey || !area) {
      return NextResponse.json({ ok: false, error: 'categoryKey and area required' }, { status: 400 })
    }
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
