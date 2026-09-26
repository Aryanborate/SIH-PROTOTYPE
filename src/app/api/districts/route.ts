import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, ok, safeObject } from '@/lib/http'

export const dynamic = 'force-dynamic'

/** Spec §61 — GET /districts */
export async function GET(req: NextRequest) {
  return guard(async () => {
    const sp = req.nextUrl.searchParams
    const federationId = sp.get('federationId') ?? undefined
    const rows = await db.district.findMany({
      where: federationId ? { federationId } : {},
      include: { federation: { select: { name: true, region: true } }, talukas: { select: { id: true, name: true, workers: true, availableWorkers: true, emergencyCapacity: true } } },
      orderBy: { workers: 'desc' },
      take: 100,
    })
    return ok({
      total: rows.length,
      districts: rows.map((d) => ({
        id: d.id,
        name: d.name,
        coordinator: d.coordinator,
        zoneCount: d.zoneCount,
        cooperatives: d.cooperatives,
        workers: d.workers,
        activeWorkers: d.activeWorkers,
        jobsToday: d.jobsToday,
        utilizationPct: d.utilizationPct,
        demand: safeObject<Record<string, string>>(d.demandJson),
        recommendations: safeObject<{ recommendations?: string[] }>(d.recommendationsJson).recommendations ?? [],
        federation: d.federation.name,
        state: d.federation.region,
        mapPos: safeObject<{ x: number; y: number }>(d.mapPos),
        talukas: d.talukas,
      })),
    })
  })
}
