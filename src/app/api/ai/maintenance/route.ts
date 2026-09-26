import { NextResponse } from 'next/server'
import { getMaintenanceProfiles } from '@/lib/maintenance'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(getMaintenanceProfiles())
}
