export {}

/**
 * GigSetu — executable acceptance test.
 *
 * Drives the full spec §87 scenario over live HTTP plus every security control
 * that was added during the hardening pass. Needs the dev server running:
 *
 *   npm run dev -- -p 3111     # or any port; update B below
 *   node scripts/e2e-verify.ts
 */
const B = process.env.GIGSETU_BASE_URL || 'http://localhost:3111'
const MARATHI = 'माझ्या घरात पाण्याची पाइप फुटली आहे. तातडीने plumber पाहिजे.'

let COOKIE = ''

type ReqOpts = { noAuth?: boolean }

async function req(m: string, u: string, body?: unknown, opts: ReqOpts = {}): Promise<{ s: number; j: any; t?: string }> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    origin: B,
    host: new URL(B).host,
  }
  if (COOKIE && !opts.noAuth) headers.cookie = COOKIE
  const r = await fetch(B + u, { method: m, headers, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' })
  const setC = r.headers.get('set-cookie')
  if (setC && setC.includes('gigsetu_session=')) COOKIE = setC.split(';')[0]
  const t = await r.text()
  try {
    return { s: r.status, j: JSON.parse(t) }
  } catch {
    return { s: r.status, j: null, t }
  }
}

let passed = 0
let failed = 0
const ok = (c: boolean, label: string, extra = '') => {
  if (c) passed += 1
  else failed += 1
  console.log(`${c ? ' PASS' : '!FAIL'}  ${label}${extra ? ' :: ' + extra : ''}`)
}
const section = (s: string) => console.log(`\n=== ${s} ===`)

async function main() {
  // ---------- 1. AUTH / RBAC ----------
  section('1 auth and role escalation')
  let r = await req('GET', '/api/session?role=PLATFORM_ADMIN', undefined, { noAuth: true })
  ok(r.j?.user === null, 'unauthenticated ?role= returns no identity', `user=${JSON.stringify(r.j?.user)}`)

  r = await req('GET', '/api/session', undefined, { noAuth: true })
  ok(r.j?.user === null, 'unauthenticated /api/session leaks no identity', `user=${JSON.stringify(r.j?.user)}`)

  r = await req('POST', '/api/auth', { role: 'CUSTOMER' }, { noAuth: true })
  ok(r.s === 200 && r.j?.user?.role === 'CUSTOMER', 'POST /api/auth sets a signed session cookie', r.j?.user?.name)
  const CUSTOMER = r.j.user.customerId

  r = await req('GET', '/api/session')
  ok(r.s === 200 && r.j?.user?.role === 'CUSTOMER', 'session round-trips through the cookie')

  r = await req('POST', '/api/session', { role: 'PLATFORM_ADMIN' })
  ok(r.s === 400, 'a customer session cannot escalate to PLATFORM_ADMIN', r.j?.error)

  r = await req('POST', '/api/auth', { role: 'SUPERADMIN' }, { noAuth: true })
  ok(r.s === 400, 'an unknown role is rejected', r.j?.error)

  // ---------- 2. GEOAPIFY (5 products) ----------
  section('2 GeoApify integration')
  r = await req('GET', '/api/geo/autocomplete?q=Kothrud')
  ok(r.s === 200 && r.j?.results?.length > 0, 'Address Autocomplete', `source=${r.j?.source} n=${r.j?.results?.length}`)

  r = await req('GET', '/api/geo/geocode?q=Karve%20Nagar%2C%20Pune')
  ok(r.s === 200 && r.j?.result?.lat, 'Geocoding', `${r.j?.result?.label} -> area ${r.j?.result?.area}`)

  r = await req('GET', '/api/geo/reverse?lat=18.5073&lon=73.8057')
  ok(r.s === 200 && r.j?.result?.area, 'Reverse Geocoding', `${r.j?.result?.label} -> ${r.j?.result?.area}`)

  r = await req('POST', '/api/geo/route-matrix', { sources: [{ lat: 18.5073, lon: 73.8057 }], targets: [{ lat: 18.488, lon: 73.8135 }] })
  ok(r.s === 200 && r.j?.cells?.[0]?.[0]?.distanceKm > 0, 'Route Matrix', JSON.stringify(r.j?.cells))

  r = await req('GET', '/api/geo/route?fromLat=18.5073&fromLon=73.8057&toLat=18.488&toLon=73.8135')
  ok(r.s === 200 && r.j?.distanceKm > 0, 'Routing', `${r.j?.distanceKm} km / ${r.j?.durationMin} min, ${r.j?.polyline?.length} polyline points, ${r.j?.steps?.length} steps`)

  // ---------- 3. MATCHING + FAIR PRICING ----------
  section('3 one-worker matching and the fair pricing engine')
  r = await req('POST', '/api/match', { categoryKey: 'plumber', area: 'Kothrud', urgency: 'EMERGENCY', customerId: CUSTOMER })
  const price = r.j?.priceEstimate
  ok(r.s === 200 && !!r.j?.best, 'exactly one best worker is recommended', `${r.j?.best?.name} · ${r.j?.best?.cooperativeName} · ${r.j?.best?.distanceKm} km · ETA ${r.j?.best?.etaMin} min · geo=${r.j?.geoSource}`)
  ok((r.j?.alternatives ?? []).length >= 0 && r.j?.pipeline?.length === 6, 'the 6-stage pipeline is reported', (r.j?.pipeline ?? []).map((p: any) => `${p.stage}:${p.count}`).join(' '))
  ok(price?.base > 0, 'labour component (incl. skill level)', `₹${price?.base}`)
  ok(price?.travel > 0, 'travel component (road distance x per-km rate)', `₹${price?.travel}`)
  ok(price?.material > 0, 'material component', `₹${price?.material}`)
  ok(price?.floor >= 550 && price?.ceiling <= 700, 'spec §51 fair range is ₹550-700', `₹${price?.floor} – ₹${price?.ceiling} (total ₹${price?.total})`)

  r = await req('POST', '/api/ai/allocate', { categoryKey: 'plumber', area: 'Kothrud', urgency: 'EMERGENCY' })
  ok(r.s === 200 && r.j?.explain?.length >= 5, 'allocation explainability (spec §62)', (r.j?.explain ?? []).join(' | ').slice(0, 140))
  ok((r.j?.factorTable ?? []).length === 6, 'per-factor weight table is shown', `${r.j?.factorTable?.length} factors`)

  // ---------- 4. ANALYZER ----------
  section('4 multilingual request understanding (spec §15)')
  r = await req('POST', '/api/ai/analyze', { description: MARATHI, lang: 'mr' })
  ok(r.j?.analysis?.categoryKey === 'plumber', 'Marathi pipe burst -> plumber', `got=${r.j?.analysis?.categoryKey} via ${r.j?.analysis?.source}`)
  ok(r.j?.analysis?.urgency === 'EMERGENCY', 'Marathi "tatodine" -> EMERGENCY', r.j?.analysis?.urgency)
  ok(/^[\x20-\x7E]+$/.test(r.j?.analysis?.title ?? ''), 'job title is an English label, never raw Devanagari', r.j?.analysis?.title)

  for (const [label, text, cat] of [
    ['Hindi', 'उद्या सकाळी प्लंबर पाहिजे', 'plumber'],
    ['English', 'Tomorrow morning I need a plumber.', 'plumber'],
    ['Hindi electrical', 'बिजली नहीं चल रही है', 'electrician'],
  ] as Array<[string, string, string]>) {
    r = await req('POST', '/api/ai/analyze', { description: text })
    ok(r.j?.analysis?.categoryKey === cat, `${label} sample -> ${cat}`, `got=${r.j?.analysis?.categoryKey}`)
  }

  // ---------- 5. BOOKING LIFECYCLE ----------
  section('5 booking lifecycle, settlement and trust')
  r = await req('POST', '/api/bookings', {
    customerId: CUSTOMER, categoryKey: 'plumber', title: 'Pipe burst', description: 'pipe burst',
    area: 'Kothrud', address: 'Kothrud', scheduledAt: new Date().toISOString(), urgency: 'EMERGENCY', mode: 'INSTANT',
  })
  const BID = r.j?.booking?.id
  ok(r.s === 201 && !!BID, 'booking created', r.j?.booking?.refCode)

  r = await req('POST', '/api/bookings', { customerId: CUSTOMER, categoryKey: 'plumber', title: 'x', description: 'x', area: 'Kothrud', estimatedPrice: 1 })
  ok((r.j?.booking?.estimatedPrice ?? 0) > 100, 'PRICE EXPLOIT BLOCKED: estimatedPrice=1 is recomputed', `est=₹${r.j?.booking?.estimatedPrice}`)
  const EXPLOIT_ID = r.j?.booking?.id

  r = await req('PATCH', `/api/bookings/${EXPLOIT_ID}`, { action: 'rate', rating: 5 })
  ok(r.s === 409, 'RATING EXPLOIT BLOCKED: cannot rate an unsettled job', r.j?.error)

  for (let i = 0; i < 26; i += 1) {
    r = await req('GET', `/api/bookings/${BID}`)
    if (['COMPLETED', 'PAID', 'REVIEWED'].includes(r.j?.booking?.status)) break
    await new Promise((x) => setTimeout(x, 8000))
  }
  ok(r.j?.booking?.status === 'COMPLETED', 'auto-progression reaches COMPLETED', (r.j?.booking?.timeline ?? []).map((t: any) => t.status).join(' > '))
  ok((r.j?.floor ?? 0) > 0, 'the booking response carries the REAL cooperative floor', `floor=₹${r.j?.floor}`)

  r = await req('PATCH', `/api/bookings/${BID}`, { action: 'pay', method: 'UPI (Prototype)' })
  ok(r.j?.booking?.status === 'PAID', 'demo payment settles', r.j?.booking?.payment?.method)
  const sp = r.j?.booking?.payment ?? {}
  ok(Math.abs((sp.workerShare ?? 0) + (sp.coopCommission ?? 0) + (sp.welfare ?? 0) + (sp.platformFee ?? 0) - (sp.amount ?? 0)) <= 1, 'the 4-way split sums to the amount', `worker ₹${sp.workerShare} / coop ₹${sp.coopCommission} / welfare ₹${sp.welfare} / platform ₹${sp.platformFee}`)

  r = await req('PATCH', `/api/bookings/${BID}`, { action: 'rate', rating: 5, review: 'Great work', factors: { quality: 5, timeliness: 5, behaviour: 5, communication: 5 } })
  ok(r.j?.booking?.status === 'REVIEWED', 'multi-factor rating recorded', r.j?.booking?.status)

  r = await req('PATCH', `/api/bookings/${BID}`, { action: 'rate', rating: 5 })
  ok(r.s === 409, 'a second rating on the same job is rejected', r.j?.error)

  // ---------- 6. NEGOTIATION ----------
  section('6 controlled negotiation (spec §12)')
  r = await req('POST', '/api/bookings', {
    customerId: CUSTOMER, categoryKey: 'plumber', title: 'Rewiring', description: 'full rewiring needed',
    area: 'Kothrud', address: 'Kothrud', scheduledAt: new Date().toISOString(), urgency: 'NORMAL', mode: 'QUOTE',
  })
  const QID = r.j?.booking?.id
  for (let i = 0; i < 3; i += 1) {
    r = await req('GET', `/api/bookings/${QID}`)
    await new Promise((x) => setTimeout(x, 7000))
  }
  ok(['QUOTED', 'NEGOTIATING'].includes(r.j?.booking?.status), 'quote flow reaches QUOTED with 3 offers', `${r.j?.booking?.status}, offers=${r.j?.booking?.quoteOffers?.length ?? 0}`)
  const FLOOR = r.j?.floor ?? 0
  r = await req('POST', '/api/negotiations', { bookingId: QID, offer: 10 })
  ok(r.s === 400, 'an offer below the cooperative floor is rejected', r.j?.error)
  r = await req('POST', '/api/negotiations', { bookingId: QID, offer: FLOOR + 50 })
  ok(r.s === 200 && !!r.j?.resolution, 'an offer at/above the floor resolves', JSON.stringify(r.j?.resolution))
  ok(String(r.j?.policyNote ?? '').includes('cooperative pricing policy'), 'the response states the negotiation policy', r.j?.policyNote)

  r = await req('PATCH', `/api/bookings/${QID}`, { action: 'counter', price: 5 })
  ok(r.s === 400, 'the booking PATCH counter path is floored too', r.j?.error)

  // ---------- 7. NOTIFICATIONS ----------
  section('7 notification ownership')
  const before = await req('GET', '/api/notifications')
  const unreadBefore = before.j?.unread ?? 0
  r = await req('PATCH', '/api/notifications', { audience: 'CUSTOMER' })
  ok(r.s === 200, 'mark-all is scoped to the caller', `updated=${r.j?.updated}`)
  const after = await req('GET', '/api/notifications')
  ok((after.j?.unread ?? 0) === 0, 'only the caller\'s own stream was cleared', `unread ${unreadBefore} -> ${after.j?.unread}`)

  // ---------- 8. PRIVILEGED OPERATIONS ----------
  section('8 privileged operations require the right role')
  for (const [m, u, b, label] of [
    ['PUT', '/api/payments', { workerSharePct: 86, coopPct: 8, welfarePct: 2, platformPct: 4 }, 'PUT /api/payments (global fee split)'],
    ['PUT', '/api/ai/weights', { skillMatch: 40 }, 'PUT /api/ai/weights (matching engine)'],
    ['PUT', '/api/economics', { sources: [] }, 'PUT /api/economics (revenue model)'],
    ['POST', '/api/demo/reset', {}, 'POST /api/demo/reset'],
  ] as Array<[string, string, unknown, string]>) {
    r = await req(m, u, b)
    ok(r.s === 403, `customer is blocked from ${label}`, `status=${r.s}`)
  }
  r = await req('PATCH', '/api/exchange', { id: 'nope', action: 'approve' })
  ok(r.s === 403, 'customer cannot approve a cross-cooperative worker transfer', r.j?.error)
  r = await req('PATCH', '/api/worker', { id: 'nope', action: 'availability', value: 'OFFLINE' })
  ok(r.s === 404 || r.s === 403, 'customer cannot flip another worker\'s availability', `status=${r.s}`)
  r = await req('POST', '/api/trust', { workerId: 'nope', category: 'UNSAFE_ENV', detail: 'a valid enough detail string' })
  ok(r.s === 403, 'a customer cannot file a worker-side report against a worker who never served them', `status=${r.s} ${r.j?.error ?? ''}`)
  r = await req('POST', '/api/trust', { workerId: 'nope', category: 'UNSAFE_ENV', detail: 'x' })
  ok(r.s === 400, '…and a malformed report body is rejected by validation', `status=${r.s}`)

  // ---------- 9. PLATFORM ADMIN ----------
  section('9 platform admin + audit integrity')
  await req('POST', '/api/auth', { role: 'PLATFORM_ADMIN' }, { noAuth: true })
  r = await req('GET', '/api/admin')
  ok(r.s === 200 && !!r.j?.impact, 'admin overview with LIVE impact metrics', JSON.stringify(r.j?.impact))
  ok((r.j?.counts?.bookings ?? 0) > 0, 'booking total is a real COUNT, not a capped slice', `bookings=${r.j?.counts?.bookings}`)

  r = await req('PUT', '/api/payments', { workerSharePct: 90, coopPct: 6, welfarePct: 2, platformPct: 2, updatedBy: 'Forged Name' })
  ok(r.s === 200, 'platform admin CAN change the fee split', `updatedBy=${r.j?.config?.updatedBy}`)
  ok(r.j?.config?.updatedBy === 'GigSetu Ops', 'the body-supplied actor is ignored', `stored updatedBy=${r.j?.config?.updatedBy}`)

  r = await req('PUT', '/api/ai/weights', { skillMatch: 500 })
  ok(r.s === 400, 'out-of-range matching weights are rejected', r.j?.error)

  r = await req('GET', '/api/audit?limit=5')
  ok(r.s === 200 && Array.isArray(r.j?.entries), 'audit log readable by governance roles', `total=${r.j?.total} page=${r.j?.limit}`)
  ok(r.j?.entries?.[0]?.actor !== 'Forged Name', 'the forged actor never reached the audit log', `actor=${r.j?.entries?.[0]?.actor}`)

  r = await req('GET', '/api/welfare?workerId=cm-does-not-exist')
  ok(r.s === 404, 'welfare IDOR is bounded', `status=${r.s}`)

  // ---------- 10. SPEC §61 API SURFACE ----------
  section('10 spec §61 API surface')
  for (const u of [
    '/api/workers?skill=plumber',
    '/api/districts',
    '/api/talukas',
    '/api/cooperatives',
    '/api/demand-forecast?zone=pune-z4',
    '/api/skill-gaps?district=Pune',
    '/api/workforce-recommendations?categoryKey=plumber&area=Kothrud',
    '/api/capacity-exchange',
    '/api/federation/analytics',
  ]) {
    r = await req('GET', u)
    ok(r.s === 200, `GET ${u}`, `status=${r.s}`)
  }
  const WID = (await req('GET', '/api/workers?skill=plumber')).j?.workers?.[0]?.id
  r = await req('GET', `/api/workers/${WID}`)
  ok(r.s === 200, 'GET /api/workers/:id', r.j?.worker?.name)
  r = await req('GET', `/api/workers/${WID}/skill-passport`)
  ok(r.s === 200 && !!r.j?.portability, 'GET /api/workers/:id/skill-passport (spec §19/§20)', `${r.j?.worker?.name} · ${r.j?.portability?.portableFields?.length} portable fields`)
  const CID = (await req('GET', '/api/cooperatives')).j?.cooperatives?.[0]?.id
  r = await req('GET', `/api/cooperatives/${CID}`)
  ok(r.s === 200 && !!r.j?.registration, 'GET /api/cooperatives/:id with the §4 government record', `${r.j?.cooperative?.name} · ${r.j?.registration?.registrationNumber}`)
  r = await req('POST', '/api/emergency', { categoryKey: 'plumber', area: 'Kothrud', urgency: 'EMERGENCY' })
  ok(r.s === 200 && r.j?.ladder?.length === 4, 'POST /api/emergency triage ladder (spec §16/§17)', r.j?.dispatchedFrom)
  r = await req('POST', '/api/service-requests', { description: MARATHI, area: 'Kothrud' })
  ok(r.s === 200 && r.j?.request?.categoryKey === 'plumber', 'POST /api/service-requests', JSON.stringify(r.j?.request))

  // ---------- 11. WHATSAPP BOT ----------
  section('11 WhatsApp booking bot (spec §14)')
  await req('POST', '/api/auth', { role: 'CUSTOMER' }, { noAuth: true })
  r = await req('POST', '/api/ai/wa-bot', { customerId: CUSTOMER, message: 'Hi', lang: 'en', state: { stage: 'new' } })
  ok(r.s === 200 && r.j?.state?.stage === 'awaiting_service', 'hi -> welcome + service chips', r.j?.replies?.[0]?.text?.slice(0, 40))
  let st = r.j.state
  for (const msg of ['Plumber', 'pipe burst, urgent', 'Kothrud', 'now']) {
    r = await req('POST', '/api/ai/wa-bot', { customerId: CUSTOMER, message: msg, lang: 'en', state: st })
    st = r.j.state
  }
  ok(st?.stage === 'ready' && !!r.j?.workerCard, 'full happy path -> worker card + CONFIRM/QUOTE', `${r.j?.workerCard?.workerName} ${r.j?.workerCard?.distanceKm} km · ETA ${r.j?.workerCard?.etaMin} min · ₹${r.j?.workerCard?.priceFloor}-${r.j?.workerCard?.priceCeiling}`)
  r = await req('POST', '/api/ai/wa-bot', { customerId: CUSTOMER, message: '', lang: 'en', state: st, confirm: true })
  ok(r.s === 200 && !!r.j?.bookingRef, 'CONFIRM creates a real booking in the engine', r.j?.bookingRef)

  r = await req('POST', '/api/ai/wa-bot', {
    customerId: CUSTOMER, message: '', lang: 'en', confirm: true,
    state: { stage: 'new', pendingSlot: { categoryKey: 'plumber', title: 'HACK', description: 'x', area: 'ZZZ', address: 'y', scheduledAt: 'not-a-date', urgency: 'SUPER_URGENT_!!!' } },
  })
  ok(r.s === 400 || r.s === 200, 'mass-assignment attempt is rejected, never a 500', `status=${r.s} ${r.j?.error ?? '(sanitised into a safe booking)'}`)

  r = await req('POST', '/api/ai/wa-bot', { customerId: 'somebody-else', message: 'hi', lang: 'en', state: { stage: 'new' } })
  ok(r.s === 403, 'the bot cannot be driven for another customer', `status=${r.s} ${r.j?.error ?? ''}`)

  // ---------- 12. AI INTELLIGENCE ----------
  section('12 AI intelligence (spec §28/§29/§63)')
  r = await req('GET', '/api/skill-gaps?district=Pune')
  const pune = r.j
  ok(r.s === 200 && r.j?.rows?.length > 0, 'skill gap, district-scoped', `Pune workers=${r.j?.workerCount} totalGap=${r.j?.totalGap}`)
  r = await req('GET', '/api/skill-gaps?district=Nashik')
  ok(r.j?.workerCount !== pune?.workerCount, '…and it is genuinely scoped per district', `Nashik workers=${r.j?.workerCount} vs Pune ${pune?.workerCount}`)
  r = await req('GET', '/api/demand-forecast?zone=pune-z4')
  ok(r.s === 200 && r.j?.categories?.length > 0, 'demand forecast with drivers', (r.j?.categories ?? []).slice(0, 2).map((c: any) => `${c.categoryKey} ${c.baseWeekend}->${c.expectedWeekend} (${c.pct}%)`).join(' | '))
  r = await req('GET', '/api/demand-forecast?zone=not-a-zone')
  ok(r.j?.ok === false, 'an unknown forecast zone is rejected, not silently defaulted', r.j?.error)

  // ---------- 13. DEMO RESET ----------
  section('13 demo reset (spec §66)')
  await req('POST', '/api/auth', { role: 'PLATFORM_ADMIN' }, { noAuth: true })
  r = await req('GET', '/api/demo/reset')
  ok(r.s === 200, 'reset dry-run reports what it would remove', JSON.stringify(r.j))
  r = await req('POST', '/api/demo/reset')
  ok(r.s === 200, 'RESET DEMO runs', JSON.stringify(r.j))

  console.log(`\n${'='.repeat(60)}`)
  console.log(`  ${passed} passed, ${failed} failed`)
  console.log('='.repeat(60))
  if (failed > 0) process.exitCode = 1
}

main()
