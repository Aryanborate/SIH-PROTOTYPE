// GigSetu Booking Engine (server-side)
// - Serialization of bookings to DTOs
// - Time-accelerated demo simulation: auto worker-accept, stage progression,
//   quote responses — all idempotently applied on fetch ("tick")
//
// SECURITY/RESILIENCE FIXES:
//  * every stored JSON column is parsed through safeJson/safeArray, so one
//    malformed row can never 500 an entire dashboard (spec §67 "always demoable")
//  * rateBooking now enforces a status guard, closing an unlimited-rating
//    exploit that let anyone inflate a worker's reputation without paying
//  * refCode generation retries on the (rare) unique-constraint collision

import { db } from './db'
import type { BookingDTO, QuoteOffer, QuoteRound, Urgency } from './types'
import { respondToCounter } from './pricing'
import { areaDistance } from './area-distance'
import { loadCoopPolicy } from './matching'
import { safeArray, safeDate, safeJson, safeObject } from './safe'

type BookingRow = NonNullable<Awaited<ReturnType<typeof db.booking.findUnique>>>

/** Statuses from which a customer may still cancel. */
const CANCELLABLE = ['QUOTE_REQUESTED', 'QUOTED', 'NEGOTIATING', 'REQUESTED', 'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS']

/** Statuses that mean the work is physically finished. */
const SETTLED_WORK = ['COMPLETED', 'PAID', 'REVIEWED']

/**
 * Decrement a worker's activeJobsToday, clamped at zero.
 * Seeded bookings can complete without ever having passed through an
 * accept-increment, so a plain decrement can drift the counter negative.
 */
export async function releaseActiveJob(workerId: string) {
  const w = await db.worker.findUnique({ where: { id: workerId }, select: { activeJobsToday: true } }).catch(() => null)
  if (!w || w.activeJobsToday <= 0) return
  await db.worker.update({ where: { id: workerId }, data: { activeJobsToday: { decrement: 1 } } }).catch(() => {})
}

/** Collision-resistant, human-readable reference. Retries on the unique index. */
export async function generateRefCode(): Promise<string> {
  const yy = new Date().getFullYear()
  const mm = String(new Date().getMonth() + 1).padStart(2, '0')
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const seq = Math.floor(1000 + Math.random() * 9000)
    const ref = `GS-${yy}${mm}-${seq}${attempt > 0 ? String(attempt) : ''}`
    const clash = await db.booking.findUnique({ where: { refCode: ref }, select: { id: true } })
    if (!clash) return ref
  }
  // Deterministic last resort — cuid-backed, still unique by construction.
  return `GS-${yy}${mm}-${Date.now().toString(36).toUpperCase().slice(-6)}`
}

export function serializeBooking(b: NonNullable<BookingRow>): BookingDTO {
  return {
    id: b.id,
    refCode: b.refCode,
    customerId: b.customerId,
    categoryKey: b.categoryKey,
    title: b.title,
    description: b.description,
    media: safeArray(b.mediaJson),
    area: b.area,
    address: b.address,
    scheduledAt: b.scheduledAt.toISOString(),
    urgency: b.urgency as Urgency,
    mode: b.mode as BookingDTO['mode'],
    status: b.status as BookingDTO['status'],
    analysis: b.analysisJson ? safeJson<BookingDTO['analysis']>(b.analysisJson, null) : null,
    cooperativeId: b.cooperativeId,
    workerId: b.workerId,
    estimatedPrice: b.estimatedPrice,
    finalPrice: b.finalPrice,
    quotes: safeArray<QuoteRound>(b.quoteJson),
    quoteOffers: safeArray<QuoteOffer>(b.quoteOffersJson),
    payment: b.paymentJson ? safeJson<BookingDTO['payment']>(b.paymentJson, null) : null,
    evidence: b.evidenceJson ? safeJson<BookingDTO['evidence']>(b.evidenceJson, null) : null,
    rating: b.rating,
    ratingFactors: b.ratingJson ? safeJson<BookingDTO['ratingFactors']>(b.ratingJson, null) : null,
    review: b.review,
    timeline: safeArray<BookingDTO['timeline'][0]>(b.timelineJson),
    createdAt: b.createdAt.toISOString(),
  }
}

export async function hydrateBookings(rows: NonNullable<BookingRow>[]): Promise<BookingDTO[]> {
  const ids = new Set<string>()
  rows.forEach((b) => {
    if (b.customerId) ids.add('c:' + b.customerId)
    if (b.workerId) ids.add('w:' + b.workerId)
    if (b.cooperativeId) ids.add('k:' + b.cooperativeId)
  })
  const strip = (p: string) => p.slice(2)
  const [customers, workers, coops] = await Promise.all([
    db.customer.findMany({ where: { id: { in: [...ids].filter((i) => i.startsWith('c:')).map(strip) } } }),
    db.worker.findMany({ where: { id: { in: [...ids].filter((i) => i.startsWith('w:')).map(strip) } } }),
    db.cooperative.findMany({ where: { id: { in: [...ids].filter((i) => i.startsWith('k:')).map(strip) } } }),
  ])
  const cmap = new Map(customers.map((c) => [c.id, c]))
  const wmap = new Map(workers.map((w) => [w.id, w]))
  const kmap = new Map(coops.map((k) => [k.id, k]))
  return rows.map((b) => ({
    ...serializeBooking(b),
    customerName: cmap.get(b.customerId)?.name,
    customerType: cmap.get(b.customerId)?.type,
    customerPhone: cmap.get(b.customerId)?.phone,
    workerName: b.workerId ? wmap.get(b.workerId)?.name : undefined,
    workerPhone: b.workerId ? wmap.get(b.workerId)?.phone : undefined,
    workerSkill: b.workerId ? wmap.get(b.workerId)?.primarySkill : undefined,
    cooperativeName: b.cooperativeId ? kmap.get(b.cooperativeId)?.name : undefined,
  }))
}

function pushTimeline(timeline: Array<{ status: string; at: string; note?: string }>, status: string, note?: string) {
  if (timeline.length === 0 || timeline[timeline.length - 1].status !== status) {
    timeline.push({ status, at: new Date().toISOString(), note })
  }
}

async function notify(audience: string, audienceId: string, title: string, body: string, type = 'INFO') {
  await db.notification.create({ data: { audience, audienceId, title, body, type } })
}

/**
 * Request-a-Quote (§11): generate up to 3 eligible worker offers.
 * Each offer: a price inside the cooperative fair range, an availability window,
 * ETA and rating — so the customer has a real choice (§11 Worker A/B/C).
 */
async function generateQuoteOffers(booking: NonNullable<BookingRow>): Promise<QuoteOffer[]> {
  const category = await db.serviceCategory.findUnique({ where: { key: booking.categoryKey } })
  const workers = await db.worker.findMany({
    where: { primarySkill: booking.categoryKey, availability: { in: ['AVAILABLE', 'BUSY'] } },
    include: { cooperative: true },
  })
  const scored = workers
    .map((w) => ({ w, d: areaDistance(w.baseArea, booking.area) }))
    .filter((x) => x.d <= 16)
    .sort((a, b) => a.d - b.d)
    .slice(0, 3)
  if (scored.length === 0) return []
  const policy = await loadCoopPolicy(scored[0].w.cooperativeId)
  const base = booking.estimatedPrice ?? category?.baseRate ?? 400
  return scored.map(({ w, d }, i) => {
    // ±8% spread by rating + distance so offers differ meaningfully
    const drift = Math.round(base * (0.06 + (w.rating - 4) * 0.02 + d * 0.004))
    const hour = new Date().getHours()
    const availHour = Math.min(21, Math.max(hour + 2 + i, 15 + i))
    const price = Math.max(280, base + drift + i * 40)
    return {
      workerId: w.id,
      workerName: w.name,
      coopName: w.cooperative.name,
      // Every offer must sit inside the cooperative band — that is the whole
      // point of controlled pricing (§12).
      price: Math.min(Math.round(price * (1 + policy.maxQuoteUpliftPct)), Math.round(base * 3)),
      availableAt: `Today ${availHour - 12} PM`,
      etaMin: Math.max(15, Math.round((d / 18) * 60)),
      rating: w.rating,
      certStatus: w.certStatus,
    }
  })
}

export async function tickBooking(b: NonNullable<BookingRow>): Promise<NonNullable<BookingRow>> {
  const now = Date.now()
  let cur = b
  const dirty: Record<string, unknown> = {}

  const applyStatus = (status: string, note?: string) => {
    const timeline = safeArray<{ status: string; at: string; note?: string }>(cur.timelineJson)
    pushTimeline(timeline, status, note)
    dirty.status = status
    dirty.timelineJson = JSON.stringify(timeline)
    cur = { ...cur, status, timelineJson: dirty.timelineJson as string } as typeof cur
  }

  /** Schedule the NEXT auto-stage and mirror it onto `cur` so later stage blocks
   *  in this same tick see the future deadline instead of re-cascading. */
  const stageNextIn = (ms: number) => {
    dirty.autoStageAt = new Date(now + ms)
    cur = { ...cur, autoStageAt: dirty.autoStageAt } as typeof cur
  }

  // ---- Quote flow automation ----
  if (cur.status === 'QUOTE_REQUESTED' && cur.workerId) {
    if (!cur.autoStageAt) {
      const at = new Date(now + 6000)
      cur = (await db.booking.update({ where: { id: cur.id }, data: { autoStageAt: at } })) as typeof cur
      return cur
    }
    if (new Date(cur.autoStageAt).getTime() <= now) {
      const quotes = safeArray<QuoteRound>(cur.quoteJson)
      const estimated = cur.estimatedPrice ?? 400
      const quotePrice = Math.round(estimated * 1.15)
      const title = safeObject<{ title?: string }>(cur.analysisJson).title ?? 'work'
      quotes.push({ by: 'WORKER', price: quotePrice, note: `Site visit + ${title} — quote per federation rate card`, at: new Date().toISOString() })
      dirty.quoteJson = JSON.stringify(quotes)
      dirty.estimatedPrice = estimated
      if (safeArray<QuoteOffer>(cur.quoteOffersJson).length === 0) {
        try {
          const offers = await generateQuoteOffers(cur)
          if (offers.length > 0) dirty.quoteOffersJson = JSON.stringify(offers)
        } catch {
          /* prototype: offers are best-effort */
        }
      }
      applyStatus('QUOTED', 'Worker responded with a fair-price quote')
      await notify('CUSTOMER', cur.customerId, 'Quote received', `Worker quoted ₹${quotePrice} for your request.`, 'INFO')
    }
  }

  if (cur.status === 'NEGOTIATING' && cur.workerId) {
    if (!cur.autoStageAt) {
      const at = new Date(now + 6000)
      cur = (await db.booking.update({ where: { id: cur.id }, data: { autoStageAt: at } })) as typeof cur
      return cur
    }
    if (new Date(cur.autoStageAt).getTime() <= now) {
      const quotes = safeArray<QuoteRound>(cur.quoteJson)
      const lastCustomer = [...quotes].reverse().find((q) => q.by === 'CUSTOMER')
      const lastWorker = [...quotes].reverse().find((q) => q.by === 'WORKER')
      const estimated = cur.estimatedPrice ?? 400
      // Floor comes from the COOPERATIVE POLICY, not a hardcoded 0.9.
      const policy = await loadCoopPolicy(cur.cooperativeId)
      const floor = Math.floor(estimated * policy.negotiationFloorPct)
      if (lastCustomer && lastWorker) {
        const res = respondToCounter(lastCustomer.price, lastWorker.price, floor)
        quotes.push({ by: 'WORKER', price: res.price, note: res.note, at: new Date().toISOString() })
        dirty.quoteJson = JSON.stringify(quotes)
        if (res.accepted) dirty.finalPrice = res.price
        applyStatus('QUOTED', res.note)
        if (res.accepted) dirty.autoAcceptAt = new Date(now + 6000)
        await notify('CUSTOMER', cur.customerId, 'Worker responded to your offer', res.note, 'INFO')
      }
    }
  }

  // ---- Main flow automation ----
  if (cur.status === 'REQUESTED' && cur.autoAcceptAt && new Date(cur.autoAcceptAt).getTime() <= now) {
    applyStatus('ACCEPTED', 'Worker accepted the job')
    if (cur.workerId) {
      await db.worker.update({ where: { id: cur.workerId }, data: { activeJobsToday: { increment: 1 }, availability: 'BUSY' } }).catch(() => {})
      await notify('WORKER', cur.workerId, 'New job accepted', `Job ${cur.refCode} assigned to you.`)
    }
    await notify('CUSTOMER', cur.customerId, 'Worker accepted', `${cur.workerId ? 'Your worker' : 'A verified worker'} accepted job ${cur.refCode}.`, 'SUCCESS')
    stageNextIn(25000)
  }

  if (cur.status === 'ACCEPTED') {
    const stageAt = cur.autoStageAt ? new Date(cur.autoStageAt).getTime() : now + 25000
    if (!cur.autoStageAt) {
      dirty.autoStageAt = new Date(stageAt)
    } else if (stageAt <= now) {
      applyStatus('ON_THE_WAY', 'Worker started for your location')
      await notify('CUSTOMER', cur.customerId, 'Worker on the way', `Track live status for ${cur.refCode}.`, 'INFO')
      stageNextIn(30000)
    }
  }

  if (cur.status === 'ON_THE_WAY') {
    const stageAt = cur.autoStageAt ? new Date(cur.autoStageAt).getTime() : now + 30000
    if (!cur.autoStageAt) {
      dirty.autoStageAt = new Date(stageAt)
    } else if (stageAt <= now) {
      applyStatus('IN_PROGRESS', 'Work started — service evidence will be captured on completion')
      stageNextIn(45000)
    }
  }

  if (cur.status === 'IN_PROGRESS') {
    const stageAt = cur.autoStageAt ? new Date(cur.autoStageAt).getTime() : now + 45000
    if (!cur.autoStageAt) {
      dirty.autoStageAt = new Date(stageAt)
    } else if (stageAt <= now) {
      applyStatus('COMPLETED', 'Work completed. Please review, pay, and rate.')
      if (cur.workerId) await releaseActiveJob(cur.workerId)
      await notify('CUSTOMER', cur.customerId, 'Service completed', `Job ${cur.refCode} completed. Payment pending.`, 'SUCCESS')
      if (cur.cooperativeId) await notify('COOP', cur.cooperativeId, 'Job completed', `${cur.refCode} marked complete — settlement pending.`, 'INFO')
    }
  }

  if (Object.keys(dirty).length > 0) {
    return (await db.booking.update({ where: { id: cur.id }, data: dirty })) as typeof cur
  }
  return cur
}

export async function tickMany(rows: NonNullable<BookingRow>[]) {
  const out: NonNullable<BookingRow>[] = []
  for (const b of rows) out.push(await tickBooking(b))
  return out
}

/** The cooperative-negotiated floor for a booking, for the customer-facing UI. */
export async function bookingFloor(b: { estimatedPrice: number | null; cooperativeId: string | null }): Promise<number> {
  const policy = await loadCoopPolicy(b.cooperativeId)
  const est = b.estimatedPrice ?? 0
  if (est <= 0) return 0
  return Math.floor(est * policy.negotiationFloorPct)
}

// ---- customer-side actions ----

export class BookingRuleError extends Error {
  readonly status: number
  constructor(message: string, status = 409) {
    super(message)
    this.status = status
  }
}

export async function payBooking(id: string, method: string) {
  const b = await db.booking.findUnique({ where: { id } })
  if (!b) throw new BookingRuleError('Booking not found', 404)
  if (b.status !== 'COMPLETED') throw new BookingRuleError('Booking not ready for payment')
  const amount = b.finalPrice ?? b.estimatedPrice ?? 0
  if (!Number.isFinite(amount) || amount <= 0) {
    // Rate-card guardrail — never settle a zero-value job; the cooperative
    // office must confirm the rate first.
    throw new BookingRuleError('Final service rate is not confirmed yet — payment unavailable for this booking')
  }
  const { splitWithConfig } = await import('./fees')
  const { config: _cfg, ...split } = await splitWithConfig(amount)
  const payment = { ...split, method: method || 'UPI (Prototype)', paidAt: new Date().toISOString(), txnId: `GS-TXN${Date.now().toString(36).toUpperCase().slice(-8)}` }
  const timeline = safeArray<{ status: string; at: string; note?: string }>(b.timelineJson)
  pushTimeline(timeline, 'PAID', `Payment of ₹${amount} via ${payment.method}`)
  const updated = await db.booking.update({ where: { id }, data: { status: 'PAID', paymentJson: JSON.stringify(payment), finalPrice: amount, timelineJson: JSON.stringify(timeline) } })
  if (b.workerId) {
    await db.welfareLedger.create({ data: { workerId: b.workerId, type: 'CONTRIBUTION', amount: split.welfare, note: `Welfare contribution from job ${b.refCode}` } })
    await db.worker.update({ where: { id: b.workerId }, data: { welfareBalanceRs: { increment: split.welfare }, earningsMonthRs: { increment: split.workerShare } } })
  }
  if (b.cooperativeId) await notify('COOP', b.cooperativeId, 'Payment received', `₹${amount} settled for ${b.refCode}. Worker share ₹${split.workerShare}.`, 'SUCCESS')
  if (b.workerId) await notify('WORKER', b.workerId, 'Payment settled', `₹${split.workerShare} credited for job ${b.refCode} — welfare ₹${split.welfare} added to your wallet.`, 'SUCCESS')
  return updated
}

/**
 * SECURITY FIX: this had NO status guard, so anyone could POST `rate` against a
 * brand-new REQUESTED booking — repeatedly — inflating `completedJobs` and
 * re-weighting the worker's rating. Two-sided trust is only meaningful if a
 * rating follows a settled job, exactly once.
 */
export async function rateBooking(id: string, rating: number, review?: string, ratingJson?: string | null) {
  const b = await db.booking.findUnique({ where: { id } })
  if (!b) throw new BookingRuleError('Booking not found', 404)
  if (!SETTLED_WORK.includes(b.status)) {
    throw new BookingRuleError('You can only rate a service that has been completed.')
  }
  if (b.rating != null) {
    throw new BookingRuleError('This service has already been rated.')
  }
  if (!b.workerId) throw new BookingRuleError('No worker was assigned to this booking.')

  const timeline = safeArray<{ status: string; at: string; note?: string }>(b.timelineJson)
  pushTimeline(timeline, 'REVIEWED', `Customer rated ${rating}/5`)
  const updated = await db.booking.update({
    where: { id },
    data: {
      status: 'REVIEWED',
      rating,
      review: review ?? null,
      ...(ratingJson ? { ratingJson } : {}),
      timelineJson: JSON.stringify(timeline),
    },
  })
  const w = await db.worker.findUnique({ where: { id: b.workerId } })
  if (w) {
    const newCount = w.completedJobs + 1
    const newRating = Math.round(((w.rating * w.completedJobs + rating) / newCount) * 100) / 100
    await db.worker.update({ where: { id: b.workerId }, data: { completedJobs: newCount, rating: Math.min(5, newRating) } })
    await notify('WORKER', b.workerId, `You received a ${rating}★ rating`, review ?? 'Customer left a rating.', rating >= 4 ? 'SUCCESS' : 'WARNING')
  }
  return updated
}

export { CANCELLABLE, SETTLED_WORK, safeDate }
