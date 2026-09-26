// GigSetu Demand Forecasting Engine (prototype)
// Synthetic but EXPLAINABLE prediction: weekday seasonality + category drivers
// (monsoon → plumbing, festive season → cleaning/electrician, weekend → household jobs)
// deterministically seeded per zone so the demo is stable between renders.
//
// PROTOTYPE LABEL: "Prototype prediction — synthetic data. Do not claim real-world accuracy."

export interface ForecastZone { key: string; label: string; base: number }

// Pune zones used across the demo (zone 4 = Kothrud/Karve Nagar belt etc.)
export const FORECAST_ZONES: ForecastZone[] = [
  { key: 'pune-z1', label: 'Pune Zone 1 · Shivajinagar–Aundh', base: 42 },
  { key: 'pune-z2', label: 'Pune Zone 2 · Kothrud–Warje', base: 51 },
  { key: 'pune-z3', label: 'Pune Zone 3 · Hadapsar–Viman Nagar', base: 38 },
  { key: 'pune-z4', label: 'Pune Zone 4 · Kothrud–Karve Nagar', base: 47 },
  { key: 'pune-z5', label: 'Pune Zone 5 · Pimpri-Chinchwad', base: 56 },
  { key: 'pune-z6', label: 'Pune Zone 6 · Kondhwa–Wanowrie', base: 33 },
]

const WEEKEND_MULT: Record<string, number> = {
  electrician: 1.18, plumber: 1.24, carpenter: 1.12, painter: 1.09, cleaning: 1.31,
  driver: 0.94, caregiver: 1.05, gardener: 1.15, technician: 1.21, appliance: 1.26,
}

// Deterministic pseudo-random from a string seed (stable between renders)
function seededFloat(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 1000) / 1000
}

function seasonDriver(date: Date): { mult: Record<string, number>; drivers: string[] } {
  const m = date.getMonth() // 0-11
  const mult: Record<string, number> = {}
  const drivers: string[] = []
  // Monsoon June–Sept: plumbing +, painter −
  if (m >= 5 && m <= 8) {
    mult.plumber = 1.22; mult.painter = 0.88; mult.carpenter = 0.95
    drivers.push('Monsoon: leak & seepage calls up')
  }
  // Oct–Nov festive (Diwali belt): cleaning, electrician, painter up
  if (m === 9 || m === 10) {
    mult.cleaning = 1.35; mult.electrician = 1.24; mult.painter = 1.28
    drivers.push('Festive season: deep-cleaning & lighting demand')
  }
  // Mar–May summer: appliance (AC/geyser) up
  if (m >= 2 && m <= 4) {
    mult.appliance = 1.28; mult.electrician = 1.12
    drivers.push('Summer: AC & cooling appliance service peak')
  }
  if (drivers.length === 0) drivers.push('Neutral season — baseline demand pattern')
  return { mult, drivers }
}

function dayVol(zoneBase: number, categoryKey: string, date: Date, zoneKey: string): number {
  const dow = date.getDay()
  const isWeekend = dow === 0 || dow === 6
  let v = (zoneBase / 7) * (WEEKEND_MULT[categoryKey] ?? 1.1)
  if (isWeekend) v *= 1.35
  // gentle weekday rhythm: Mon/Tue quieter, Fri busier
  v *= [1.0, 0.92, 0.98, 1.04, 1.08, 1.12, 1.05][dow]
  // deterministic jitter per (zone, category, date) ±12%
  v *= 0.88 + seededFloat(`${zoneKey}|${categoryKey}|${date.toISOString().slice(0, 10)}`) * 0.24
  return Math.max(1, Math.round(v))
}

export function buildForecast(zoneKey: string, horizonDays = 7) {
  const zone = FORECAST_ZONES.find((z) => z.key === zoneKey) ?? FORECAST_ZONES[3]
  const cats = ['plumber', 'electrician', 'cleaning', 'carpenter', 'appliance', 'painter']
  const today = new Date()
  today.setHours(12, 0, 0, 0)

  const series: Array<{ date: string; label: string; isWeekend: boolean; volumes: Record<string, number> }> = []
  for (let d = 0; d < horizonDays; d++) {
    const date = new Date(today)
    date.setDate(today.getDate() + d)
    const volumes: Record<string, number> = {}
    const season = seasonDriver(date)
    for (const c of cats) {
      volumes[c] = Math.round(dayVol(zone.base, c, date, zone.key) * (season.mult[c] ?? 1))
    }
    const dow = date.getDay()
    series.push({
      date: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' }),
      isWeekend: dow === 0 || dow === 6,
      volumes,
    })
  }

  // Weekend pulse vs weekday baseline for the pulse cards
  const weekendDays = series.filter((s) => s.isWeekend)
  const weekdayDays = series.filter((s) => !s.isWeekend)
  const categories = cats.map((c) => {
    const weekendAvg = weekendDays.length ? weekendDays.reduce((s, x) => s + x.volumes[c], 0) / weekendDays.length : 0
    const weekdayAvg = weekdayDays.length ? weekdayDays.reduce((s, x) => s + x.volumes[c], 0) / weekdayDays.length : 1
    const baseWeekend = Math.round(weekdayAvg)
    const expectedWeekend = Math.round(weekendAvg)
    const pct = Math.round(((expectedWeekend - baseWeekend) / Math.max(1, baseWeekend)) * 100)
    const season = seasonDriver(today)
    const drivers: string[] = []
    if ((WEEKEND_MULT[c] ?? 1) >= 1.2) drivers.push('Weekend household availability')
    if (season.mult[c] && season.mult[c] > 1) drivers.push(season.drivers[0])
    if ((WEEKEND_MULT[c] ?? 1) < 1) drivers.push('Commuter pattern — weekday-skewed demand')
    if (drivers.length === 0) drivers.push('Steady baseline demand')
    return {
      categoryKey: c,
      name: c.charAt(0).toUpperCase() + c.slice(1),
      icon: c,
      baseWeekend,
      expectedWeekend,
      pct,
      trend: pct > 4 ? 'up' as const : pct < -4 ? 'down' as const : 'flat' as const,
      drivers,
    }
  }).sort((a, b) => b.pct - a.pct)

  return {
    ok: true,
    label: zone.label,
    zone: zone.key,
    generatedAt: new Date().toISOString(),
    disclaimer: 'Prototype prediction — synthetic data with explainable drivers. Do not claim real-world accuracy.',
    horizonDays,
    series,
    categories,
    zoneOptions: FORECAST_ZONES.map((z) => ({ key: z.key, label: z.label })),
  }
}
