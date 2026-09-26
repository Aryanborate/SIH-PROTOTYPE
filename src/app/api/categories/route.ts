import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  const categories = await db.serviceCategory.findMany({ orderBy: { id: 'asc' } })
  return NextResponse.json({ ok: true, categories })
}
