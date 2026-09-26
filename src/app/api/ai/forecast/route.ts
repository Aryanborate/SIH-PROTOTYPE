import { NextRequest, NextResponse } from 'next/server'
import { buildForecast } from '@/lib/forecast'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const zone = req.nextUrl.searchParams.get('zone') ?? 'pune-z4'
  return NextResponse.json(buildForecast(zone, 7))
}
