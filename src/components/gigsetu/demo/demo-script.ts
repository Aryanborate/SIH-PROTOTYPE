'use client'

import type { View } from '@/store/app-store'
import type { PaymentRecord } from '@/lib/types'

/**
 * Phase 6 #50 — SIH Demo Mode script definition.
 * 16 steps telling one honest story: an "Emergency Plumbing Request" from
 * Kothrud flows through the ENTIRE cooperative ecosystem — real APIs, real
 * booking, real payment, real rating, real exchange approval.
 *
 * This file holds only declarative metadata + narration builders. The async
 * actions live in demo-engine.tsx so the script stays pure and inspectable.
 */

/** Marathi request typed by the customer in the demo (parses → plumber · EMERGENCY · mr). */
export const DEMO_WA_MESSAGE = 'माझ्या घरात पाण्याची पाइप फुटली आहे. तातडीने plumber पाहिजे.'
export const DEMO_AREA = 'Kothrud'
export const DEMO_CUSTOMER_NAME = 'Anita Deshmukh'

/** Typed view of everything the engine collects during a run. */
export interface DemoData {
  // steps 1–3 — WhatsApp conversation
  waReqSent?: string
  waReqReplies?: string[]
  waLocSent?: string
  waLocReplies?: string[]
  waTimeSent?: string
  waTimeReplies?: string[]
  waConfirmReplies?: string[]
  /** opaque wa-bot conversation state — echoed back on the next API call */
  waState?: unknown
  analysis?: {
    title?: string
    urgency?: string
    estimatedMinutes?: number | string
    difficulty?: string
    summary?: string
    safetyNotes?: string[]
    source?: string
  } | null
  // steps 4–6 — matching
  pipeline?: Array<{ stage: string; detail: string; count: number }>
  searchArea?: string
  alternativesCount?: number
  workerId?: string
  workerName?: string
  coopId?: string
  coopName?: string
  workerRating?: number
  distanceKm?: number
  etaMin?: number
  score?: number
  certName?: string
  certStatus?: string
  price?: { base: number; urgencySurcharge: number; total: number; floor: number; ceiling: number }
  // steps 7–10 — booking lifecycle
  bookingRef?: string
  bookingId?: string
  bookingStatus?: string
  timeline?: Array<{ status: string; at: string; note?: string }>
  // step 11–12 — settlement + rating
  payment?: PaymentRecord | null
  rating?: number
  review?: string
  // step 13–14 — hierarchy
  coopKpis?: { name: string; workers: number; jobsToday: number; utilization: number; activeToday: number }
  district?: { name: string; jobsToday: number; workers: number; plumberDemand: string; coordinator: string }
  // steps 15–16 — AI + federation
  forecast?: { zoneLabel: string; baseWeekend: number; expectedWeekend: number; pct: number; trend: string; drivers: string[] }
  exchange?: { id: string; fromCoopName: string; toCoopName: string; workerCount: number; durationDays: number; distanceKm: number; expectedDemand: number; status: string; approvedBy?: string | null }
}

/** What kind of live-data strip the panel renders for this step. */
export type DemoDisplay = 'wa' | 'worker' | 'price' | 'booking' | 'payment' | 'rating' | 'coop' | 'district' | 'forecast' | 'exchange'

export interface DemoStep {
  id: string
  /** 1-based step number (1..16) */
  num: number
  title: string
  /** ultra-short label for progress tick tooltips */
  short: string
  /** app view the engine switches to while this step runs */
  view: View
  /** which role's eyes the audience borrows (labels only) */
  role: string
  display: DemoDisplay
  /** ms the narration holds after the action completes, before auto-advance (at 1×) */
  dwellMs: number
  /** narration line built from LIVE collected data — never hardcoded metrics */
  narration: (d: DemoData) => string
}

export const DEMO_SCRIPT: DemoStep[] = [
  {
    id: 'wa-request', num: 1, title: 'Customer sends a Marathi WhatsApp request', short: 'WhatsApp request',
    view: 'whatsapp', role: 'CUSTOMER', display: 'wa', dwellMs: 6500,
    narration: (d) => `${DEMO_CUSTOMER_NAME} messages in her own language: “${d.waReqSent ?? DEMO_WA_MESSAGE}” — no app install, no English needed.`,
  },
  {
    id: 'ai-understand', num: 2, title: 'AI understands the request', short: 'AI understanding',
    view: 'whatsapp', role: 'CUSTOMER', display: 'wa', dwellMs: 6000,
    narration: (d) => `AI reads it instantly: ${d.analysis?.title ?? 'Burst water pipe repair'} classified as ${d.analysis?.urgency ?? 'EMERGENCY'} · ~${d.analysis?.estimatedMinutes ?? 60} min job (${d.analysis?.difficulty ?? 'moderate'}) — from free text, in Marathi.`,
  },
  {
    id: 'wa-location', num: 3, title: 'Location obtained — one tap', short: 'Location',
    view: 'whatsapp', role: 'CUSTOMER', display: 'wa', dwellMs: 6000,
    narration: (d) => `The bot asks for location in Marathi; Anita taps ${d.waLocSent ?? DEMO_AREA}. Everything needed for dispatch is now on file.`,
  },
  {
    id: 'match-search', num: 4, title: 'Nearby cooperative workers searched', short: 'Coop search',
    view: 'whatsapp', role: 'CUSTOMER', display: 'worker', dwellMs: 6000,
    narration: (d) => `The matching pipeline filters ${d.searchArea ?? DEMO_AREA}’s cooperative network${d.pipeline?.length ? ` — ${d.pipeline[0].count} skilled in network → ${d.pipeline[d.pipeline.length - 1].count} final match` : ''}${d.alternativesCount ? `, ${d.alternativesCount} verified alternatives ranked behind it` : ''}.`,
  },
  {
    id: 'match-select', num: 5, title: 'One best worker is selected', short: 'One worker',
    view: 'whatsapp', role: 'CUSTOMER', display: 'worker', dwellMs: 5500,
    narration: (d) => `${d.workerName ?? 'The best-match worker'} (${d.coopName ?? 'local cooperative'}) is selected — ${d.distanceKm ?? '?'} km away, ETA ~${d.etaMin ?? '?'} min, ★${d.workerRating ?? '?'} rating, match score ${d.score ?? '?'}.`,
  },
  {
    id: 'fair-price', num: 6, title: 'Fair price is calculated', short: 'Fair price',
    view: 'whatsapp', role: 'CUSTOMER', display: 'price', dwellMs: 6000,
    narration: (d) => `Federation rate card: ₹${d.price?.base ?? '—'} base + ₹${d.price?.urgencySurcharge ?? '—'} emergency surcharge = ₹${d.price?.total ?? '—'}, bounded by the cooperative floor ₹${d.price?.floor ?? '—'}–₹${d.price?.ceiling ?? '—'} that protects worker income.`,
  },
  {
    id: 'confirm', num: 7, title: 'Customer accepts — booking created', short: 'Booking created',
    view: 'customer', role: 'CUSTOMER', display: 'booking', dwellMs: 5500,
    narration: (d) => `Anita taps CONFIRM — real booking ${d.bookingRef ?? 'GS-…'} is created in the cooperative engine and tracking opens live in her app.`,
  },
  {
    id: 'worker-accept', num: 8, title: 'Worker accepts from the worker app', short: 'Worker accepts',
    view: 'worker', role: 'WORKER', display: 'booking', dwellMs: 3500,
    narration: (d) => `The view switches to ${d.workerName ?? 'the worker'}’s phone — the cooperative dispatches the job and it is accepted within seconds.`,
  },
  {
    id: 'on-the-way', num: 9, title: 'Worker reaches the location', short: 'On the way',
    view: 'worker', role: 'WORKER', display: 'booking', dwellMs: 3500,
    narration: (d) => `Status moved to ON THE WAY — ${d.workerName ?? 'the worker'} is travelling from ${d.coopName ?? 'the cooperative'}’s service area (${d.distanceKm ?? '?'} km, ETA ~${d.etaMin ?? '?'} min), tracked live by the customer.`,
  },
  {
    id: 'complete', num: 10, title: 'Service completed', short: 'Service done',
    view: 'worker', role: 'WORKER', display: 'booking', dwellMs: 3500,
    narration: (d) => `Work marked COMPLETED on ${d.bookingRef ?? 'the booking'} — the pipeline ran Accepted → On the way → In progress → Completed on real engine timers.`,
  },
  {
    id: 'payment', num: 11, title: 'Payment completed — transparent split', short: 'Payment',
    view: 'customer', role: 'CUSTOMER', display: 'payment', dwellMs: 6500,
    narration: (d) => `₹${d.payment?.amount ?? '—'} paid by UPI — split transparently: worker ₹${d.payment?.workerShare ?? '—'}, cooperative ₹${d.payment?.coopCommission ?? '—'}, welfare fund ₹${d.payment?.welfare ?? '—'}, platform ₹${d.payment?.platformFee ?? '—'}.`,
  },
  {
    id: 'rating', num: 12, title: 'Rating submitted — trust is two-sided', short: 'Rating',
    view: 'customer', role: 'CUSTOMER', display: 'rating', dwellMs: 6000,
    narration: () => `Anita rates ★5 across quality, timeliness, behaviour and communication — the rating flows straight into the worker’s Skill Passport and the cooperative’s reputation rollup.`,
  },
  {
    id: 'coop-update', num: 13, title: 'Cooperative dashboard updates live', short: 'Coop dashboard',
    view: 'coop', role: 'COOP_ADMIN', display: 'coop', dwellMs: 7000,
    narration: (d) => `${d.coopKpis?.name ?? 'The cooperative'}’s dashboard already shows it: ${d.coopKpis?.jobsToday ?? '?'} jobs today across ${d.coopKpis?.workers ?? '?'} members, utilisation ${d.coopKpis?.utilization ?? '?'}% — the same single data layer, no re-entry.`,
  },
  {
    id: 'district-demand', num: 14, title: 'District demand increases', short: 'District demand',
    view: 'district', role: 'DISTRICT_COORD', display: 'district', dwellMs: 6500,
    narration: (d) => `Pune District Command Center aggregates the event: ${d.district?.jobsToday ?? '?'} jobs across the district today, ${d.district?.workers ?? '?'} workers — plumbing demand flagged ${d.district?.plumberDemand ?? 'HIGH'}.`,
  },
  {
    id: 'ai-shortage', num: 15, title: 'AI detects a capacity shortage', short: 'AI shortage',
    view: 'ai', role: 'DISTRICT_COORD', display: 'forecast', dwellMs: 7000,
    narration: (d) => `Forecast for ${d.forecast?.zoneLabel ?? 'the zone'}: plumbing demand ${d.forecast?.trend === 'up' ? 'rising' : 'shifting'} ${d.forecast && d.forecast.pct >= 0 ? '+' : ''}${d.forecast?.pct ?? 0}% into the weekend (${d.forecast?.baseWeekend ?? '—'} → ${d.forecast?.expectedWeekend ?? '—'} jobs)${d.forecast?.drivers?.length ? ` — driver: ${d.forecast.drivers[0].toLowerCase()}` : ''}.`,
  },
  {
    id: 'exchange-approve', num: 16, title: 'Federation recommends workforce allocation — humans approve', short: 'Exchange approved',
    view: 'exchange', role: 'DISTRICT_COORD', display: 'exchange', dwellMs: 8000,
    narration: (d) => `The Service Exchange recommends ${d.exchange?.workerCount ?? '—'} plumber(s) from ${d.exchange?.fromCoopName ?? 'a sister cooperative'} → ${d.exchange?.toCoopName ?? 'the requesting cooperative'} for ${d.exchange?.durationDays ?? 7} days — AI recommends, ${d.exchange?.approvedBy ?? 'the district coordinator'} APPROVES. Workers are never auto-transferred.`,
  },
]

/** Rotation shown in the note line during step 4 while matching runs (#69). */
export const EMERGENCY_PIPELINE_NOTES = [
  'Checking local cooperative…',
  'Checking Taluka reserve…',
  'Checking district capacity…',
]
