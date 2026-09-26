import { NextRequest, NextResponse } from 'next/server'
import { serverError } from '@/lib/http'
import { buildSkillGap } from '@/lib/skill-gap'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const district = req.nextUrl.searchParams.get('district') ?? 'Pune'
  try {
    return NextResponse.json(await buildSkillGap(district))
  } catch (e) {
    return serverError(e)
  }
}
