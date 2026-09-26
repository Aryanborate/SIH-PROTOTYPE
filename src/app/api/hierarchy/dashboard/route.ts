import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * Unified hierarchy dashboards: level = state | district | taluka | national | government
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const level = sp.get('level') ?? 'state'
  const id = sp.get('id')

  try {
    if (level === 'state') {
      const f = id ? await db.federation.findUnique({ where: { id } }) : await db.federation.findFirst({ where: { type: 'STATE' } })
      if (!f) return NextResponse.json({ ok: false, error: 'federation not found' }, { status: 404 })
      const districts = await db.district.findMany({ where: { federationId: f.id }, orderBy: { name: 'asc' } })
      const categoryDemand: Record<string, number> = {}
      districts.forEach((d) => {
        const dem = JSON.parse(d.demandJson || '{}') as Record<string, string>
        Object.entries(dem).forEach(([k, v]) => {
          categoryDemand[k] = (categoryDemand[k] ?? 0) + (v === 'HIGH' ? 3 : v === 'MEDIUM' ? 2 : 1)
        })
      })
      return NextResponse.json({
        ok: true,
        federation: { ...f, demandJson: JSON.parse(f.demandJson || '{}'), skillGapJson: JSON.parse(f.skillGapJson || '[]') },
        districts: districts.map((d) => ({
          id: d.id, name: d.name, cooperatives: d.cooperatives, workers: d.workers, activeWorkers: d.activeWorkers,
          jobsToday: d.jobsToday, utilizationPct: d.utilizationPct, demand: JSON.parse(d.demandJson || '{}'),
          mapPos: JSON.parse(d.mapPos || '{"x":50,"y":50}'), recommendations: JSON.parse(d.recommendationsJson || '[]'),
        })),
        categoryDemand,
      })
    }

    if (level === 'district') {
      const d = id ? await db.district.findUnique({ where: { id } }) : await db.district.findFirst({ where: { name: 'Pune' } })
      if (!d) return NextResponse.json({ ok: false, error: 'district not found' }, { status: 404 })
      const talukas = await db.taluka.findMany({ where: { districtId: d.id }, include: { cooperativesRel: true } })
      const comparison = JSON.parse(d.comparisonJson || '[]') as Array<{ coop: string; skill: string; available: number; expectedJobs: number }>
      // AI detects cross-cooperative capacity transfers
      const opportunities = comparison
        .map((c) => {
          const diff = c.available - c.expectedJobs
          return { ...c, gap: diff, kind: diff >= 5 ? 'SURPLUS' : diff <= -5 ? 'SHORTAGE' : 'BALANCED' }
        })
        .filter((c) => c.kind !== 'BALANCED')
      return NextResponse.json({
        ok: true,
        district: { ...d, demandJson: JSON.parse(d.demandJson || '{}'), recommendationsJson: JSON.parse(d.recommendationsJson || '[]'), mapPos: JSON.parse(d.mapPos || '{}') },
        talukas: talukas.map((t) => ({
          id: t.id, name: t.name, coordinator: t.coordinator, workers: t.workers, availableWorkers: t.availableWorkers,
          emergencyCapacity: t.emergencyCapacity, jobsToday: t.jobsToday, utilizationPct: t.utilizationPct,
          demand: JSON.parse(t.demandJson || '{}'), skillGap: JSON.parse(t.skillGapJson || '[]'), recommendation: t.recommendation,
          cooperatives: t.cooperativesRel.map((c) => ({ id: c.id, name: c.name, sector: c.sector, workerCount: c.workerCount, jobsToday: c.jobsToday, utilizationPct: c.utilizationPct })),
        })),
        comparison,
        opportunities,
        recommendations: JSON.parse(d.recommendationsJson || '[]'),
      })
    }

    if (level === 'taluka') {
      const t = id ? await db.taluka.findUnique({ where: { id } }) : await db.taluka.findFirst({ where: { name: 'Haveli' } })
      if (!t) return NextResponse.json({ ok: false, error: 'taluka not found' }, { status: 404 })
      const cooperatives = await db.cooperative.findMany({ where: { talukaId: t.id } })
      return NextResponse.json({
        ok: true,
        taluka: { ...t, demandJson: JSON.parse(t.demandJson || '{}'), zonesJson: JSON.parse(t.zonesJson || '[]'), skillGapJson: JSON.parse(t.skillGapJson || '[]') },
        cooperatives: cooperatives.map((c) => ({ id: c.id, name: c.name, sector: c.sector, workerCount: c.workerCount, activeToday: c.activeToday, jobsToday: c.jobsToday, utilizationPct: c.utilizationPct, emergencyPoolSize: c.emergencyPoolSize })),
      })
    }

    if (level === 'national') {
      const f = await db.federation.findFirst({ where: { type: 'NATIONAL' } })
      if (!f) return NextResponse.json({ ok: false, error: 'national federation not found' }, { status: 404 })
      const national = f.nationalJson ? JSON.parse(f.nationalJson) : {}
      const stateFed = await db.federation.findFirst({ where: { type: 'STATE' } })
      return NextResponse.json({
        ok: true,
        national: { ...f, nationalJson: undefined, national, demandJson: JSON.parse(f.demandJson || '{}'), skillGapJson: JSON.parse(f.skillGapJson || '[]') },
        stateFed: stateFed ? { id: stateFed.id, name: stateFed.name, region: stateFed.region, workers: stateFed.workers } : null,
      })
    }

    if (level === 'government') {
      const [integrations, featured] = await Promise.all([
        db.integrationRegistry.findMany({ orderBy: { name: 'asc' } }),
        db.govRegistration.findFirst({ include: { cooperative: true } }),
      ])
      const levels = await db.hierarchyLevelConfig.findMany({ orderBy: { orderIndex: 'asc' } })
      return NextResponse.json({ ok: true, integrations, registration: featured, levels })
    }

    return NextResponse.json({ ok: false, error: 'unknown level' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
