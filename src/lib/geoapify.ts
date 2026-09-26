
// GigSetu GeoApify client (spec §42 — Map & Geo-Spatial System).
//
// Five products, one client, ONE RULE: GigSetu must ALWAYS remain demoable
// (spec §67). Every function here degrades gracefully to the deterministic
// built-in Pune service grid when a key is missing, the network is down, the
// judging hall is offline, or GeoApify rate-limits us. Callers therefore always
// get an answer plus a `source` telling them where it came from, so the UI can
// be honest about it.
//
// Keys are per-product, read from .env (see .env.example):
//   GEOAPIFY_AUTOCOMPIFY_KEY        address autocomplete
//   GEOAPIFY_GEOCODING_KEY          forward geocoding
//   GEOAPIFY_REVERSE_GEOCODING_KEY  reverse geocoding
//   GEOAPIFY_ROUTE_MATRIX_KEY       many-to-many distance / duration
//   GEOAPIFY_ROUTING_KEY            turn-by-turn route + polyline
//
// Verified request shapes (GeoApify v1):
//   autocomplete  GET  /v1/geocode/autocomplete?text=&format=json&limit=
//   geocode       GET  /v1/geocode/search?text=&format=json&limit=
//   reverse       GET  /v1/geocode/reverse?lat=&lon=&format=json      -> results[] (array)
//   route matrix  POST /v1/routematrix?apiKey=   body { sources, targets, metrics, mode }
//   routing       GET  /v1/routing?waypoints=LAT,LON|LAT,LON&mode=drive&units=metric
//                 (route matrix uses [lon,lat]; routing uses lat,lon — verified.)

import { AREA_COORDS, areaDistance } from './area-distance'

const BASE = 'https://api.geoapify.com/v1'
const TIMEOUT_MS = 6000

export type GeoSource = 'geoapify' | 'local-grid'

function enabled(): boolean {
  if (process.env.GEOAPIFY_ENABLED === '0') return false
  return true
}

function key(name: string): string | null {
  if (!enabled()) return null
  const v = process.env[name]
  return v && v.trim().length >= 16 ? v.trim() : null
}

export interface LatLon {
  lat: number
  lon: number
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown | null> {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS)
  try {
    const r = await fetch(url, {
      ...init,
      signal: ac.signal,
      headers: { accept: 'application/json', ...(init?.headers ?? {}) },
      // GeoApify responses are location data, not user data — but revalidate
      // keeps Next from statically freezing a geocode at build time.
      cache: 'no-store',
    })
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------- autocomplete

export interface PlaceSuggestion {
  id: string
  label: string
  lat: number
  lon: number
  type: string
  city?: string
  stateDistrict?: string
  suburb?: string
  postcode?: string
}

interface GeoResult {
  place_id?: string
  formatted?: string
  lat?: number
  lon?: number
  result_type?: string
  city?: string
  county?: string
  state_district?: string
  suburb?: string
  postcode?: string
}

function toSuggestion(r: GeoResult, i: number): PlaceSuggestion | null {
  if (typeof r.lat !== 'number' || typeof r.lon !== 'number' || !r.formatted) return null
  return {
    id: r.place_id ?? `${r.formatted}-${i}`,
    label: r.formatted,
    lat: r.lat,
    lon: r.lon,
    type: r.result_type ?? 'place',
    city: r.city,
    stateDistrict: r.state_district,
    suburb: r.suburb,
    postcode: r.postcode,
  }
}

/** Spec §14/§5 — type-ahead address search for the booking location step. */
export async function autocomplete(text: string, limit = 6): Promise<{ source: GeoSource; results: PlaceSuggestion[] }> {
  const q = text.trim().slice(0, 120)
  const k = key('GEOAPIFY_AUTOCOMPIFY_KEY')
  if (k && q.length >= 3) {
    const url = `${BASE}/geocode/autocomplete?text=${encodeURIComponent(q)}&format=json&limit=${limit}&apiKey=${k}`
    const j = (await fetchJson(url)) as { results?: GeoResult[] } | null
    const results = (j?.results ?? []).map(toSuggestion).filter((x): x is PlaceSuggestion => !!x)
    if (results.length) return { source: 'geoapify', results }
  }
  return { source: 'local-grid', results: localSuggestions(q, limit) }
}

/** Offline fallback: substring match over the built-in Pune service grid. */
function localSuggestions(q: string, limit: number): PlaceSuggestion[] {
  if (!q) return []
  const needle = q.toLowerCase()
  return Object.entries(AREA_COORDS)
    .filter(([name]) => name.toLowerCase().includes(needle))
    .slice(0, limit)
    .map(([name, p]) => ({
      id: `local:${name}`,
      label: `${name}, Pune, Maharashtra`,
      lat: gridToLat(p.y),
      lon: gridToLon(p.x),
      type: 'locality',
      city: 'Pune',
      stateDistrict: 'Pune District',
      suburb: name,
    }))
}

// ---------------------------------------------------------------- geocoding

export interface GeocodeResult {
  label: string
  lat: number
  lon: number
  city?: string
  stateDistrict?: string
  suburb?: string
  state?: string
  postcode?: string
  area: string
}

export async function geocode(query: string): Promise<{ source: GeoSource; result: GeocodeResult | null }> {
  const q = query.trim().slice(0, 120)
  const k = key('GEOAPIFY_GEOCODING_KEY')
  if (k && q.length >= 2) {
    const url = `${BASE}/geocode/search?text=${encodeURIComponent(q)}&format=json&limit=1&apiKey=${k}`
    const j = (await fetchJson(url)) as { results?: GeoResult[] } | null
    const r = j?.results?.[0]
    if (r && typeof r.lat === 'number' && typeof r.lon === 'number' && r.formatted) {
      return {
        source: 'geoapify',
        result: {
          label: r.formatted,
          lat: r.lat,
          lon: r.lon,
          city: r.city,
          stateDistrict: r.state_district,
          suburb: r.suburb,
          postcode: r.postcode,
          area: pickArea(r),
        },
      }
    }
  }
  const name = matchLocalArea(q)
  if (!name) return { source: 'local-grid', result: null }
  const p = AREA_COORDS[name]
  return {
    source: 'local-grid',
    result: { label: `${name}, Pune, Maharashtra`, lat: gridToLat(p.y), lon: gridToLon(p.x), city: 'Pune', stateDistrict: 'Pune District', suburb: name, area: name },
  }
}

// ---------------------------------------------------------------- reverse

export interface ReverseResult {
  label: string
  lat: number
  lon: number
  area: string
  city?: string
  suburb?: string
  street?: string
  postcode?: string
}

/**
 * Spec §6 — "Use current location". The old implementation called
 * navigator.geolocation and then THREW THE FIX AWAY. This resolves the actual
 * GPS coordinate to a named locality so the booking uses it.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<{ source: GeoSource; result: ReverseResult | null }> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { source: 'local-grid', result: null }
  const k = key('GEOAPIFY_REVERSE_GEOCODING_KEY')
  if (k) {
    const url = `${BASE}/geocode/reverse?lat=${lat}&lon=${lon}&format=json&apiKey=${k}`
    const j = (await fetchJson(url)) as { results?: GeoResult[] } | null
    const r = j?.results?.[0] // NOTE: reverse returns an ARRAY
    if (r && r.formatted) {
      return {
        source: 'geoapify',
        result: {
          label: r.formatted,
          lat: typeof r.lat === 'number' ? r.lat : lat,
          lon: typeof r.lon === 'number' ? r.lon : lon,
          area: pickArea(r) || (r.suburb ?? 'Pune'),
          city: r.city,
          suburb: r.suburb,
          postcode: r.postcode,
        },
      }
    }
  }
  // Offline: snap to the nearest grid point and name it.
  const name = nearestGridArea(lat, lon)
  return {
    source: 'local-grid',
    result: { label: `${name}, Pune, Maharashtra (approx. — offline fallback)`, lat, lon, area: name, city: 'Pune', suburb: name },
  }
}

// ---------------------------------------------------------------- route matrix

export interface MatrixCell {
  distanceKm: number
  durationMin: number
}

export interface MatrixResult {
  source: GeoSource
  /** cells[i][j] = travel from source i to target j */
  cells: MatrixCell[][]
}

/**
 * Real road distance + duration for many workers to one request location.
 * The matching engine uses this for travel/ETA (spec §9, §16, §42) instead of a
 * straight-line guess whenever GeoApify is reachable.
 */
export async function routeMatrix(sources: LatLon[], targets: LatLon[]): Promise<MatrixResult> {
  const n = sources.length
  const m = targets.length
  const local = (): MatrixCell[][] =>
    Array.from({ length: n }, (_, i) => Array.from({ length: m }, (_, j) => localCell(sources[i], targets[j])))

  if (!n || !m) return { source: 'local-grid', cells: [] }
  if (n * m > 400) return { source: 'local-grid', cells: local() } // stay inside the free tier
  const k = key('GEOAPIFY_ROUTE_MATRIX_KEY')
  if (!k) return { source: 'local-grid', cells: local() }

  const body = {
    sources: sources.map((s) => ({ location: [s.lon, s.lat] })),
    targets: targets.map((t) => ({ location: [t.lon, t.lat] })),
    metrics: ['distance', 'duration'],
    mode: 'drive',
  }
  const j = (await fetchJson(`${BASE}/routematrix?apiKey=${k}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })) as { sources_to_targets?: Array<Array<{ distance?: number; time?: number } | null>> } | null

  const raw = j?.sources_to_targets
  if (!Array.isArray(raw) || raw.length !== n) return { source: 'local-grid', cells: local() }

  const cells: MatrixCell[][] = raw.map((row, i) =>
    (Array.isArray(row) ? row : []).map((cell, jx) =>
      cell && typeof cell.distance === 'number' && typeof cell.time === 'number'
        ? { distanceKm: Math.round((cell.distance / 1000) * 10) / 10, durationMin: Math.round(cell.time / 60) }
        : localCell(sources[i], targets[jx]),
    ),
  )
  // Guard against a partially-populated matrix.
  for (let i = 0; i < cells.length; i += 1) {
    while (cells[i].length < m) cells[i].push(localCell(sources[i], targets[m - 1]))
  }
  return { source: 'geoapify', cells }
}

// ---------------------------------------------------------------- routing

export interface RouteStep {
  text: string
  distanceM: number
  durationS: number
}

export interface RouteResult {
  source: GeoSource
  distanceKm: number
  durationMin: number
  /** GeoJSON MultiLineString coordinates for the customer tracking map. */
  polyline: [number, number][] | null
  steps: RouteStep[]
}

/** Turn-by-turn route + polyline for the live "worker is on the way" view (spec §14). */
export async function route(from: LatLon, to: LatLon): Promise<RouteResult> {
  const fallback = (): RouteResult => {
    const d = haversineKm(from, to)
    return { source: 'local-grid', distanceKm: Math.round(d * 10) / 10, durationMin: Math.max(4, Math.round((d / 22) * 60)), polyline: null, steps: [] }
  }
  const k = key('GEOAPIFY_ROUTING_KEY')
  if (!k) return fallback()

  const wps = `${from.lat},${from.lon}|${to.lat},${to.lon}` // routing takes lat,lon
  const url = `${BASE}/routing?waypoints=${wps}&mode=drive&routingOutput=polyline6&units=metric&apiKey=${k}`
  const j = (await fetchJson(url)) as {
    features?: Array<{
      properties?: {
        distance?: number
        time?: number
        legs?: Array<{ steps?: Array<{ distance?: number; time?: number; instruction?: { text?: string } }> }>
      }
      geometry?: { coordinates?: number[][][] }
    }>
  } | null

  const f = j?.features?.[0]
  if (!f?.properties || typeof f.properties.distance !== 'number') return fallback()
  const steps: RouteStep[] = (f.properties.legs ?? []).flatMap((leg) =>
    (leg.steps ?? []).map((s) => ({
      text: s.instruction?.text ?? '',
      distanceM: Math.round(s.distance ?? 0),
      durationS: Math.round(s.time ?? 0),
    })),
  )
  const line = f.geometry?.coordinates?.[0] ?? null
  return {
    source: 'geoapify',
    distanceKm: Math.round((f.properties.distance / 1000) * 10) / 10,
    durationMin: Math.max(1, Math.round((f.properties.time ?? 0) / 60)),
    polyline: line && line.length > 1 ? (line.map(([lon, lat]) => [lat, lon]) as [number, number][]) : null,
    steps,
  }
}

// ---------------------------------------------------------------- helpers

/** Haversine in km — the offline distance primitive. */
export function haversineKm(a: LatLon, b: LatLon): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

/** Grid km -> minutes, using the same conservative effective city speed as matching. */
function localCell(a: LatLon, b: LatLon): MatrixCell {
  const distanceKm = Math.round(haversineKm(a, b) * 10) / 10
  return { distanceKm, durationMin: Math.max(4, Math.round((distanceKm / 22) * 60)) }
}

/**
 * Resolve a display area from a GeoApify result.
 * FIX: the previous version returned the first non-empty candidate, so a result
 * with `city: "Pune"` and a matching `formatted` first segment ("Karve Nagar
 * Road") resolved to the useless city name. Now every candidate is tried
 * against the local grid first, and only a genuinely unknown locality is used.
 */
function pickArea(r: GeoResult): string {
  const cands = [r.suburb, r.formatted?.split(',')[0], r.county, r.state_district, r.city].filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
  for (const c of cands) {
    const hit = matchLocalArea(c.trim())
    if (hit) return hit
  }
  return cands[0]?.trim() || 'Pune'
}

export function matchLocalArea(q: string): string | null {
  const needle = q.toLowerCase()
  let best: string | null = null
  for (const name of Object.keys(AREA_COORDS)) {
    const n = name.toLowerCase()
    if (n === needle) return name
    if (needle.includes(n) || n.includes(needle)) {
      if (!best || n.length > best.length) best = name
    }
  }
  return best
}

function nearestGridArea(lat: number, lon: number): string {
  let best = 'Kothrud'
  let bestD = Number.POSITIVE_INFINITY
  for (const [name, p] of Object.entries(AREA_COORDS)) {
    const d = haversineKm({ lat, lon }, { lat: gridToLat(p.y), lon: gridToLon(p.x) })
    if (d < bestD) {
      bestD = d
      best = name
    }
  }
  return best
}

/**
 * The built-in grid uses abstract x/y in a 0..16 box. Map it onto a real bbox
 * around Pune so offline coordinates are still meaningful on a real map.
 */
const GRID = { lat0: 18.72, lat1: 18.44, lon0: 73.68, lon1: 74.02 }
export function gridToLat(y: number): number {
  return Math.round((GRID.lat0 - (y / 16) * (GRID.lat0 - GRID.lat1)) * 1e6) / 1e6
}
export function gridToLon(x: number): number {
  return Math.round((GRID.lon0 + (x / 16) * (GRID.lon1 - GRID.lon0)) * 1e6) / 1e6
}

export { AREA_COORDS, areaDistance }
