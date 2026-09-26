import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, ok, safeArray, safeObject } from '@/lib/http'

export const dynamic = 'force-dynamic'

/** Spec §61 — GET /talukas */
export async function GET(req: NextRequest) {
  return guard(async () => {
    const sp = req.nextUrl.searchParams
    const districtId = sp.get('districtId') ?? undefined
    const rows = await db.taluka.findMany({
      where: districtId ? { districtId } : {},
      include: { district: { include: { federation: { select: { name: true, region: true } } } } },
      orderBy: { workers: 'desc' },
      take: 200,
    })
    return ok({
      total: rows.length,
      talukas: rows.map((t) => ({
        id: t.id,
        name: t.name,
        coordinator: t.coordinator,
        cooperatives: t.cooperatives,
        workers: t.workers,
        availableWorkers: t.availableWorkers,
        emergencyCapacity: t.emergencyCapacity,
        jobsToday: t.jobsToday,
        utilizationPct: t.utilizationPct,
        demand: safeObject<Record<string, string>>(t.demandJson),
        zones: safeArray<{ zone: string; demand: Record<string, string>; note?: string }>(t.zonesJson),
        skillGap: safeArray<{ skill: string; have: number; need: number }>(t.skillGapJson),
        recommendation: t.recommendation,
        district: t.district.name,
        state: t.district.federation.region,
      })),
    })
  })
}
