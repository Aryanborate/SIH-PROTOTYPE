// GigSetu Emergency Escalation Engine (prototype)
// Visual + data escalation ladder:
//   Customer → Location → Skill → Local cooperative roster → Taluka reserve
//   → District reserve → Federation emergency pool
// Each level is actually evaluated against the DB (expanding search radius),
// so the ladder reflects real prototype state, not canned text.

import { db } from './db'
import { areaDistance } from './geoapify'
import { DEFAULT_WEIGHTS } from './matching'

interface LadderLevel {
  level: 0 | 1 | 2 | 3
  name: string
  detail: string
  workersFound: number
  dispatched: { id: string; name: string; coopName: string; distanceKm: number; etaMin: number; rating: number } | null
  active: boolean
}

/** Conservative emergency effective city speed — matches the matching engine. */
function eta(distanceKm: number): number {
  return Math.max(6, Math.round((distanceKm / 16) * 60) + 4) // + recall buffer
}

function pickBest(
  workers: Array<{ id: string; name: string; cooperativeId: string; rating: number; baseArea: string; emergencyPool: boolean; activeJobsToday: number }>,
  coopNames: Map<string, string>,
  area: string,
  maxKm: number
) {
  const scored = workers
    .map((w) => ({ w, d: areaDistance(w.baseArea, area) }))
    .filter((x) => x.d <= maxKm)
    .sort((a, b) => a.d - b.d + (b.w.emergencyPool ? -2 : 0) + a.w.activeJobsToday - b.w.activeJobsToday)
  const best = scored[0]
  if (!best) return { found: 0, dispatched: null }
  return {
    found: scored.length,
    dispatched: {
      id: best.w.id,
      name: best.w.name,
      coopName: coopNames.get(best.w.cooperativeId) ?? 'Cooperative network',
      distanceKm: Math.round(best.d * 10) / 10,
      etaMin: eta(best.d),
      rating: best.w.rating,
    },
  }
}

export async function escalateEmergency(categoryKey: string, area: string) {
  const coopRows = await db.cooperative.findMany({ select: { id: true, name: true } })
  const coopNames = new Map(coopRows.map((c) => [c.id, c.name]))

  const baseSelect = {
    id: true, name: true, cooperativeId: true, rating: true, baseArea: true,
    emergencyPool: true, activeJobsToday: true,
  } as const

  // Level 0 — local cooperative roster (available now)
  const local = await db.worker.findMany({
    where: { primarySkill: categoryKey, availability: 'AVAILABLE' },
    select: baseSelect,
  })
  const l0 = pickBest(local, coopNames, area, 14)

  // Level 1 — taluka reserve: emergency-pool members incl. busy, within 14km
  const taluka = await db.worker.findMany({
    where: { primarySkill: categoryKey, emergencyPool: true, availability: { in: ['AVAILABLE', 'BUSY'] } },
    select: baseSelect,
  })
  const l1 = pickBest(taluka, coopNames, area, 14)

  // Level 2 — district reserve: any certified worker incl. offline, within 20km
  const district = await db.worker.findMany({
    where: { primarySkill: categoryKey },
    select: baseSelect,
  })
  const l2 = pickBest(district, coopNames, area, 20)

  // Level 3 — federation pool: any skill-adjacent worker state-wide (prototype: all trades)
  const federation = await db.worker.findMany({
    where: { OR: [{ primarySkill: categoryKey }, { skillsJson: { contains: categoryKey } }] },
    select: baseSelect,
  })
  const l3 = pickBest(federation, coopNames, area, 40)

  const ladder: LadderLevel[] = [
    { level: 0, name: 'Local cooperative roster', detail: 'Available members within service area', workersFound: l0.found, dispatched: l0.dispatched, active: !!l0.dispatched },
    { level: 1, name: 'Taluka emergency reserve', detail: 'Emergency-pool members, busy-status recall allowed', workersFound: l1.found, dispatched: l1.dispatched, active: !l0.dispatched && !!l1.dispatched },
    { level: 2, name: 'District reserve', detail: 'All certified district members, radius widened to 20 km', workersFound: l2.found, dispatched: l2.dispatched, active: !l0.dispatched && !l1.dispatched && !!l2.dispatched },
    { level: 3, name: 'Federation emergency pool', detail: 'State-wide mutual aid — nearest skilled member any status', workersFound: l3.found, dispatched: l3.dispatched, active: !l0.dispatched && !l1.dispatched && !l2.dispatched && !!l3.dispatched },
  ]

  const activeLevel = ladder.find((l) => l.active)
  return {
    ok: true,
    categoryKey,
    area,
    urgency: 'EMERGENCY' as const,
    ladder,
    dispatchedFrom: activeLevel?.name ?? null,
    totalEtaMin: activeLevel?.dispatched?.etaMin ?? null,
    weightsApplied: DEFAULT_WEIGHTS,
    disclaimer: 'Emergency escalation prototype — ladder evaluated live against cooperative data. Designed for authorized integration.',
  }
}
