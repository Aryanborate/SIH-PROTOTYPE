import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { guard, ok, safeObject } from '@/lib/http'

export const dynamic = 'force-dynamic'

/** Spec §61 — GET /cooperatives and GET /cooperatives/:id */
export async function GET(req: NextRequest) {
  return guard(async () => {
    const talukaId = req.nextUrl.searchParams.get('talukaId') ?? undefined
    const sector = req.nextUrl.searchParams.get('sector') ?? undefined
    const where: Record<string, unknown> = {}
    if (talukaId) where.talukaId = talukaId
    if (sector) where.sector = sector

    const rows = await db.cooperative.findMany({
      where,
      include: { taluka: { include: { district: { include: { federation: { select: { name: true, region: true } } } } } } },
      orderBy: [{ featured: 'desc' }, { workerCount: 'desc' }],
      take: 100,
    })
    return ok({
      total: rows.length,
      cooperatives: rows.map((c) => ({
        id: c.id,
        name: c.name,
        regNo: c.regNo,
        societyType: c.societyType,
        sector: c.sector,
        repName: c.repName,
        workerCount: c.workerCount,
        memberCount: c.memberCount,
        activeToday: c.activeToday,
        jobsToday: c.jobsToday,
        utilizationPct: c.utilizationPct,
        status: c.status,
        verification: c.verification,
        featured: c.featured,
        emergencyPoolSize: c.emergencyPoolSize,
        location: {
          taluka: c.taluka.name,
          district: c.taluka.district.name,
          state: c.taluka.district.federation.region,
        },
        federation: c.taluka.district.federation.name,
      })),
    })
  })
}
