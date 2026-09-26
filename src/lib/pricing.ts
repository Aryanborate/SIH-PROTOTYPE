// GigSetu Fair Pricing Engine
//
// Spec §10 requires the estimate to account for:
//   service category · skill level · estimated labour time · distance/travel
//   · material requirement · urgency · cooperative pricing policy
//
// The previous engine only did category + labour time + urgency + evening, so
// the spec §51/§87 signature job (Kothrud emergency pipe burst) priced at
// ₹375 instead of the mandated ₹550–₹700. Travel and material are now real
// inputs, and the cooperative policy is read from the DATABASE (see
// loadCoopPolicy in matching.ts) instead of a duplicated module constant that
// disagreed with the dashboard in both value and units.

import type { PriceBreakdown, Urgency } from './types'

interface CategoryLike {
  key: string
  baseRate: number
  avgDurationMin: number
}

export interface PricingContext {
  /** Cooperative policy from the DB (fractions, not percentages). */
  policy?: {
    urgencyMultiplier: Record<string, number>
    eveningSurchargePct: number
    negotiationFloorPct: number
    maxQuoteUpliftPct: number
    welfareContributionPct?: number
    coopCommissionPct?: number
    platformFeePct?: number
    travelRatePerKmRs?: number
    materialEstimate?: Record<string, number>
  }
  /** Road distance from the matched worker's base area to the request. */
  distanceKm?: number
  /** Real driving duration when a routing provider answered. */
  travelMinutes?: number
  /** Worker's years of experience — the "skill level" input of §10. */
  skillYears?: number
  /** Explicit material requirement (₹) from the request or the AI analysis. */
  materialRs?: number
}

/**
 * Fallback policy when no cooperative row is available.
 *
 * These MUST stay identical to POLICY_DEFAULTS in matching.ts — that object is
 * the source of truth. They drifted apart (0.9/0.25 here vs 0.92/0.17 there),
 * which meant the fair-price floor and quote cap silently changed depending on
 * whether the cooperative's policy row happened to be readable.
 */
export const COOP_POLICY = {
  negotiationFloorPct: 0.92, // no deal below 92% of estimate — protects worker income
  maxQuoteUpliftPct: 0.17, // worker quotes can exceed estimate by at most 17%
  welfareContributionPct: 0.02,
  coopCommissionPct: 0.08,
  platformFeePct: 0.04,
  eveningSurchargePct: 0.1, // after 6pm
  travelRatePerKmRs: 12,
}

const DEFAULT_TRAVEL_RATE_PER_KM = 12

/**
 * Typical material outlay per trade (₹) for a household visit of the kind the
 * cooperative rate card prices. Prototype figures — clearly labelled as such
 * and overridable per cooperative via `pricingPolicyJson.materialEstimate`.
 */
export const MATERIAL_DEFAULTS: Record<string, number> = {
  plumber: 110, // PVC coupling / washer / seal tape
  electrician: 90, // MCB / switch / wire connector
  carpenter: 140, // hinges / screws / polish
  painter: 260, // putty, primer, emulsion sample
  cleaning: 70, // consumables & mops
  driver: 0,
  caregiver: 40, // hygiene consumables
  gardener: 85, // manure / compost / tools
  technician: 150, // fittings & brackets
  appliance: 180, // common spare (gasket, filter)
  other: 60,
}

/** Skill-level multiplier: 0 at <2 yrs, ramping to +18% at 12+ yrs. */
function skillMultiplier(years: number | undefined): number {
  if (!years || years <= 0) return 1
  if (years >= 12) return 1.18
  if (years >= 8) return 1.14
  if (years >= 5) return 1.1
  if (years >= 2) return 1.05
  return 1
}

export function isEvening(d: Date | string): boolean {
  const dt = typeof d === 'string' ? new Date(d) : d
  return dt.getHours() >= 18
}

/** Travel component: per-km cooperative rate, with a small first-2-km allowance. */
function travelFor(distanceKm: number, ratePerKm: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 0
  return Math.round(distanceKm * ratePerKm)
}

export function estimatePrice(
  category: CategoryLike,
  urgency: Urgency,
  scheduledAt: Date | string,
  estimatedMinutes?: number,
  ctx: PricingContext = {},
): PriceBreakdown {
  const p = ctx.policy
  const urgencyMult = p?.urgencyMultiplier?.[urgency] ?? ({ NORMAL: 1.0, URGENT: 1.2, EMERGENCY: 1.5 } as Record<Urgency, number>)[urgency]
  const eveningPct = p?.eveningSurchargePct ?? COOP_POLICY.eveningSurchargePct
  const floorPct = p?.negotiationFloorPct ?? COOP_POLICY.negotiationFloorPct
  const upliftPct = p?.maxQuoteUpliftPct ?? COOP_POLICY.maxQuoteUpliftPct
  const travelRate = p?.travelRatePerKmRs ?? DEFAULT_TRAVEL_RATE_PER_KM

  // --- 1. labour: base rate scaled by the estimated on-site duration ---
  const base = category.baseRate
  const mins = estimatedMinutes ?? category.avgDurationMin
  const durationFactor = Math.max(1, Math.min(2.5, mins / Math.max(30, category.avgDurationMin)))
  const skill = skillMultiplier(ctx.skillYears)
  const labour = Math.round(base * durationFactor * skill)

  // --- 2. travel: real road distance from the matched worker ---
  const travel = travelFor(ctx.distanceKm ?? 0, travelRate)

  // --- 3. material: trade default or an explicit request figure ---
  const material =
    typeof ctx.materialRs === 'number' && Number.isFinite(ctx.materialRs) && ctx.materialRs > 0
      ? Math.round(Math.min(ctx.materialRs, 20000))
      : Math.round(p?.materialEstimate?.[category.key] ?? MATERIAL_DEFAULTS[category.key] ?? 60)

  // --- 4. urgency + evening surcharges, applied to labour only ---
  const urgencySurcharge = Math.round(labour * (urgencyMult - 1))
  const evening = isEvening(scheduledAt)
  const eveningSurcharge = evening ? Math.round(labour * eveningPct) : 0

  const total = labour + travel + material + urgencySurcharge + eveningSurcharge
  return {
    base: labour,
    travel,
    material,
    urgencySurcharge,
    eveningSurcharge,
    total,
    // Floor and cap are rounded DOWN: never quote above the cooperative cap,
    // never demand above the floor the customer was shown.
    floor: Math.floor(total * floorPct),
    ceiling: Math.floor(total * (1 + upliftPct)),
    estimatedMinutes: mins,
    welfareNote: `${Math.round((p?.welfareContributionPct ?? COOP_POLICY.welfareContributionPct) * 100)}% of every payment goes to the worker welfare wallet`,
    policyNote: `Federation rate card · negotiation floor protects worker income (${Math.round(floorPct * 100)}% floor, +${Math.round(upliftPct * 100)}% quote cap)`,
  }
}

/** Settlement split (prototype default — the live split comes from FeeConfig). */
export function paymentSplit(amount: number) {
  const welfare = Math.round(amount * COOP_POLICY.welfareContributionPct)
  const coopCommission = Math.round(amount * COOP_POLICY.coopCommissionPct)
  const platformFee = Math.round(amount * COOP_POLICY.platformFeePct)
  const workerShare = amount - welfare - coopCommission - platformFee
  return { amount, workerShare, coopCommission, welfare, platformFee }
}

/**
 * Fair negotiation resolution (worker-side simulated agent).
 * Accepts if the offer is at or above the worker's last quote, meets in the
 * middle inside the cooperative band, or refuses anything under the floor.
 * The floor is ALWAYS passed in by the caller (it comes from the cooperative
 * policy) — this function never invents one.
 */
export function respondToCounter(
  offer: number,
  lastWorkerQuote: number,
  floor: number,
): { accepted: boolean; price: number; note: string } {
  if (offer >= lastWorkerQuote) return { accepted: true, price: lastWorkerQuote, note: 'Accepted your offer' }
  if (offer >= floor) {
    const meet = Math.round((offer + lastWorkerQuote) / 2)
    return { accepted: true, price: meet, note: 'We met in the middle — fair for both sides' }
  }
  const counter = Math.max(floor, Math.min(lastWorkerQuote, Math.round((offer + lastWorkerQuote) / 2)))
  return { accepted: false, price: counter, note: `Below cooperative floor (₹${floor}). Closest fair rate offered.` }
}
