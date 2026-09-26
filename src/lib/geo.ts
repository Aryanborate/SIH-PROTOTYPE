// GigSetu Phase 5 — Map & Geo-spatial system (#42)
// Stylized interactive map data over the Pune area grid (area-distance.ts
// coordinates). No external map API, no secret keys — SVG-compatible pins,
// heat zones, service zones and emergency zones.

import { db } from './db'
import { AREA_COORDS } from './area-distance'

export interface MapPin {
  id: string
  kind: 'WORKER' | 'JOB' | 'COOP' | 'DEMAND' | 'EMERGENCY'
  label: string
  sub: string
  x: number // grid 0..16
  y: number
  area: string
  status?: string // AVAILABLE | BUSY | OFFLINE / severity
  skill?: string
  value?: number // heat weight (jobs / demand)
}

export interface GeoZone {
  key: string
  label: string
  x: number
  y: number
  r: number // radius on the grid
  level: 'HIGH' | 'MEDIUM' | 'LOW'
  kind: 'DEMAND' | 'SERVICE' | 'EMERGENCY'
}

export interface GeoDTO {
  role: 'CUSTOMER' | 'COOP' | 'DISTRICT' | 'FEDERATION'
  refId: string
  title: string
  pins: MapPin[]
  zones: GeoZone[]
  summary: { workers: number; available: number; jobs: number; emergencyZones: number }
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
  note: string
  /** Optional real-world anchor resolved via GeoApify (spec §42). */
  anchor?: { label: string; lat: number; lon: number; area: string } | null
  /** Where the anchor came from — 'geoapify' or the offline 'local-grid'. */
  geoSource?: 'geoapify' | 'local-grid'
}

const GRID = { minX: -0.5, minY: -0.5, maxX: 16.5, maxY: 13.5 }

function jitter(seed: string, amp = 0.9): number {
  let h = 0
  for (const ch of seed) h = (h * 33 + ch.charCodeAt(0)) % 100003
  return ((h % 1000) / 1000 - 0.5) * 2 * amp
}

/** Role-contextual geospatial payload. All positions are stylized mock coordinates. */
export async function getGeoData(role: string, refId: string): Promise<GeoDTO> {
  const pins: MapPin[] = []
  const zones: GeoZone[] = []

  if (role === 'CUSTOMER' || role === 'COOP') {
    const coopId = role === 'CUSTOMER' ? undefined : refId
    const workers = await db.worker.findMany({
      where: coopId ? { cooperativeId: coopId } : { serviceAreas: { contains: 'Kothrud' } },
      take: 90,
      select: { id: true, name: true, primarySkill: true, availability: true, baseArea: true, activeJobsToday: true, rating: true },
    })
    for (const w of workers.slice(0, 60)) {
      const c = AREA_COORDS[w.baseArea]
      if (!c) continue
      pins.push({
        id: w.id,
        kind: 'WORKER',
        label: w.name,
        sub: `${w.primarySkill} · ★${w.rating.toFixed(1)}`,
        x: c.x + jitter(w.id),
        y: c.y + jitter(w.id + 'y'),
        area: w.baseArea,
        status: w.availability,
        skill: w.primarySkill,
      })
    }
    // Active jobs as pins
    const jobs = await db.booking.findMany({
      where: coopId ? { cooperativeId: coopId, status: { in: ['ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS'] } } : { status: { in: ['ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS'] } },
      take: 30,
      select: { id: true, refCode: true, title: true, area: true, urgency: true, status: true },
    })
    for (const j of jobs) {
      const c = AREA_COORDS[j.area]
      if (!c) continue
      pins.push({ id: j.id, kind: 'JOB', label: j.refCode, sub: `${j.title} · ${j.status}`, x: c.x + jitter(j.id), y: c.y + jitter(j.id + 'y'), area: j.area, status: j.status })
    }
    if (role === 'COOP') {
      const coop = await db.cooperative.findUnique({ where: { id: refId }, select: { name: true, workers: { select: { id: true } } } })
      zones.push({ key: 'service', label: 'Primary service zone', x: 8.5, y: 5.5, r: 5.2, level: 'MEDIUM', kind: 'SERVICE' })
      return {
        role: 'COOP',
        refId,
        title: coop?.name ?? 'Cooperative map',
        pins,
        zones,
        summary: { workers: pins.filter((p) => p.kind === 'WORKER').length, available: pins.filter((p) => p.kind === 'WORKER' && p.status === 'AVAILABLE').length, jobs: pins.filter((p) => p.kind === 'JOB').length, emergencyZones: 0 },
        bounds: GRID,
        note: 'Stylized prototype map — worker pins and live jobs over the Pune area grid; designed for open-map integration.',
      }
    }
    // CUSTOMER: demand heat around the pilot areas + emergency zone
    zones.push({ key: 'demand-kothrud', label: 'Local demand — Kothrud belt', x: 5, y: 8, r: 2.6, level: 'HIGH', kind: 'DEMAND' })
    zones.push({ key: 'demand-west', label: 'West Pune belt', x: 9, y: 2, r: 3.0, level: 'MEDIUM', kind: 'DEMAND' })
    zones.push({ key: 'emergency', label: 'Emergency watch zone', x: 12, y: 9, r: 1.8, level: 'HIGH', kind: 'EMERGENCY' })
    const nearCount = pins.filter((p) => p.kind === 'WORKER' && p.status === 'AVAILABLE').length
    return {
      role: 'CUSTOMER',
      refId,
      title: 'Nearby verified workers',
      pins,
      zones,
      summary: { workers: pins.filter((p) => p.kind === 'WORKER').length, available: nearCount, jobs: pins.filter((p) => p.kind === 'JOB').length, emergencyZones: 1 },
      bounds: GRID,
      note: 'Stylized prototype map — nearby verified cooperative workers; no external map API or keys required.',
    }
  }

  // DISTRICT / FEDERATION: demand heat per area + coop pin aggregation
  const districts = await db.district.findMany({
    where: role === 'DISTRICT' ? { name: { contains: refId } } : {},
    include: { talukas: { include: { cooperativesRel: { select: { id: true, name: true, jobsToday: true, activeToday: true, workers: { select: { id: true }, take: 1 } } } } } },
    take: role === 'DISTRICT' ? 1 : 8,
  })
  const heatSeed: Record<string, number> = { Kothrud: 42, Baner: 36, Hadapsar: 30, 'Pimple Saudagar': 28, Shivajinagar: 24, Katraj: 18, Chinchwad: 22, Wakad: 20, Warje: 16, 'Viman Nagar': 14 }
  for (const [area, v] of Object.entries(heatSeed)) {
    const c = AREA_COORDS[area]
    if (!c) continue
    zones.push({ key: `heat-${area}`, label: area, x: c.x, y: c.y, r: 1.6 + (v / 42) * 1.8, level: v > 30 ? 'HIGH' : v > 18 ? 'MEDIUM' : 'LOW', kind: 'DEMAND' })
  }
  for (const d of districts) {
    let workers = 0
    let jobs = 0
    for (const t of d.talukas) {
      for (const c of t.cooperativesRel) {
        workers += c.workers.length >= 1 ? c.workers.length : 0
        jobs += c.jobsToday
        const pinX = 3 + ((d.name.length + t.name.length) % 10) + jitter(c.id, 1.4)
        const pinY = 2 + ((c.name.length * 7) % 9) + jitter(c.name, 1.4)
        pins.push({ id: c.id, kind: 'COOP', label: c.name.replace(/ (Labour )?Cooperative Society/, ''), sub: `${c.jobsToday} jobs today · ${c.activeToday} active`, x: pinX, y: pinY, area: t.name, value: c.jobsToday })
      }
    }
    if (role === 'DISTRICT') {
      return {
        role: 'DISTRICT',
        refId,
        title: `${d.name} — service demand map`,
        pins,
        zones,
        summary: { workers: d.workers, available: d.activeWorkers, jobs: d.jobsToday, emergencyZones: zones.filter((z) => z.kind === 'EMERGENCY').length },
        bounds: GRID,
        note: 'Stylized district demand heatmap — synthetic intensities over the Pune grid; open-map compatible.',
      }
    }
  }
  return {
    role: 'FEDERATION',
    refId: refId || 'Maharashtra',
    title: 'Federation district capacity map',
    pins,
    zones,
    summary: { workers: pins.length, available: pins.length, jobs: pins.reduce((a, p) => a + (p.value ?? 0), 0), emergencyZones: 0 },
    bounds: GRID,
    note: 'Stylized federation capacity map — district demand intensity; open-map compatible.',
  }
}
