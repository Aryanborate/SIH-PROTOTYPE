import { NextRequest, NextResponse } from 'next/server'
import { escalateEmergency } from '@/lib/emergency'

export const dynamic = 'force-dynamic'

// Emergency escalation ladder: local cooperative → taluka reserve → district reserve → federation pool.
export async function POST(req: NextRequest) {
  try {
    const { categoryKey, area } = await req.json()
    if (!categoryKey || !area) {
      return NextResponse.json({ ok: false, error: 'categoryKey and area required' }, { status: 400 })
    }
    return NextResponse.json(await escalateEmergency(categoryKey, area))
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
