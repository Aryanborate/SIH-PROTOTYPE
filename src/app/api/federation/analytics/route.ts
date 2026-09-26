import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { buildForecast, FORECAST_ZONES } from '@/lib/forecast'
import { buildSkillGap } from '@/lib/skill-gap'
import { guard, notFound, ok, requireAnyRole, safeObject } from '@/lib/http'

export const dynamic = 'force-dynamic'

/**
 * Spec §61 — GET /federation/analytics
 * Spec §25/#26/#55 — the roll-up every federation-level dashboard needs:
 * district capacity, category demand, utilisation, emergency capacity, skill
 * gaps, welfare coverage and institutional contracts.
 */
export async function GET(req: NextRequest) {
  return guard(async () => {
    const auth = await requireAnyRole(['STATE_ADMIN', 'NATIONAL_ADMIN', 'DISTRICT_COORD', 'PLATFORM_ADMIN'])
    if (!auth.ok) return auth.res
    const type = (req.nextUrl.searchParams.get('type') ?? 'STATE').toUpperCase()

    const federation = await db.federation.findFirst({ where: type === 'NATIONAL' ? { type: 'NATIONAL' } : { type: 'STATE' } })
    if (!federation) return notFound('No federation in the seeded dataset.')

    const districts = await db.district.findMany({
      where: { federationId: federation.id },
      include: { talukas: { select: { name: true, workers: true, availableWorkers: true, emergencyCapacity: true, jobsToday: true, utilizationPct: true, demandJson: true } } },
      orderBy: { workers: 'desc' },
    })

    const categoryDemand: Record<string, number> = {}
    for (const d of districts) {
      for (const lvl of [safeObject<Record<string, string>>(d.demandJson)]) {
        for (const [k, v] of Object.entries(lvl)) {
          const weight = v === 'HIGH' ? 3 : v === 'MEDIUM' ? 2 : 1
          categoryDemand[k] = (categoryDemand[k] ?? 0) + weight
        }
      }
      for (const t of d.talukas) {
        for (const [k, v] of Object.entries(safeObject<Record<string, string>>(t.demandJson))) {
          const weight = v === 'HIGH' ? 2 : v === 'MEDIUM' ? 1 : 0
          categoryDemand[k] = (categoryDemand[k] ?? 0) + weight
        }
      }
    }

    const [contracts, amcCount, gap] = await Promise.all([
      db.amcContract.findMany({ take: 50, select: { id: true, status: true, monthlyFeeRs: true, units: true, propertyType: true, title: true } }),
      db.amcContract.count(),
      buildSkillGap(districts[0]?.name ?? 'Pune'),
    ])

    const zone = FORECAST_ZONES[0]
    const forecast = zone ? buildForecast(zone.key, 7) : null

    return ok({
      federation: {
        id: federation.id,
        name: federation.name,
        type: federation.type,
        region: federation.region,
        chairperson: federation.chairperson,
        districts: federation.districts,
        cooperatives: federation.cooperatives,
        workers: federation.workers,
        activeWorkersPct: federation.activeWorkersPct,
        jobsToday: federation.jobsToday,
        revenueMonthLakh: federation.revenueMonthLakh,
        welfareCoveragePct: federation.welfareCoveragePct,
      },
      districtCapacity: districts.map((d) => ({
        id: d.id,
        name: d.name,
        cooperatives: d.cooperatives,
        workers: d.workers,
        activeWorkers: d.activeWorkers,
        jobsToday: d.jobsToday,
        utilizationPct: d.utilizationPct,
        emergencyCapacity: d.talukas.reduce((s, t) => s + t.emergencyCapacity, 0),
        demand: safeObject<Record<string, string>>(d.demandJson),
        mapPos: safeObject<{ x: number; y: number }>(d.mapPos),
      })),
      categoryDemand: Object.entries(categoryDemand)
        .map(([categoryKey, score]) => ({ categoryKey, score }))
        .sort((a, b) => b.score - a.score),
      utilistation: {
        average: districts.length ? Math.round((districts.reduce((s, d) => s + d.utilizationPct, 0) / districts.length) * 10) / 10 : 0,
        byDistrict: districts.map((d) => ({ name: d.name, utilizationPct: d.utilizationPct })),
      },
      skillGaps: gap.rows.map((r) => ({ categoryKey: r.categoryKey, name: r.name, gap: r.gap, gapLevel: r.gapLevel, recommendation: r.trainingRecommendation })),
      welfareCoverage: { pct: federation.welfareCoveragePct },
      institutionalContracts: { count: amcCount, sample: contracts.slice(0, 10).map((c) => ({ id: c.id, title: c.title, status: c.status, propertyType: c.propertyType, units: c.units, monthlyFeeRs: c.monthlyFeeRs })) },
      forecast: forecast ? { zone: forecast.label, series: forecast.series, categories: forecast.categories } : null,
      note: 'Prototype synthetic data — designed for authorized integration with cooperative registries.',
    })
  })
}
