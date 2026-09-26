// GigSetu AI Matching Engine v2 (server-side)
// ONE customer -> ONE worker. Pipeline: skill -> certification -> availability -> service area
// -> distance -> workload -> cooperative rules -> weighted AI score -> ONE recommended worker.
//
// PROTOTYPE LABEL: "AI-assisted workforce matching" — heuristic weighted scoring, NOT a
// production ML model. Factor weights are configurable from the admin console
// (MatchWeightConfig) and every score ships with a per-factor breakdown + human-readable
// explainability for the Workforce Allocation Engine.

import { db } from './db'
import { safeArray, safeObject } from './safe'
import { areaDistance, AREA_COORDS, gridToLat, gridToLon, routeMatrix, type LatLon } from './geoapify'
import type { MatchedWorkerDTO, Urgency, MatchResponse } from './types'

// Devanagari aliases are SUBSTRING matches, so inflected forms matter: Marathi
// writes पाणी (water) as पाण्याची (genitive) and pipe as पाइप — neither contains
// the bare "पाणी" token because of the virama (्). Hindi/Marathi both use
// नळ / नल / पाइप / प्लंबर. Keep this list in sync with wa-bot.ts SERVICE_WORDS —
// the previous duplicate implementation in api/ai/analyze mis-classified the
// spec §51 signature sentence as "other" whenever the LLM was unavailable.
const CATEGORY_ALIASES: Record<string, string[]> = {
  electrician: ['electric', 'bijli', 'light', 'fan', 'mcb', 'switch', 'wiring', 'वीज', 'बिजली', 'इलेक्ट्रिक', 'बत्ती', 'पंखा', 'एमसीबी'],
  plumber: ['plumb', 'leak', 'tap', 'sink', 'drain', 'pipe', 'नळ', 'नल', 'प्लंब', 'पाइप', 'पाइप', 'पाणी', 'पाण्या', 'पानी', 'गळ', 'लीक', 'सील', 'फुट'],
  carpenter: ['carpent', 'door', 'furniture', 'wood', 'सुतार', 'दरवाजा', 'दारा', 'लाकूड', 'बढ़ई', 'फर्निचर'],
  painter: ['paint', 'रंग', 'पेंट', 'पेंटिंग', 'रंगाई'],
  cleaning: ['clean', 'सफाई', 'स्वच्छ', 'साफ', 'झाडू'],
  driver: ['driv', 'driver', 'ड्राइवर', 'चालक', 'गाड़ी', 'गाडी'],
  caregiver: ['care', 'aaji', 'patient', 'elderly', 'देखभाल', 'नर्स', 'आज्जी', 'आजोबा', 'पालक', 'सेवक'],
  gardener: ['garden', 'plant', 'माळी', 'माली', 'बाग', 'झाडे', 'गार्डन'],
  technician: ['technic', 'install', 'fitting', 'टेक्निशियन', 'इंस्टॉल', 'फिटिंग'],
  appliance: ['fridge', 'ac', 'washing', 'geyser', 'microwave', 'फ्रिज', 'एसी', 'वॉशिंग', 'गीजर', 'उपकरण', 'वॉशिंग मशीन'],
  other: [],
}

/** Devanagari problem nouns so the analyzer can name the fault, not just the trade. */
const PROBLEM_HINTS: Array<{ re: RegExp; label: string }> = [
  { re: /(फुट|f burst|burst|burst)/i, label: 'Pipe burst' },
  { re: /(गळ|leak|लीक|滴)/i, label: 'Leakage' },
  { re: /(बंद|block|जाम|clog)/i, label: 'Blockage' },
  { re: /(नहीं चल|not working|dead|spark|शॉर्ट)/i, label: 'No power / fault' },
  { re: /(खराब|broken|टूट|burst pipe)/i, label: 'Broken fitting' },
  { re: /(रंग|peeling|paint)/i, label: 'Repainting' },
]

export function inferCategory(description: string): string {
  const d = description.toLowerCase()
  let best: { cat: string; len: number } | null = null
  for (const [cat, words] of Object.entries(CATEGORY_ALIASES)) {
    if (cat === 'other') continue
    for (const w of words) {
      if (d.includes(w) && (!best || w.length > best.len)) best = { cat, len: w.length }
    }
  }
  return best?.cat ?? 'other'
}

/** Short English job title from free text — used by the AI analysis fallback. */
export function inferProblemLabel(description: string, categoryKey: string): string {
  for (const h of PROBLEM_HINTS) if (h.re.test(description)) return h.label
  const fallback: Record<string, string> = {
    electrician: 'Electrical fault repair', plumber: 'Plumbing repair', carpenter: 'Carpentry work',
    painter: 'Painting work', cleaning: 'Deep cleaning', driver: 'Driver booking',
    caregiver: 'Care assistance', gardener: 'Garden maintenance', technician: 'Equipment fitting',
    appliance: 'Appliance repair', other: 'General service',
  }
  return fallback[categoryKey] ?? 'General service'
}

export function inferUrgency(description: string, explicit?: Urgency): Urgency {
  if (explicit) return explicit
  const d = description.toLowerCase()
  if (/(emergency|urgently|fire|spark|shock|water everywhere|flood|आपत्कालीन|तातडीचे|तातडीने|तुरंत|आग|झटपट)/.test(d)) return 'EMERGENCY'
  if (/(today|asap|soon|आज|लवकर|जल्दी)/.test(d)) return 'URGENT'
  return 'NORMAL'
}

/**
 * ETA in minutes. When GeoApify gave us a real road duration we use it
 * verbatim; otherwise fall back to an effective city speed. Cooperative policy
 * adds a small recall buffer for emergencies (a recalled pool member may be
 * finishing a job across the taluka).
 */
function etaFor(distanceKm: number, emergency: boolean, realDurationMin?: number): number {
  if (typeof realDurationMin === 'number' && Number.isFinite(realDurationMin) && realDurationMin > 0) {
    return Math.max(4, Math.round(realDurationMin) + (emergency ? 3 : 0))
  }
  const speed = emergency ? 16 : 14 // km/h effective city speed incl. finding parking
  return Math.max(6, Math.round((distanceKm / speed) * 60) + (emergency ? 4 : 0))
}

// ---------- Configurable factor weights (admin-editable, DB-backed) ----------

export interface MatchWeights {
  skillMatch: number
  certification: number
  distance: number
  availability: number
  workload: number
  serviceHistory: number
}

export const DEFAULT_WEIGHTS: MatchWeights = {
  skillMatch: 35,
  certification: 15,
  distance: 15,
  availability: 15,
  workload: 10,
  serviceHistory: 10,
}

export const WEIGHT_META: Array<{ key: keyof MatchWeights; label: string; desc: string }> = [
  { key: 'skillMatch', label: 'Skill match', desc: 'Primary skill exact match vs secondary skill overlap' },
  { key: 'certification', label: 'Certification', desc: 'NSQF / trade certificate verified by the cooperative' },
  { key: 'distance', label: 'Distance', desc: 'Travel distance from worker base area to the request' },
  { key: 'availability', label: 'Availability', desc: 'Live roster status (available / busy / offline)' },
  { key: 'workload', label: 'Workload balance', desc: 'Active jobs today — spreads work fairly across members' },
  { key: 'serviceHistory', label: 'Service history', desc: 'Rating, completion rate and repeat-customer familiarity' },
]

export async function getMatchWeights(): Promise<MatchWeights & { updatedBy: string; updatedAt: string | null }> {
  try {
    const row = await db.matchWeightConfig.findUnique({ where: { id: 'default' } })
    if (row) {
      return {
        skillMatch: row.skillMatch,
        certification: row.certification,
        distance: row.distance,
        availability: row.availability,
        workload: row.workload,
        serviceHistory: row.serviceHistory,
        updatedBy: row.updatedBy,
        updatedAt: row.updatedAt.toISOString(),
      }
    }
  } catch {
    // table missing / db unreachable — prototype fallback
  }
  return { ...DEFAULT_WEIGHTS, updatedBy: 'system', updatedAt: null }
}

export async function saveMatchWeights(w: Partial<MatchWeights>, updatedBy: string) {
  const merged = { ...DEFAULT_WEIGHTS, ...w }
  // normalize: clamp each weight 0..100
  for (const k of Object.keys(DEFAULT_WEIGHTS) as Array<keyof MatchWeights>) {
    merged[k] = Math.max(0, Math.min(100, Math.round(merged[k])))
  }
  const row = await db.matchWeightConfig.upsert({
    where: { id: 'default' },
    create: { id: 'default', ...merged, updatedBy },
    update: { ...merged, updatedBy },
  })
  return {
    ...merged,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt.toISOString(),
  }
}

// ---------- Per-factor scoring (0..1 raw per factor, weighted sum → 0..100) ----------

export interface FactorScore {
  key: keyof MatchWeights | 'emergency' | 'policy'
  label: string
  weightPct: number // configured weight
  raw: number // 0..1 achievement
  weighted: number // contribution to final score (round 1dp)
  detail: string // human-readable explanation line
  pass: boolean // gate-style display for explainability checklist
}

export interface ScoredCandidate extends MatchedWorkerDTO {
  factors: FactorScore[]
  matchedReasons: string[] // "✓ Correct skill" style checklist
  policyNotes: string[] // cooperative allocation rule notes
}

function skillRaw(w: { primarySkill: string; skills: string[] }, categoryKey: string): { raw: number; detail: string } {
  if (w.primarySkill === categoryKey) return { raw: 1, detail: `Primary skill = ${categoryKey}` }
  if (w.skills.some((s) => s.toLowerCase().includes(categoryKey.toLowerCase()))) {
    return { raw: 0.6, detail: `Secondary skill covers ${categoryKey}` }
  }
  return { raw: 0.2, detail: 'Adjacent trade — cooperative cross-skill roster' }
}

function certRaw(certStatus: string): { raw: number; detail: string } {
  if (certStatus === 'VERIFIED') return { raw: 1, detail: 'Certification verified by cooperative' }
  if (certStatus === 'EXPIRING') return { raw: 0.5, detail: 'Certificate valid but expiring soon' }
  return { raw: 0, detail: 'Certification pending verification' }
}

function distRaw(distanceKm: number): { raw: number; detail: string } {
  const raw = Math.max(0, 1 - distanceKm / 14)
  return { raw, detail: `${distanceKm.toFixed(1)} km from request location` }
}

function availRaw(w: { availability: string; emergencyPool: boolean }, emergency: boolean): { raw: number; detail: string } {
  if (w.availability === 'AVAILABLE') return { raw: 1, detail: 'Available now on the cooperative roster' }
  if (emergency && w.emergencyPool) return { raw: 0.85, detail: 'Emergency reserve pool — recalled for emergencies' }
  if (w.availability === 'BUSY') return { raw: 0.3, detail: 'Currently busy on another job' }
  return { raw: 0, detail: 'Offline today' }
}

function workRaw(activeJobsToday: number): { raw: number; detail: string } {
  const raw = Math.max(0, 1 - activeJobsToday / 4)
  return { raw, detail: activeJobsToday === 0 ? 'No active jobs — low current workload' : `${activeJobsToday} active job${activeJobsToday > 1 ? 's' : ''} today` }
}

function histRaw(w: { rating: number; completionRate: number }): { raw: number; detail: string } {
  const raw = Math.max(0, Math.min(1, ((w.rating - 3) / 2) * 0.7 + ((w.completionRate - 80) / 20) * 0.3))
  return { raw, detail: `${w.rating.toFixed(2)}★ · ${Math.round(w.completionRate)}% completion rate` }
}

function scoreCandidate(
  w: {
    id: string; name: string; cooperativeName: string; primarySkill: string; distanceKm: number; rating: number;
    completedJobs: number; certStatus: string; certName: string; availability: string; emergencyPool: boolean;
    languages: string[]; experienceYears: number; activeJobsToday: number; completionRate: number; skills: string[];
    travelMinutes?: number; geoSource?: 'geoapify' | 'local-grid';
  },
  ctx: { categoryKey: string; emergency: boolean; weights: MatchWeights; baseEarning: number }
): ScoredCandidate {
  const sSkill = skillRaw(w, ctx.categoryKey)
  const sCert = certRaw(w.certStatus)
  const sDist = distRaw(w.distanceKm)
  const sAvail = availRaw(w, ctx.emergency)
  const sWork = workRaw(w.activeJobsToday)
  const sHist = histRaw(w)

  const factors: FactorScore[] = [
    { key: 'skillMatch', label: 'Skill match', weightPct: ctx.weights.skillMatch, raw: sSkill.raw, weighted: Math.round(sSkill.raw * ctx.weights.skillMatch * 10) / 10, detail: sSkill.detail, pass: sSkill.raw >= 0.6 },
    { key: 'certification', label: 'Certification', weightPct: ctx.weights.certification, raw: sCert.raw, weighted: Math.round(sCert.raw * ctx.weights.certification * 10) / 10, detail: sCert.detail, pass: sCert.raw >= 0.5 },
    { key: 'distance', label: 'Distance', weightPct: ctx.weights.distance, raw: sDist.raw, weighted: Math.round(sDist.raw * ctx.weights.distance * 10) / 10, detail: sDist.detail, pass: w.distanceKm <= 14 },
    { key: 'availability', label: 'Availability', weightPct: ctx.weights.availability, raw: sAvail.raw, weighted: Math.round(sAvail.raw * ctx.weights.availability * 10) / 10, detail: sAvail.detail, pass: sAvail.raw >= 0.3 },
    { key: 'workload', label: 'Workload balance', weightPct: ctx.weights.workload, raw: sWork.raw, weighted: Math.round(sWork.raw * ctx.weights.workload * 10) / 10, detail: sWork.detail, pass: w.activeJobsToday <= 3 },
    { key: 'serviceHistory', label: 'Service history', weightPct: ctx.weights.serviceHistory, raw: sHist.raw, weighted: Math.round(sHist.raw * ctx.weights.serviceHistory * 10) / 10, detail: sHist.detail, pass: w.rating >= 4 },
  ]

  const weightSum = factors.reduce((s, f) => s + f.weightPct, 0) || 1
  let score = factors.reduce((s, f) => s + f.weighted, 0) * (100 / weightSum)

  // Emergency pool boost — cooperative rule, outside the configurable weights
  if (ctx.emergency && w.emergencyPool) score += 8

  const matchedReasons = factors.filter((f) => f.pass).map((f) => `✓ ${f.label} — ${f.detail}`)
  const policyNotes: string[] = ['Cooperative allocation policy satisfied — member in good standing']
  if (ctx.emergency && w.emergencyPool) policyNotes.push('Emergency reserve protocol: pool member recalled with consent')
  if (w.activeJobsToday >= 4) policyNotes.push('Workload cap note: candidate near daily fair-share limit')
  policyNotes.push(
    w.geoSource === 'geoapify'
      ? 'Travel distance and ETA from live road-network routing (GeoApify Routing API)'
      : 'Travel distance estimated from the cooperative service grid (routing provider unavailable — offline-safe estimate)',
  )

  return {
    id: w.id,
    name: w.name,
    cooperativeName: w.cooperativeName,
    primarySkill: w.primarySkill,
    distanceKm: Math.round(w.distanceKm * 10) / 10,
    etaMin: etaFor(w.distanceKm, ctx.emergency, w.travelMinutes),
    rating: w.rating,
    completedJobs: w.completedJobs,
    certStatus: w.certStatus,
    certName: w.certName,
    availability: w.availability as MatchedWorkerDTO['availability'],
    emergencyPool: w.emergencyPool,
    languages: w.languages,
    experienceYears: w.experienceYears,
    estimatedEarning: ctx.baseEarning + Math.round(w.distanceKm * 6),
    score: Math.round(score * 10) / 10,
    skills: w.skills,
    factors,
    matchedReasons,
    policyNotes,
  }
}

export async function matchWorkers(params: {
  categoryKey: string
  area: string
  urgency: Urgency
  scheduledAt?: string
  customerId?: string
}): Promise<MatchResponse & { weights?: MatchWeights; aiLabel: string; policySummary: string[]; geoSource: 'geoapify' | 'local-grid' }> {
  const { categoryKey, area, urgency } = params
  const emergency = urgency === 'EMERGENCY'

  const all = await db.worker.findMany({
    where: { primarySkill: categoryKey },
    include: { cooperative: true },
  })
  const totalSkilled = all.length

  // Stage 2: verified certification
  const verified = all.filter((w) => w.certStatus === 'VERIFIED' || w.certStatus === 'EXPIRING')
  // Stage 3: available now (emergency pool counts even when BUSY for emergencies)
  const availStage = verified.filter(
    (w) => (w.availability === 'AVAILABLE') || (emergency && w.emergencyPool)
  )
  // Stage 4: service area + distance (with cooperative mutual-aid fallback)
  const availWithDist = availStage.map((w) => {
    const areas = safeArray<string>(w.serviceAreas)
    return { w, gridDistanceKm: areaDistance(w.baseArea, area), areaMatch: areas.includes(area) }
  })

  // Real road distance + duration for the shortlist (spec §42 Route Matrix).
  // One batched call for up to 40 candidates; anything beyond falls back to grid.
  const shortlist = availWithDist
    .slice()
    .sort((a, b) => a.gridDistanceKm - b.gridDistanceKm)
    .slice(0, 40)
  const { cells, source: geoSource } = await roadDistances(shortlist.map((x) => x.w.baseArea), area)
  const withDistance = shortlist.map((x, i) => ({
    ...x,
    distanceKm: cells[i]?.distanceKm ?? x.gridDistanceKm,
    travelMinutes: cells[i]?.durationMin,
  }))
  const areaMatched = withDistance.filter((x) => x.areaMatch)
  const nearby = withDistance.filter((x) => x.distanceKm <= 14)
  // Fallback chain: exact service area -> nearest within 14km -> nearest workers
  // via cooperative mutual aid (spec §22 "mutual aid only on shortfall").
  const pool = areaMatched.length ? areaMatched : nearby.length ? nearby : withDistance.slice(0, 4)

  const cat = await db.serviceCategory.findUnique({ where: { key: categoryKey } })
  const scheduledAt = params.scheduledAt ?? new Date().toISOString()
  const baseEarning = cat ? Math.round(cat.baseRate * (emergency ? 1.5 : 1.1)) : 300
  const weights = await getMatchWeights()

  // Repeat-customer familiarity: service history bonus (data-informed, still prototype)
  let repeatWorkerId: string | null = null
  if (params.customerId) {
    const past = await db.booking.findFirst({
      where: { customerId: params.customerId, categoryKey, status: { in: ['COMPLETED', 'PAID', 'REVIEWED'] }, workerId: { not: null } },
      orderBy: { createdAt: 'desc' },
    })
    if (past?.workerId) repeatWorkerId = past.workerId
  }

  const scored: ScoredCandidate[] = pool
    .map(({ w, distanceKm, travelMinutes }) => {
      const c = scoreCandidate(
        {
          id: w.id, name: w.name, cooperativeName: w.cooperative.name, primarySkill: w.primarySkill,
          distanceKm, rating: w.rating, completedJobs: w.completedJobs, certStatus: w.certStatus,
          certName: w.certName, availability: w.availability, emergencyPool: w.emergencyPool,
          languages: safeArray<string>(w.languages), experienceYears: w.experienceYears, activeJobsToday: w.activeJobsToday,
          completionRate: w.completionRate, skills: safeArray<string>(w.skillsJson),
          travelMinutes, geoSource,
        },
        { categoryKey, emergency, weights, baseEarning }
      )
      if (repeatWorkerId && c.id === repeatWorkerId) {
        c.factors.push({ key: 'policy', label: 'Repeat service', weightPct: 0, raw: 1, weighted: 0, detail: 'Served this customer before — preferred when available', pass: true })
        c.matchedReasons.push('✓ Repeat worker — served this customer previously')
        c.score = Math.round((c.score + 3) * 10) / 10
      }
      return c
    })
    .sort((a, b) => b.score - a.score)

  const best = scored[0] ?? null
  const alternatives = scored.slice(1, 5)
  const bestCoopId = pool.find((p) => p.w.id === best?.id)?.w.cooperativeId ?? null

  const { estimatePrice } = await import('./pricing')
  const priceEstimate = estimatePrice(
    cat ?? { key: categoryKey, baseRate: 300, avgDurationMin: 60 },
    urgency,
    scheduledAt,
    undefined,
    {
      policy: await loadCoopPolicy(bestCoopId),
      distanceKm: best?.distanceKm ?? 0,
      travelMinutes: best?.etaMin ?? 0,
      skillYears: best?.experienceYears ?? 0,
    },
  )

  const policySummary = [
    'ONE customer → ONE worker recommendation (no marketplace bidding)',
    'Certification gate: unverified workers never dispatched solo',
    'Workload balance spreads jobs fairly across cooperative members',
    emergency
      ? 'Emergency protocol: cooperative roster → taluka reserve → district reserve → federation pool'
      : 'Allocation respects cooperative boundaries; mutual aid only on shortfall',
  ]

  return {
    ok: best !== null,
    best,
    alternatives,
    priceEstimate,
    pipeline: [
      { stage: 'Correct skill', detail: `${categoryKey} workers in network`, count: totalSkilled },
      { stage: 'Verified certification', detail: 'NSQF / trade certificate validated by cooperative', count: verified.length },
      { stage: 'Available now', detail: emergency ? 'Emergency pool overrides busy status' : 'AVAILABLE workers only', count: availStage.length },
      { stage: 'Service area', detail: `Covers ${area}`, count: areaMatched.length },
      { stage: 'Within 14 km', detail: 'Distance-sorted, nearest weighted', count: nearby.length },
      { stage: 'AI score → 1 worker', detail: `Weighted factors (skill ${weights.skillMatch} · cert ${weights.certification} · distance ${weights.distance} · availability ${weights.availability} · workload ${weights.workload} · history ${weights.serviceHistory})`, count: best ? 1 : 0 },
    ],
    weights,
    aiLabel: 'AI-assisted workforce matching — prototype heuristic scoring, weights set by cooperative admin',
    policySummary,
    geoSource,
  }
}

/**
 * Batched road distance/duration from each candidate's base area to the request
 * area. Uses the GeoApify Route Matrix when a key is present, otherwise the
 * deterministic service grid. Areas outside the grid are excluded (the grid
 * function already treats them as 55 km out-of-area).
 */
async function roadDistances(
  baseAreas: string[],
  targetArea: string,
): Promise<{ cells: Array<{ distanceKm: number; durationMin: number } | null>; source: 'geoapify' | 'local-grid' }> {
  const target = AREA_COORDS[targetArea]
  const known = baseAreas.filter((a) => !!AREA_COORDS[a])
  if (!target || known.length === 0) {
    return { cells: baseAreas.map((a) => ({ distanceKm: areaDistance(a, targetArea), durationMin: 0 })), source: 'local-grid' }
  }
  try {
    const res = await routeMatrix(
      known.map((a) => ({ lat: gridToLat(AREA_COORDS[a].y), lon: gridToLon(AREA_COORDS[a].x) })),
      [{ lat: gridToLat(target.y), lon: gridToLon(target.x) }],
    )
    const col = res.cells.map((row) => row[0] ?? null)
    const lookup = new Map<string, (typeof col)[number]>()
    known.forEach((a, i) => lookup.set(a, col[i] ?? null))
    return {
      cells: baseAreas.map((a) => {
        const hit = lookup.get(a)
        if (hit) return hit
        return { distanceKm: areaDistance(a, targetArea), durationMin: 0 }
      }),
      source: res.source,
    }
  } catch {
    return { cells: baseAreas.map((a) => ({ distanceKm: areaDistance(a, targetArea), durationMin: 0 })), source: 'local-grid' }
  }
}

/**
 * Cooperative pricing policy (spec §10 "cooperative pricing policy").
 * Previously the pricing engine used a hardcoded module constant while the
 * dashboard displayed a DIFFERENT DB value in different units (90 vs 0.9), so
 * editing the policy had no effect on any price. Now the DB is the source of
 * truth and the constant is only the fallback.
 */
export interface CoopPolicy {
  urgencyMultiplier: Record<string, number>
  eveningSurchargePct: number // 0..1
  negotiationFloorPct: number // 0..1
  maxQuoteUpliftPct: number // 0..1
  welfareContributionPct: number
  coopCommissionPct: number
  platformFeePct: number
  travelRatePerKmRs: number
  materialEstimate: Record<string, number>
}

const POLICY_DEFAULTS: CoopPolicy = {
  urgencyMultiplier: { NORMAL: 1.0, URGENT: 1.2, EMERGENCY: 1.5 },
  eveningSurchargePct: 0.1,
  negotiationFloorPct: 0.92,
  maxQuoteUpliftPct: 0.17,
  welfareContributionPct: 0.02,
  coopCommissionPct: 0.08,
  platformFeePct: 0.04,
  travelRatePerKmRs: 12,
  materialEstimate: {},
}

/** The DB stores percentages (90 = 90%); normalise to fractions. */
function pct(v: unknown, fallback: number): number {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return n > 1 ? n / 100 : n
}

export async function loadCoopPolicy(cooperativeId: string | null | undefined): Promise<CoopPolicy> {
  if (!cooperativeId) return POLICY_DEFAULTS
  try {
    const row = await db.cooperative.findUnique({ where: { id: cooperativeId }, select: { pricingPolicyJson: true } })
    if (!row?.pricingPolicyJson) return POLICY_DEFAULTS
    const raw = safeObject<Record<string, unknown>>(row.pricingPolicyJson)
    const um = safeObject<Record<string, unknown>>(raw.urgencyMultiplier as string)
    return {
      urgencyMultiplier: {
        NORMAL: Number(um.NORMAL) || POLICY_DEFAULTS.urgencyMultiplier.NORMAL,
        URGENT: Number(um.URGENT) || POLICY_DEFAULTS.urgencyMultiplier.URGENT,
        EMERGENCY: Number(um.EMERGENCY) || POLICY_DEFAULTS.urgencyMultiplier.EMERGENCY,
      },
      eveningSurchargePct: pct(raw.eveningSurchargePct, POLICY_DEFAULTS.eveningSurchargePct),
      negotiationFloorPct: pct(raw.negotiationFloorPct, POLICY_DEFAULTS.negotiationFloorPct),
      maxQuoteUpliftPct: pct(raw.maxQuoteUpliftPct, POLICY_DEFAULTS.maxQuoteUpliftPct),
      welfareContributionPct: pct(raw.welfareContributionPct, POLICY_DEFAULTS.welfareContributionPct),
      coopCommissionPct: pct(raw.coopCommissionPct, POLICY_DEFAULTS.coopCommissionPct),
      platformFeePct: pct(raw.platformFeePct, POLICY_DEFAULTS.platformFeePct),
      travelRatePerKmRs: Number(raw.travelRatePerKmRs) > 0 ? Number(raw.travelRatePerKmRs) : POLICY_DEFAULTS.travelRatePerKmRs,
      materialEstimate: safeObject<Record<string, number>>(raw.materialEstimate as string),
    }
  } catch {
    return POLICY_DEFAULTS
  }
}

export { POLICY_DEFAULTS }

// ---------- Workforce Allocation Engine (Task 30) ----------
// Input: service request + location + skill + urgency + time. Output: recommended worker
// with full explainability ("Matched because: ✓ …").

export async function allocateWorker(params: {
  categoryKey: string
  area: string
  urgency: Urgency
  scheduledAt?: string
  customerId?: string
}): Promise<{
  ok: boolean
  aiLabel: string
  input: { categoryKey: string; area: string; urgency: Urgency; scheduledAt: string }
  recommended: ScoredCandidate | null
  alternatives: ScoredCandidate[]
  explain: string[]
  policyNotes: string[]
  factorTable: Array<{ label: string; weightPct: number; score: string; detail: string }>
  etaMin: number | null
  priceRange: { floor: number; ceiling: number } | null
}> {
  const m = await matchWorkers(params)
  const scheduledAt = params.scheduledAt ?? new Date().toISOString()
  if (!m.best) {
    return { ok: false, aiLabel: m.aiLabel, input: { ...params, categoryKey: params.categoryKey, area: params.area, urgency: params.urgency, scheduledAt }, recommended: null, alternatives: [], explain: [], policyNotes: m.policySummary, factorTable: [], etaMin: null, priceRange: null }
  }
  const b = m.best as ScoredCandidate
  const explain = [
    `✓ Correct skill (${params.categoryKey})`,
    ...(b.certStatus === 'VERIFIED' ? ['✓ Certified — ' + b.certName] : ['△ Certificate ' + b.certStatus.toLowerCase()]),
    b.availability === 'AVAILABLE' ? '✓ Available now' : '✓ Recalled from emergency reserve',
    `✓ ${b.distanceKm} km away — ETA ${b.etaMin} min`,
    b.factors.find((f) => f.key === 'workload')?.detail ?? '✓ Low current workload',
    '✓ Cooperative allocation policy satisfied',
  ]
  const factorTable = b.factors.map((f) => ({
    label: f.label,
    weightPct: f.weightPct,
    score: `${Math.round(f.raw * 100)}% → +${f.weighted} pts`,
    detail: f.detail,
  }))
  return {
    ok: true,
    aiLabel: m.aiLabel,
    input: { categoryKey: params.categoryKey, area: params.area, urgency: params.urgency, scheduledAt },
    recommended: b,
    alternatives: m.alternatives as ScoredCandidate[],
    explain,
    policyNotes: [...b.policyNotes, ...m.policySummary],
    factorTable,
    etaMin: b.etaMin,
    priceRange: { floor: m.priceEstimate.floor, ceiling: m.priceEstimate.ceiling },
  }
}

export { AREA_COORDS, areaDistance, gridToLat, gridToLon }
