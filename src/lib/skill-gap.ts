// GigSetu Skill Gap Intelligence (prototype)
// Compares expected 30-day demand (from the forecast engine, SCALED TO THE
// DISTRICT BEING ASKED ABOUT) against the certified workforce actually present
// in that district, then produces training recommendations + employment
// opportunity estimates.
//
// FIX: the previous version queried EVERY worker platform-wide and summed EVERY
// forecast zone, so `?district=Nashik` returned a whole-network number while
// labelling it "in Nashik" — e.g. "1393 expected / 0 certified" for a trade whose
// society sits in another district.
//
// PROTOTYPE LABEL: synthetic demand model — designed for authorized integration.

import { db } from './db'
import { FORECAST_ZONES, buildForecast } from './forecast'
import { safeArray } from './safe'

const CAT_META: Record<string, { name: string; icon: string }> = {
  electrician: { name: 'Electrician', icon: 'Zap' },
  plumber: { name: 'Plumber', icon: 'Droplets' },
  carpenter: { name: 'Carpenter', icon: 'Hammer' },
  painter: { name: 'Painter', icon: 'Paintbrush' },
  cleaning: { name: 'Cleaning', icon: 'Sparkles' },
  driver: { name: 'Driver', icon: 'Car' },
  caregiver: { name: 'Caregiver', icon: 'HeartHandshake' },
  gardener: { name: 'Gardener', icon: 'Leaf' },
  technician: { name: 'Technician', icon: 'Wrench' },
  appliance: { name: 'Appliance repair', icon: 'Refrigerator' },
}

// Jobs one worker can realistically absorb per month (fair-share workload)
const MONTHLY_CAPACITY_PER_WORKER = 52

/** Zones that belong to a district. The Pune pilot zones are Pune's. */
const DISTRICT_ZONES: Record<string, string[]> = {
  Pune: ['pune-z1', 'pune-z2', 'pune-z3', 'pune-z4', 'pune-z5', 'pune-z6'],
}

/** How many forecast zones represent the whole pilot region (1 = this district only). */
const TOTAL_MODEL_ZONES = FORECAST_ZONES.length

export async function buildSkillGap(districtName = 'Pune') {
  // 1. The workforce actually enrolled in THIS district.
  const workers = await db.worker.findMany({
    where: districtName ? { cooperative: { taluka: { district: { name: districtName } } } } : {},
    select: { primarySkill: true, certStatus: true, availability: true, skillsJson: true },
    take: 5000,
  })

  // 2. Demand modelled for THIS district only, scaled from the zone set that
  //    belongs to it. Districts without an explicit zone list get a share
  //    proportional to their workforce, so Nashik never reports Pune's volume.
  const explicitZones = DISTRICT_ZONES[districtName]
  const zoneKeys = explicitZones ?? FORECAST_ZONES.map((z) => z.key)
  const districtWorkers = districtName
    ? ((await db.district.findFirst({ where: { name: districtName }, select: { workers: true } }))?.workers ?? workers.length)
    : workers.length
  const pilotWorkers = workers.length || 1
  const share = explicitZones
    ? explicitZones.length / TOTAL_MODEL_ZONES
    : Math.max(0.05, Math.min(1, districtWorkers / Math.max(pilotWorkers * 8, 1)))
  const zoneTotals: Record<string, number> = {}
  for (const key of zoneKeys) {
    const f = buildForecast(key, 7)
    for (const point of f.series) {
      for (const [c, v] of Object.entries(point.volumes)) {
        zoneTotals[c] = (zoneTotals[c] ?? 0) + v
      }
    }
  }
  // 7-day forecast -> 30-day horizon, then scale to this district's share.
  const monthlyDemand: Record<string, number> = {}
  for (const [c, v] of Object.entries(zoneTotals)) {
    monthlyDemand[c] = Math.round((v / 7) * 30 * share)
  }

  const courses = await db.trainingCourse.findMany()
  const courseByCat = new Map<string, (typeof courses)[number]>()
  for (const c of courses) if (!courseByCat.has(c.categoryKey)) courseByCat.set(c.categoryKey, c)

  const cats = Object.keys(CAT_META).filter(
    (c) => workers.some((w) => w.primarySkill === c) || (monthlyDemand[c] ?? 0) > 0,
  )

  const rows = cats
    .map((categoryKey) => {
      const meta = CAT_META[categoryKey]
      const all = workers.filter((w) => w.primarySkill === categoryKey)
      const certified = all.filter((w) => w.certStatus === 'VERIFIED' || w.certStatus === 'EXPIRING').length
      const active = all.filter((w) => w.availability !== 'OFFLINE').length
      // A worker who lists this trade as a secondary skill can absorb some demand.
      const crossSkilled = workers.filter(
        (w) => w.primarySkill !== categoryKey && safeArray<unknown>(w.skillsJson).some((s) => String(s).toLowerCase().includes(categoryKey.toLowerCase())),
      ).length
      const expectedDemand = monthlyDemand[categoryKey] ?? 0
      const capacity = Math.round((certified + crossSkilled * 0.4) * MONTHLY_CAPACITY_PER_WORKER)
      const gap = Math.max(0, Math.ceil((expectedDemand - capacity) / MONTHLY_CAPACITY_PER_WORKER))
      const gapLevel = gap > 5 ? 'CRITICAL' : gap > 0 ? 'TIGHT' : 'OK'
      const course = courseByCat.get(categoryKey)
      const trainingRecommendation =
        gap > 0
          ? `Prioritize ${meta.name.toLowerCase()} training — certify ≈${gap} new workers via the cooperative training calendar`
          : null
      const unmetJobs = Math.max(0, expectedDemand - capacity)
      const incomePotentialRs = Math.round(unmetJobs * 420 * 0.86)
      return {
        categoryKey,
        name: meta.name,
        icon: meta.icon,
        expectedDemand,
        certifiedWorkers: certified,
        crossSkilledWorkers: crossSkilled,
        activeWorkers: active,
        gap,
        gapLevel,
        trainingRecommendation,
        courseTitle: course?.title ?? null,
        employmentOpportunity:
          incomePotentialRs > 0
            ? `≈ ₹${(incomePotentialRs / 100000).toFixed(1)}L/month unmet member income in ${districtName}`
            : 'Certified capacity matches expected demand',
        incomePotentialRs,
      }
    })
    .sort((a, b) => b.gap - a.gap)

  return {
    ok: true,
    districtName,
    workerCount: workers.length,
    zonesCovered: zoneKeys,
    disclaimer: `Skill-gap intelligence — prototype demand model on synthetic forecast data for ${districtName}. Designed for authorized integration.`,
    rows,
    totalGap: rows.reduce((s, r) => s + r.gap, 0),
    criticalSkills: rows.filter((r) => r.gapLevel === 'CRITICAL').map((r) => r.name),
  }
}
