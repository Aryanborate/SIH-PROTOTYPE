'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, signInAs } from '@/lib/api-client'
import { areaDistance } from '@/lib/area-distance'
import { useAppStore } from '@/store/app-store'
import { useDemoStore, DEMO_STEP_COUNT } from '@/store/demo-store'
import type { BookingDTO, DemoUser, MatchResponse, WaBotResponse } from '@/lib/types'
import { DEMO_SCRIPT, DEMO_AREA, DEMO_WA_MESSAGE, EMERGENCY_PIPELINE_NOTES, type DemoData } from './demo-script'

// Re-exported so the landing screen (task 15-c) can wire its START DEMO button
// to the exact same reset → login → start sequence used by the app header.
export { startSihDemo, stopSihDemo, resetDemoState } from './demo-launch'

const POLL_MS = 2000

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const d = () => useDemoStore.getState().data as DemoData
const put = (partial: Partial<DemoData>) => useDemoStore.getState().setData(partial as Record<string, unknown>)

/** Rotation helper for loading-state notes (#69). */
function rotatingNote(idx: number) {
  return EMERGENCY_PIPELINE_NOTES[idx % EMERGENCY_PIPELINE_NOTES.length]
}

/**
 * Phase 6 #50/#66/#69 — SIH Demo ENGINE.
 * Mounted ONCE inside app-shell. Watches the demo store and executes the
 * current step's action idempotently; polls the booking engine where the
 * story needs to wait for real time-accelerated progression; auto-advances
 * when `playing` after each step's dwell (scaled by speed).
 * Renders nothing — all UI lives in demo-panel.tsx.
 */
export function DemoEngine() {
  const qc = useQueryClient()
  const active = useDemoStore((s) => s.active)
  const phase = useDemoStore((s) => s.phase)
  const stepIndex = useDemoStore((s) => s.stepIndex)
  const runToken = useDemoStore((s) => s.runToken)
  const playing = useDemoStore((s) => s.playing)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stepDoneRef = useRef(-1)
  const runRef = useRef<{ token: number; step: number } | null>(null)
  const bookingInflight = useRef<Promise<{ bookingRef: string; bookingId: string }> | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const scheduleAdvance = useCallback(
    (holdMs: number) => {
      clearTimer()
      const s = useDemoStore.getState()
      if (!s.active || s.phase !== 'running' || !s.playing) return
      const atStep = s.stepIndex
      timerRef.current = setTimeout(() => {
        const cur = useDemoStore.getState()
        if (!cur.active || cur.phase !== 'running' || !cur.playing || cur.stepIndex !== atStep) return
        if (cur.stepIndex >= DEMO_STEP_COUNT - 1) cur.finish()
        else cur.next()
      }, Math.max(400, holdMs / (s.speed || 1)))
    },
    [clearTimer]
  )

  // ---------- small ensure-helpers (make every step idempotent + jump-safe) ----------

  const ensureCustomer = useCallback(async (): Promise<string> => {
    const app = useAppStore.getState()
    if (app.user?.role === 'CUSTOMER' && app.user.customerId) return app.user.customerId
    const res = await signInAs<{ ok: boolean; user: DemoUser }>('CUSTOMER')
    if (!res.user) throw new Error('Demo customer identity unavailable. Run: npm run db:seed')
    useAppStore.getState().login(res.user)
    if (!res.user.customerId) throw new Error('Demo customer identity has no customerId')
    return res.user.customerId
  }, [])

  /** Replay the WhatsApp conversation up to the "ready to confirm" state. */
  const ensureReadyWaState = useCallback(async (): Promise<Record<string, unknown>> => {
    const data = d()
    let state = (data.waState ?? null) as Record<string, unknown> | null
    if (!state) {
      // jumped straight here — replay the request message first
      const customerId = await ensureCustomer()
      const r1: WaBotResponse = await api.post('/api/ai/wa-bot', { customerId, message: DEMO_WA_MESSAGE, lang: 'mr', state: { stage: 'new' } })
      state = r1.state as Record<string, unknown>
      put({ waReqSent: DEMO_WA_MESSAGE, waReqReplies: r1.replies.map((x) => x.text), waState: state })
    }
    // walk the slot-filling machine until dispatch-ready (location → time → ready)
    for (let i = 0; i < 3; i += 1) {
      const st = state as { stage?: string }
      if (st.stage === 'ready') break
      const customerId = await ensureCustomer()
      if (st.stage === 'awaiting_time') {
        const r: WaBotResponse = await api.post('/api/ai/wa-bot', { customerId, message: 'now', lang: 'mr', state })
        state = r.state as Record<string, unknown>
        put({
          waTimeSent: '⚡ Right now',
          waTimeReplies: r.replies.map((x) => x.text),
          waState: state,
          ...(r.workerCard
            ? {
                workerId: r.workerCard.workerId,
                workerName: r.workerCard.workerName,
                coopName: r.workerCard.coopName,
                workerRating: r.workerCard.rating,
                distanceKm: r.workerCard.distanceKm,
                etaMin: r.workerCard.etaMin,
              }
            : {}),
        })
      } else {
        const r: WaBotResponse = await api.post('/api/ai/wa-bot', { customerId, message: `📍 ${DEMO_AREA}`, lang: 'mr', state })
        state = r.state as Record<string, unknown>
        put({
          waLocSent: `📍 ${DEMO_AREA}`,
          waLocReplies: r.replies.map((x) => x.text),
          waState: state,
          ...(r.workerCard
            ? {
                workerId: r.workerCard.workerId,
                workerName: r.workerCard.workerName,
                coopName: r.workerCard.coopName,
                workerRating: r.workerCard.rating,
                distanceKm: r.workerCard.distanceKm,
                etaMin: r.workerCard.etaMin,
              }
            : {}),
        })
      }
    }
    const final = state as { stage?: string }
    if (final.stage !== 'ready') throw new Error('WhatsApp assistant did not reach the ready-to-dispatch state')
    return state
  }, [ensureCustomer])

  /** Run the AI match (read-only) and collect the worker card + pipeline. */
  const ensureMatch = useCallback(async (): Promise<MatchResponse> => {
    const data = d()
    if (data.workerId && data.pipeline && data.price) {
      // already collected this run — no refetch needed
      return { ok: true, best: null, alternatives: [], priceEstimate: { base: data.price.base, urgencySurcharge: data.price.urgencySurcharge, eveningSurcharge: 0, total: data.price.total, floor: data.price.floor, ceiling: data.price.ceiling, estimatedMinutes: 0, welfareNote: '', policyNote: '' }, pipeline: data.pipeline, weights: undefined, aiLabel: '', policySummary: [] } as unknown as MatchResponse
    }
    const customerId = await ensureCustomer()
    const res: MatchResponse = await api.post('/api/match', { categoryKey: 'plumber', area: DEMO_AREA, urgency: 'EMERGENCY', customerId })
    if (!res.best) throw new Error('No cooperative worker matched for the demo scenario — check seed data (plumber in Kothrud).')
    put({
      pipeline: res.pipeline,
      searchArea: DEMO_AREA,
      alternativesCount: res.alternatives?.length ?? 0,
      workerId: res.best.id,
      workerName: res.best.name,
      coopName: res.best.cooperativeName,
      workerRating: res.best.rating,
      distanceKm: res.best.distanceKm,
      etaMin: res.best.etaMin,
      score: res.best.score,
      certName: res.best.certName,
      certStatus: res.best.certStatus,
      price: { base: res.priceEstimate.base, urgencySurcharge: res.priceEstimate.urgencySurcharge, total: res.priceEstimate.total, floor: res.priceEstimate.floor, ceiling: res.priceEstimate.ceiling },
    })
    return res
  }, [ensureCustomer])

  const ensureWorkerIdentity = useCallback(async (): Promise<{ workerId: string; coopId: string; coopName: string }> => {
    const data = d()
    if (data.workerId && data.coopId && data.coopName) return { workerId: data.workerId, coopId: data.coopId, coopName: data.coopName }
    await ensureMatch()
    const workerId = d().workerId
    if (!workerId) throw new Error('Matched worker unavailable')
    const res = await api.get<{ ok: boolean; worker: { id: string; name: string; primarySkill: string; emergencyPool: boolean }; cooperative: { id: string; name: string } }>(`/api/worker?id=${workerId}`)
    put({ coopId: res.cooperative.id, coopName: res.cooperative.name, workerName: res.worker.name })
    return { workerId: res.worker.id, coopId: res.cooperative.id, coopName: res.cooperative.name }
  }, [ensureMatch])

  /** Poll GET /api/bookings/[id] — each fetch ticks the time-accelerated engine forward.
   *  `isLive` keeps the loop running only while THIS step is still the current one;
   *  when the demo moves on (fast Next clicks) the poll stops silently so a stale
   *  poll can neither leak notes nor fire a timeout into a later step. */
  const pollBooking = useCallback(
    async (id: string, until: string[], opts: { timeoutMs: number; note?: (b: BookingDTO, elapsedS: number, polls: number) => string; isLive?: () => boolean }): Promise<BookingDTO> => {
      const started = Date.now()
      let polls = 0
      for (;;) {
        const res = await api.get<{ ok: boolean; booking: BookingDTO }>(`/api/bookings/${id}`)
        const b = res.booking
        polls += 1
        put({ bookingStatus: b.status, timeline: b.timeline })
        const elapsedS = Math.round((Date.now() - started) / 1000)
        if (opts.note && (!opts.isLive || opts.isLive())) useDemoStore.getState().setNote(opts.note(b, elapsedS, polls))
        if (until.includes(b.status)) return b
        if (opts.isLive && !opts.isLive()) return b // step moved on — the newer step owns the story now
        if (Date.now() - started > opts.timeoutMs) throw new Error(`Timed out waiting for booking status ${until.join(' / ')} (last: ${b.status})`)
        await sleep(POLL_MS)
      }
    },
    []
  )

  const getBooking = useCallback(async (id: string): Promise<BookingDTO> => {
    const res = await api.get<{ ok: boolean; booking: BookingDTO }>(`/api/bookings/${id}`)
    put({ bookingStatus: res.booking.status, timeline: res.booking.timeline })
    return res.booking
  }, [])

  const ensureBooking = useCallback(async (): Promise<{ bookingRef: string; bookingId: string }> => {
    const data = d()
    if (data.bookingId && data.bookingRef) return { bookingRef: data.bookingRef, bookingId: data.bookingId }
    // in-flight memo: fast Next clicks must never double-create the booking
    if (bookingInflight.current) return bookingInflight.current
    bookingInflight.current = (async (): Promise<{ bookingRef: string; bookingId: string }> => {
      const state = await ensureReadyWaState()
      const customerId = await ensureCustomer()
      const resp: WaBotResponse = await api.post('/api/ai/wa-bot', { customerId, confirm: true, state, demoScript: true })
      if (!resp.bookingRef || !resp.bookingId) throw new Error('Booking confirmation did not return a booking reference')
      put({
        bookingRef: resp.bookingRef,
        bookingId: resp.bookingId,
        waConfirmReplies: resp.replies.map((x) => x.text),
        bookingStatus: 'REQUESTED',
      })
      return { bookingRef: resp.bookingRef, bookingId: resp.bookingId }
    })()
    try {
      return await bookingInflight.current
    } finally {
      bookingInflight.current = null
    }
  }, [ensureCustomer, ensureReadyWaState])

  // ---------- the step executor ----------

  const runStep = useCallback(
    async (index: number) => {
      const step = DEMO_SCRIPT[index]
      if (!step) return
      useDemoStore.getState().setNote('')
      const app = useAppStore.getState()
      /** true while THIS step is still the live one (guards notes from stale async work) */
      const live = () => useDemoStore.getState().stepIndex === index && useDemoStore.getState().phase === 'running'

      switch (step.id) {
        // 1 — Customer sends the Marathi WhatsApp request
        case 'wa-request': {
          const customerId = await ensureCustomer()
          app.setView('whatsapp')
          const resp: WaBotResponse = await api.post('/api/ai/wa-bot', { customerId, message: DEMO_WA_MESSAGE, lang: 'mr', state: { stage: 'new' } })
          put({ waReqSent: DEMO_WA_MESSAGE, waReqReplies: resp.replies.map((x) => x.text), waState: resp.state })
          break
        }

        // 2 — AI understands (deep analysis of the same free text)
        case 'ai-understand': {
          // FIX: login() resets the view, so the WhatsApp view must be set AFTER
          // ensureCustomer(), otherwise the narration and the screen disagree.
          await ensureCustomer()
          app.setView('whatsapp')
          const res = await api.post<{ ok: boolean; analysis: DemoData['analysis'] }>('/api/ai/analyze', { description: DEMO_WA_MESSAGE, categoryKey: 'plumber', lang: 'mr' })
          put({ analysis: res.analysis })
          break
        }

        // 3 — Location obtained (one tap) → bot finds the worker
        case 'wa-location': {
          await ensureCustomer()
          app.setView('whatsapp')
          const state = await ensureReadyWaState()
          void state
          break
        }

        // 4 — Nearby cooperative workers searched (pipeline + #69 loading notes)
        case 'match-search': {
          await ensureCustomer()
          app.setView('whatsapp')
          let rot = 0
          useDemoStore.getState().setNote(rotatingNote(rot++))
          const rotation = setInterval(() => useDemoStore.getState().setNote(rotatingNote(rot++)), 600)
          try {
            const res = await ensureMatch()
            useDemoStore.getState().setNote(res.pipeline?.length ? `${res.pipeline[res.pipeline.length - 1].stage} — done` : '')
          } finally {
            clearInterval(rotation)
          }
          break
        }

        // 5 — One best worker selected
        case 'match-select': {
          await ensureCustomer()
          app.setView('whatsapp')
          await ensureMatch()
          break
        }

        // 6 — Fair price calculated (federation rate card)
        case 'fair-price': {
          await ensureCustomer()
          app.setView('whatsapp')
          await ensureMatch()
          break
        }

        // 7 — Customer accepts → REAL booking created, tracking opens in app
        case 'confirm': {
          const customerId = await ensureCustomer()
          const { bookingRef } = await ensureBooking()
          useAppStore.getState().openBookingByRef(bookingRef)
          void customerId
          qc.invalidateQueries()
          break
        }

        // 8 — Worker accepts (switch to the matched worker's phone; poll ACCEPTED)
        case 'worker-accept': {
          const { workerId, coopId, coopName } = await ensureWorkerIdentity()
          const res = await api.get<{ ok: boolean; worker: { id: string; name: string; primarySkill: string; emergencyPool: boolean; cooperativeId?: string } }>(`/api/worker?id=${workerId}`)
          const w = res.worker
          useAppStore.getState().login({
            id: w.id,
            name: w.name,
            role: 'WORKER',
            title: `${w.primarySkill.charAt(0).toUpperCase() + w.primarySkill.slice(1)} · ${w.emergencyPool ? 'emergency pool' : 'cooperative roster'}`,
            workerId: w.id,
            orgId: coopId,
            orgName: coopName,
          })
          const { bookingId } = await ensureBooking()
          await pollBooking(bookingId, ['ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS', 'COMPLETED', 'PAID', 'REVIEWED'], {
            timeoutMs: 30000,
            isLive: live,
            note: (b, s, polls) => (polls <= 1 ? 'Checking local cooperative…' : `Confirming worker acceptance… ${s}s (${b.status})`),
          })
          qc.invalidateQueries()
          break
        }

        // 9 — Worker on the way (poll through ON_THE_WAY)
        case 'on-the-way': {
          const { bookingId } = await ensureBooking()
          await pollBooking(bookingId, ['ON_THE_WAY', 'IN_PROGRESS', 'COMPLETED', 'PAID', 'REVIEWED'], {
            timeoutMs: 60000,
            isLive: live,
            note: (b, s) => `${d().workerName ?? 'Worker'} en route — live status ${b.status} · ${s}s`,
          })
          break
        }

        // 10 — Service completed (poll through IN_PROGRESS → COMPLETED)
        case 'complete': {
          const { bookingId } = await ensureBooking()
          await pollBooking(bookingId, ['COMPLETED', 'PAID', 'REVIEWED'], {
            timeoutMs: 110000,
            isLive: live,
            note: (b, s) => `Work in progress on site — live status ${b.status} · ${s}s`,
          })
          break
        }

        // 11 — Payment completed with transparent split
        case 'payment': {
          await ensureCustomer()
          const { bookingRef, bookingId } = await ensureBooking()
          useAppStore.getState().openBookingByRef(bookingRef)
          let b = await getBooking(bookingId)
          if (!['COMPLETED', 'PAID', 'REVIEWED'].includes(b.status)) {
            b = await pollBooking(bookingId, ['COMPLETED', 'PAID', 'REVIEWED'], { timeoutMs: 110000, isLive: live, note: (_bb, s) => `Waiting for service completion… ${s}s` })
          }
          if (b.status === 'COMPLETED') {
            useDemoStore.getState().setNote('Settling via the cooperative payment rail…')
            const res = await api.patch<{ ok: boolean; booking: BookingDTO }>(`/api/bookings/${bookingId}`, { action: 'pay', method: 'UPI (Demo Payment)' })
            put({ payment: res.booking.payment ?? null, bookingStatus: res.booking.status, timeline: res.booking.timeline })
          } else {
            put({ payment: b.payment ?? null })
          }
          qc.invalidateQueries()
          break
        }

        // 12 — Multi-factor rating submitted. The engine NEVER rates before the job
        // is settled: it waits for completion, pays if step 11 was skipped, then rates.
        case 'rating': {
          await ensureCustomer()
          const { bookingId } = await ensureBooking()
          const review = 'Fixed the burst pipe within the hour. Very professional — will call the cooperative again.'
          let b = await getBooking(bookingId)
          if (['REQUESTED', 'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS'].includes(b.status)) {
            b = await pollBooking(bookingId, ['COMPLETED', 'PAID', 'REVIEWED'], { timeoutMs: 110000, isLive: live, note: (_bb, s) => `Cooperative engine finishing the job… ${s}s` })
          }
          if (b.status === 'COMPLETED') {
            useDemoStore.getState().setNote('Settling via the cooperative payment rail…')
            const paid = await api.patch<{ ok: boolean; booking: BookingDTO }>(`/api/bookings/${bookingId}`, { action: 'pay', method: 'UPI (Demo Payment)' })
            put({ payment: paid.booking.payment ?? null, bookingStatus: paid.booking.status, timeline: paid.booking.timeline })
            b = paid.booking
          }
          if (b.status !== 'REVIEWED') {
            useDemoStore.getState().setNote('Submitting the two-sided trust rating…')
            const res = await api.patch<{ ok: boolean; booking: BookingDTO }>(`/api/bookings/${bookingId}`, {
              action: 'rate',
              rating: 5,
              review,
              factors: { quality: 5, timeliness: 5, behaviour: 5, communication: 5 },
            })
            put({ rating: res.booking.rating ?? 5, review, bookingStatus: res.booking.status, timeline: res.booking.timeline })
          } else {
            put({ rating: b.rating ?? 5, review: b.review ?? review })
          }
          qc.invalidateQueries()
          break
        }

        // 13 — Cooperative dashboard updates (drill into the matched worker's coop)
        case 'coop-update': {
          const { coopId } = await ensureWorkerIdentity()
          const res = await signInAs<{ ok: boolean; user: DemoUser }>('COOP_ADMIN')
          if (!res.user) throw new Error('COOP_ADMIN demo identity unavailable. Run: npm run db:seed')
          useAppStore.getState().login(res.user)
          useAppStore.getState().drillTo('coop', { coop: coopId })
          useDemoStore.getState().setNote('Opening the cooperative dashboard…')
          const coop = await api.get<{ ok: boolean; cooperative: { name: string; workerCount: number }; analytics: { jobsToday: number; utilization: number; activeToday: number } }>(`/api/coop?id=${coopId}`)
          put({
            coopKpis: {
              name: coop.cooperative.name,
              workers: coop.cooperative.workerCount,
              jobsToday: coop.analytics.jobsToday,
              utilization: coop.analytics.utilization,
              activeToday: coop.analytics.activeToday,
            },
          })
          qc.invalidateQueries()
          break
        }

        // 14 — District demand increases
        case 'district-demand': {
          const res = await signInAs<{ ok: boolean; user: DemoUser }>('DISTRICT_COORD')
          if (!res.user) throw new Error('DISTRICT_COORD demo identity unavailable. Run: npm run db:seed')
          useAppStore.getState().login(res.user)
          useAppStore.getState().drillTo('district', {})
          const districtId = res.user.districtId
          useDemoStore.getState().setNote('Aggregating taluka rollups…')
          const dash = await api.get<{ ok: boolean; district: { name: string; jobsToday: number; workers: number; coordinator: string; demandJson: Record<string, string> } }>(`/api/hierarchy/dashboard?level=district${districtId ? `&id=${districtId}` : ''}`)
          put({
            district: {
              name: dash.district.name,
              jobsToday: dash.district.jobsToday,
              workers: dash.district.workers,
              plumberDemand: dash.district.demandJson?.plumber ?? 'HIGH',
              coordinator: dash.district.coordinator,
            },
          })
          break
        }

        // 15 — AI detects capacity shortage (zone forecast)
        case 'ai-shortage': {
          useAppStore.getState().setView('ai')
          useDemoStore.getState().setNote('Running the demand forecast model…')
          const fc = await api.get<{
            ok: boolean
            label: string
            categories: Array<{ categoryKey: string; baseWeekend: number; expectedWeekend: number; pct: number; trend: string; drivers: string[] }>
          }>('/api/ai/forecast?zone=pune-z4')
          // FIX: an empty category list used to throw a TypeError and break step 15.
          const plumber = fc.categories.find((c) => c.categoryKey === 'plumber') ?? fc.categories[0]
          if (!plumber) {
            put({ forecast: { zoneLabel: fc.label, baseWeekend: 0, expectedWeekend: 0, pct: 0, trend: 'flat', drivers: [] } })
            break
          }
          put({ forecast: { zoneLabel: fc.label, baseWeekend: plumber.baseWeekend, expectedWeekend: plumber.expectedWeekend, pct: plumber.pct, trend: plumber.trend, drivers: plumber.drivers } })
          break
        }

        // 16 — Federation recommends allocation; a HUMAN approves
        case 'exchange-approve': {
          useAppStore.getState().setView('exchange')
          const { coopName } = await ensureWorkerIdentity()
          const data = d()
          if (data.exchange?.id) {
            if (data.exchange.status !== 'APPROVED') {
              await api.patch('/api/exchange', { id: data.exchange.id, action: 'approve', by: 'Meera Kulkarni · Pune District Coordinator (demo)' })
              put({ exchange: { ...data.exchange, status: 'APPROVED', approvedBy: 'Meera Kulkarni · Pune District Coordinator (demo)' } })
            }
            qc.invalidateQueries()
            break
          }
          const fcst = data.forecast
          const shortfall = fcst ? Math.max(0, fcst.expectedWeekend - fcst.baseWeekend) : 0
          const workerCount = Math.min(6, Math.max(2, Math.ceil(shortfall / 2) || 3))
          const expectedDemand = fcst?.expectedWeekend ?? 0
          const pct = fcst?.pct ?? 0
          useDemoStore.getState().setNote('Registering the recommendation…')
          const rec = await api.post<{ ok: boolean; recommendation: { id: string } }>('/api/exchange', {
            skill: 'plumber',
            fromCoopName: 'Maval Pani-Puravanch Shramik Sahakari Sanstha',
            toCoopName: coopName,
            districtName: 'Pune',
            workerCount,
            distanceKm: areaDistance('Maval Market', DEMO_AREA),
            expectedDemand,
            durationDays: 7,
            rationale: `Zone 4 weekend plumbing demand up ${pct}% (${fcst?.baseWeekend ?? '—'} → ${fcst?.expectedWeekend ?? '—'} jobs). Mutual-aid deputation protects emergency response time — AI recommends, humans approve.`,
            demo: true,
          })
          useDemoStore.getState().setNote('Awaiting human approval…')
          await api.patch('/api/exchange', { id: rec.recommendation.id, action: 'approve', by: 'Meera Kulkarni · Pune District Coordinator (demo)' })
          put({
            exchange: {
              id: rec.recommendation.id,
              fromCoopName: 'Maval Pani-Puravanch Shramik Sahakari Sanstha',
              toCoopName: coopName,
              workerCount,
              durationDays: 7,
              distanceKm: areaDistance('Maval Market', DEMO_AREA),
              expectedDemand,
              status: 'APPROVED',
              approvedBy: 'Meera Kulkarni · Pune District Coordinator (demo)',
            },
          })
          qc.invalidateQueries()
          break
        }

        default:
          throw new Error(`Unknown demo step: ${step.id}`)
      }
    },
    [ensureBooking, ensureCustomer, ensureMatch, ensureReadyWaState, ensureWorkerIdentity, getBooking, pollBooking, qc]
  )

  // ---- engine effect: execute the current step whenever it becomes due ----
  useEffect(() => {
    if (!active || phase !== 'running') return
    if (runRef.current && runRef.current.token === runToken && runRef.current.step === stepIndex) return
    runRef.current = { token: runToken, step: stepIndex }
    stepDoneRef.current = -1
    clearTimer()
    let alive = true
    runStep(stepIndex)
      .then(() => {
        if (!alive) return
        const s = useDemoStore.getState()
        if (!s.active || s.phase !== 'running' || s.stepIndex !== stepIndex) return
        stepDoneRef.current = stepIndex
        scheduleAdvance(DEMO_SCRIPT[stepIndex]?.dwellMs ?? 4000)
      })
      .catch((e: unknown) => {
        if (!alive) return
        // a stale step (judge already clicked Next) must never fail the whole demo
        const s = useDemoStore.getState()
        if (!s.active || s.phase !== 'running' || s.stepIndex !== stepIndex) return
        const msg = e instanceof Error ? e.message : 'Step failed'
        useDemoStore.getState().setNote('Step interrupted — press Retry (Next) to run it again.')
        useDemoStore.getState().fail(msg)
      })
    return () => {
      alive = false
    }
  }, [active, phase, stepIndex, runToken, runStep, scheduleAdvance, clearTimer])

  // ---- resume auto-advance when Play is pressed after the action already finished ----
  useEffect(() => {
    if (!playing) {
      clearTimer()
      return
    }
    const s = useDemoStore.getState()
    if (!s.active || s.phase !== 'running') return
    if (stepDoneRef.current === s.stepIndex && !timerRef.current) scheduleAdvance(DEMO_SCRIPT[s.stepIndex]?.dwellMs ?? 4000)
  }, [playing, scheduleAdvance, clearTimer])

  useEffect(() => clearTimer, [clearTimer])

  return null
}
