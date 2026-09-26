// GigSetu WhatsApp Booking Bot engine (prototype)
// A booking assistant, not an FAQ bot: extracts a structured service request from
// free text in English / Hindi / Marathi (incl. Devanagari), asks ONLY for missing
// information, then surfaces a verified worker (ETA · fair price · cooperative · rating)
// and can create a REAL booking in the cooperative engine.
//
// PROTOTYPE LABEL: heuristic multilingual parser — designed for authorized WhatsApp
// Business API integration. No real WhatsApp infrastructure is used.

import { db } from './db'
import { matchWorkers, inferUrgency } from './matching'
import { generateRefCode } from './booking-engine'
import type { Lang, Urgency, WaBotResponse, WaQuickReply, WaWorkerCard } from './types'
import { DEMO_AREAS } from './types'

// ---------- multilingual dictionaries ----------

const SERVICE_WORDS: Record<string, string[]> = {
  electrician: ['electric', 'bijli', 'light', 'fan', 'mcb', 'switch', 'wiring', 'बिजली', 'बत्ती', 'इलेक्ट्रिक', 'वीज', 'लाईट', 'पंखा', 'एमसीबी', 'लाइट'],
  plumber: ['plumb', 'leak', 'tap', 'pipe', 'sink', 'drain', 'नळ', 'पाणी', 'प्लंब', 'गळत', 'नल', 'पानी', 'लीक', 'पाइप', 'लीकेज', 'सीलेज'],
  carpenter: ['carpent', 'door', 'furniture', 'wood', 'सुतार', 'दरवाजा', 'दारा', 'लाकूड', 'बढ़ई', 'फर्निचर'],
  painter: ['paint', 'रंग', 'पेंट', 'पेंटिंग', 'रंगाई'],
  cleaning: ['clean', 'सफाई', 'स्वच्छ', 'साफ', 'झाडू'],
  driver: ['driver', 'driv', 'गाडी', 'ड्राइवर', 'चालक', 'ड्राइवर'],
  caregiver: ['care', 'patient', 'elderly', 'aaji', 'देखभाल', 'नर्स', 'आज्जी', 'पालक', 'सेवक'],
  gardener: ['garden', 'plant', 'माळी', 'बाग', 'झाडे', 'गार्डन'],
  technician: ['technician', 'install', 'fitting', 'टेक्निशियन', 'इंस्टॉल', 'फिटिंग'],
  appliance: ['fridge', 'ac ', 'washing', 'geyser', 'microwave', 'फ्रिज', 'एसी', 'वॉशिंग', 'गीजर', 'उपकरण'],
}

const TIME_WORDS = {
  morning: ['morning', 'subah', 'सकाळी', 'सुबह', 'पहाटे'],
  afternoon: ['afternoon', 'dopahar', 'दुपारी', 'दोपहर'],
  evening: ['evening', 'shaam', 'संध्याकाळी', 'शाम', 'संध्या'],
  night: ['night', 'raat', 'रात्री', 'रात'],
}

const DATE_WORDS = {
  today: ['today', 'aaj', 'आज'],
  tomorrow: ['tomorrow', 'kal', 'उद्या', 'कल', 'उद्यां'],
  now: ['now', 'abhi', 'आत्ता', 'अभी', 'लगेच', 'तात्काळ'],
}

const EMERGENCY_WORDS = ['emergency', 'urgently', 'asap', 'turant', 'तातडीने', 'तातडीचे', 'तुरंत', 'आपत्कालीन', 'झटपट']

// script detection: Devanagari + Marathi/Hindi marker words
function detectLang(text: string, fallback: Lang): Lang {
  if (!/[\u0900-\u097F]/.test(text)) return fallback
  return isMarathi(text) ? 'mr' : isHindi(text) ? 'hi' : fallback
}
function isMarathi(t: string): boolean {
  return /(माझ्या|मला|पाहिजे|आहे|करा|द्या|घरी|कशाला|किती|उद्या|सकाळी|संध्याकाळी|आत्ता|हवा)/.test(t)
}
function isHindi(t: string): boolean {
  return /(मुझे|चाहिए|करो|दीजिए|घर|क्या|कितने|कल|सुबह|शाम|अभी|चाहिये|है)/.test(t)
}

function extractService(text: string): string | null {
  const d = text.toLowerCase()
  let best: { cat: string; len: number } | null = null
  for (const [cat, words] of Object.entries(SERVICE_WORDS)) {
    for (const w of words) {
      if (d.includes(w) && (!best || w.length > best.len)) best = { cat, len: w.length }
    }
  }
  return best?.cat ?? null
}

/** WaState is declared below; hoist the slot union so extractors stay typed. */
type TimeSlot = 'morning' | 'afternoon' | 'evening' | 'night'

function extractTimeOfDay(text: string): TimeSlot | null {
  const d = text.toLowerCase()
  for (const [slot, words] of Object.entries(TIME_WORDS)) {
    if (words.some((w) => d.includes(w))) return slot as TimeSlot
  }
  return null
}

function extractDateWord(text: string): 'today' | 'tomorrow' | 'now' | null {
  const d = text.toLowerCase()
  // 'kal subah' → tomorrow; check tomorrow before today
  if (DATE_WORDS.tomorrow.some((w) => d.includes(w))) return 'tomorrow'
  if (DATE_WORDS.now.some((w) => d.includes(w))) return 'now'
  if (DATE_WORDS.today.some((w) => d.includes(w))) return 'today'
  return null
}

function extractArea(text: string): string | null {
  const d = text.toLowerCase()
  for (const a of DEMO_AREAS) {
    if (d.includes(a.toLowerCase())) return a
  }
  return null
}

function extractProblem(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  return cleaned.length > 140 ? cleaned.slice(0, 137) + '…' : cleaned
}

// ---------- bot reply copy (en / mr / hi) ----------

const COPY = {
  welcome: [
    'Welcome to GigSetu 👋\nI can book a verified cooperative worker for you. What service do you need?',
    'गिगसेतू मध्ये स्वागत आहे 👋\nमी सत्यापित सहकारी कामगार बुक करून देऊ शकतो. तुम्हाला कोणती सेवा हवी आहे?',
    'गिगसेतू में आपका स्वागत है 👋\nमैं सत्यापित सहकारी कार्यकर्ता बुक कर सकता हूँ। आपको कौन सी सेवा चाहिए?',
  ],
  askService: [
    'What service do you need? Tap an option or just type it.',
    'तुम्हाला कोणती सेवा हवी आहे? पर्याय निवडा की टाइप करा.',
    'आपको कौन सी सेवा चाहिए? विकल्प चुनें या टाइप करें।',
  ],
  gotService: [
    'Noted: {service}. What is the problem? (e.g. "pipe leaking in kitchen")',
    'नोंदले: {service}. अडचण काय आहे? (उदा. "स्वयंपाकघरात नळ गळत आहे")',
    'नोट किया: {service}. समस्या क्या है? (जैसे "रसोई में पाइप लीक")',
  ],
  askLocation: [
    'Please share your location (area).',
    'कृपया तुमचे स्थान (क्षेत्र) सांगा.',
    'कृपया अपना स्थान (क्षेत्र) बताएं।',
  ],
  askTime: [
    'When do you need the worker?',
    'कामगार कधी हवा आहे?',
    'कार्यकर्ता कब चाहिए?',
  ],
  searching: [
    'Searching the cooperative network for a verified worker…',
    'सहकारी संस्थेत सत्यापित कामगार शोधत आहे…',
    'सहकारी नेटवर्क में सत्यापित कार्यकर्ता खोज रहा हूँ…',
  ],
  workerFound: [
    'Verified worker found {km} km away 👇',
    'सत्यापित कामगार {km} किमी अंतरावर सापडला 👇',
    'सत्यापित कार्यकर्ता {km} किमी दूर मिला 👇',
  ],
  noWorker: [
    'No verified worker is free for this slot right now. Try a nearby area or a different time — or call the cooperative helpline.',
    'या वेळेसाठी सत्यापित कामगार उपलब्ध नाही. जवळचे क्षेत्र किंवा वेगळी वेळ वापरा — किंवा सहकारी संस्थेशी संपर्क साधा.',
    'इस समय कोई सत्यापित कार्यकर्ता उपलब्ध नहीं है। पास का क्षेत्र या दूसरा समय आज़माएँ — या सहकारी हेल्पलाइन पर कॉल करें।',
  ],
  confirmed: [
    '✅ Booking confirmed! Ref {ref}\nThe cooperative office has dispatched your request. Track live status in the GigSetu app.',
    '✅ बुकिंग निश्चित झाली! रेफ {ref}\nसहकारी कार्यालयाने विनंती पाठवली आहे. गिगसेतू अ‍ॅपमध्ये थेट स्थिती पहा.',
    '✅ बुकिंग पुष्ट हो गई! रेफ {ref}\nसहकारी कार्यालय ने अनुरोध भेज दिया है। गिगसेतू ऐप में लाइव स्थिति देखें।',
  ],
  quoteRequested: [
    '📝 Quote request sent! Ref {ref}\nEligible workers will respond with fair-price quotes. Track it in the GigSetu app.',
    '📝 कोटेशन विनंती पाठवली! रेफ {ref}\nपात्र कामगार योग्य दराची कोटेशन देतील. गिगसेतू अ‍ॅपमध्ये पहा.',
    '📝 कोटेशन अनुरोध भेजा गया! रेफ {ref}\nपात्र कार्यकर्ते उचित मूल्य कोटेशन देंगे। गिगसेतू ऐप में देखें।',
  ],
  helper: [
    'I can book: Electrician · Plumber · Carpenter · Painter · Cleaning · Driver and more. Try: "kal subah plumber chahiye, pipe leak ho raha hai"',
    'मी बुक करू शकतो: इलेक्ट्रिशियन · प्लंबर · सुतार · रंगारी · सफाई · ड्रायव्हर. वापरा: "उद्या सकाळी प्लंबर पाहिजे, नळ गळत आहे"',
    'मैं बुक कर सकता हूँ: इलेक्ट्रीशियन · प्लंबर · बढ़ई · पेंटर · सफाई · ड्राइवर. लिखें: "कल सुबह प्लंबर चाहिए, पाइप लीक हो रहा है"',
  ],
}

const SERVICE_LABEL: Record<string, [string, string, string]> = {
  electrician: ['Electrician', 'इलेक्ट्रिशियन', 'इलेक्ट्रीशियन'],
  plumber: ['Plumber', 'प्लंबर', 'प्लंबर'],
  carpenter: ['Carpenter', 'सुतार', 'बढ़ई'],
  painter: ['Painter', 'रंगारी', 'पेंटर'],
  cleaning: ['Cleaning', 'सफाई', 'सफाई'],
  driver: ['Driver', 'ड्रायव्हर', 'ड्राइवर'],
  caregiver: ['Caregiver', 'देखभाल कर्ता', 'देखभालकर्ता'],
  gardener: ['Gardener', 'माळी', 'माली'],
  technician: ['Technician', 'तंत्रज्ञ', 'तकनीशियन'],
  appliance: ['Appliance repair', 'उपकरण दुरुस्ती', 'उपकरण मरम्मत'],
}

const TIME_LABEL: Record<string, [string, string, string]> = {
  now: ['Right now', 'आत्ताच', 'अभी'],
  today: ['Today', 'आज', 'आज'],
  tomorrow: ['Tomorrow', 'उद्या', 'कल'],
}

const copy = (key: keyof typeof COPY, lang: Lang, vars?: Record<string, string>) => {
  let s = COPY[key][lang === 'mr' ? 1 : lang === 'hi' ? 2 : 0]
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v)
  return s
}

// ---------- state ----------

export interface WaState {
  stage: 'new' | 'awaiting_service' | 'awaiting_problem' | 'awaiting_location' | 'awaiting_time' | 'ready' | 'done'
  categoryKey?: string
  problem?: string
  area?: string
  dateWord?: 'now' | 'today' | 'tomorrow'
  slot?: 'morning' | 'afternoon' | 'evening' | 'night'
  urgency?: Urgency
  pendingSlot?: WaBotResponse['pendingSlot']
  lastLang?: Lang
}

const VALID_STAGES: WaState['stage'][] = ['new', 'awaiting_service', 'awaiting_problem', 'awaiting_location', 'awaiting_time', 'ready', 'done']
const VALID_DATE_WORDS: NonNullable<WaState['dateWord']>[] = ['now', 'today', 'tomorrow']
const VALID_SLOTS: NonNullable<WaState['slot']>[] = ['morning', 'afternoon', 'evening', 'night']
const VALID_URGENCIES: Urgency[] = ['NORMAL', 'URGENT', 'EMERGENCY']

function isDateWord(v: unknown): v is NonNullable<WaState['dateWord']> {
  return typeof v === 'string' && (VALID_DATE_WORDS as string[]).includes(v)
}
function isSlot(v: unknown): v is NonNullable<WaState['slot']> {
  return typeof v === 'string' && (VALID_SLOTS as string[]).includes(v)
}

/**
 * SECURITY: rebuild the conversation state from an allowlist.
 *
 * The bot is intentionally stateless (the client echoes the state back), but an
 * unvalidated state let a caller pre-seed `pendingSlot` and bypass EVERY stage
 * guard, creating a booking for any customer/category/urgency/date. Now each
 * field is checked against its enum, the category must be a real rate card, the
 * urgency is clamped, and an unparseable date is replaced with "now".
 */
export function normalizeWaState(raw: unknown): WaState {
  const s = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined)
  const out: WaState = { stage: 'new' }
  out.stage = VALID_STAGES.includes(s.stage as WaState['stage']) ? (s.stage as WaState['stage']) : 'new'
  const cat = str(s.categoryKey, 40)
  if (cat && SERVICE_LABEL[cat]) out.categoryKey = cat
  const problem = str(s.problem, 600)
  if (problem) out.problem = problem
  const area = str(s.area, 120)
  if (area) out.area = area
  if (isDateWord(s.dateWord)) out.dateWord = s.dateWord
  if (isSlot(s.slot)) out.slot = s.slot
  if (VALID_URGENCIES.includes(s.urgency as Urgency)) out.urgency = s.urgency as Urgency
  if (s.lastLang === 'en' || s.lastLang === 'mr' || s.lastLang === 'hi') out.lastLang = s.lastLang

  const ps = (s.pendingSlot && typeof s.pendingSlot === 'object' ? s.pendingSlot : null) as Record<string, unknown> | null
  if (ps) {
    const pCat = str(ps.categoryKey, 40)
    const pArea = str(ps.area, 120)
    const when = new Date(typeof ps.scheduledAt === 'string' ? ps.scheduledAt : '')
    out.pendingSlot = {
      categoryKey: pCat && SERVICE_LABEL[pCat] ? pCat : out.categoryKey ?? 'other',
      title: str(ps.title, 160) || 'Service request',
      description: str(ps.description, 600) || '',
      area: pArea || out.area || 'Kothrud',
      address: str(ps.address, 300) || 'Address shared on WhatsApp — confirm on call',
      scheduledAt: (Number.isNaN(when.getTime()) ? new Date() : when).toISOString(),
      urgency: VALID_URGENCIES.includes(ps.urgency as Urgency) ? (ps.urgency as Urgency) : (out.urgency ?? 'NORMAL'),
    }
  }
  return out
}

const SERVICE_QUICK_REPLIES: WaQuickReply[] = [
  { label: '⚡ Electrician', value: 'Electrician' },
  { label: '💧 Plumber', value: 'Plumber' },
  { label: '🔨 Carpenter', value: 'Carpenter' },
  { label: '🎨 Painter', value: 'Painter' },
  { label: '✨ Cleaning', value: 'Cleaning' },
  { label: '🚗 Driver', value: 'Driver' },
  { label: '📋 Other', value: 'Other' },
]

function scheduledAtFor(dateWord: string | undefined, slot?: string): Date {
  const d = new Date()
  if (dateWord === 'tomorrow') d.setDate(d.getDate() + 1)
  const hour = slot === 'morning' ? 9 : slot === 'afternoon' ? 14 : slot === 'evening' ? 18 : slot === 'night' ? 20 : d.getHours() + 1
  d.setHours(hour, 0, 0, 0)
  return d
}

async function findWorkerCard(categoryKey: string, area: string, urgency: Urgency, scheduledAt: string): Promise<WaWorkerCard | null> {
  const m = await matchWorkers({ categoryKey, area, urgency, scheduledAt })
  if (!m.best) return null
  return {
    workerId: m.best.id,
    workerName: m.best.name,
    coopName: m.best.cooperativeName,
    rating: m.best.rating,
    distanceKm: m.best.distanceKm,
    etaMin: m.best.etaMin,
    priceFloor: m.priceEstimate.floor,
    priceCeiling: m.priceEstimate.ceiling,
    certStatus: m.best.certStatus,
  }
}

async function createBooking(
  customerId: string,
  state: WaState,
  mode: 'INSTANT' | 'QUOTE',
  lang: Lang,
  isDemoScript = false
): Promise<{ ref: string; id: string }> {
  const cat = state.categoryKey ?? 'other'
  const slot = state.pendingSlot ?? {
    categoryKey: cat,
    title: `${SERVICE_LABEL[cat]?.[0] ?? 'Service'} — WhatsApp booking`,
    description: state.problem ?? 'Booked via WhatsApp booking assistant',
    area: state.area ?? 'Kothrud',
    address: `${state.area ?? 'Kothrud'}, Pune (shared on WhatsApp — confirm on call)`,
    scheduledAt: scheduledAtFor(state.dateWord ?? 'now', state.slot).toISOString(),
    urgency: state.urgency ?? 'NORMAL',
  }
  // Defensive re-validation: normalizeWaState already allowlisted this, but the
  // booking row is the thing that must never contain an invalid date or an
  // out-of-enum urgency string.
  const when = new Date(slot.scheduledAt)
  const whenIso = (Number.isNaN(when.getTime()) ? new Date() : when).toISOString()
  const urgency: Urgency = VALID_URGENCIES.includes(slot.urgency) ? slot.urgency : 'NORMAL'
  const categoryKey = SERVICE_LABEL[slot.categoryKey] ? slot.categoryKey : 'other'

  const m = await matchWorkers({ categoryKey, area: slot.area, urgency, scheduledAt: whenIso })
  const ref = await generateRefCode()
  const row = await db.booking.create({
    data: {
      refCode: ref,
      customerId,
      categoryKey,
      title: slot.title.slice(0, 160),
      description: (slot.description + (state.problem ? `\n[WhatsApp] ${state.problem}` : '')).slice(0, 2000),
      area: slot.area,
      address: slot.address,
      scheduledAt: new Date(whenIso),
      urgency,
      mode,
      status: mode === 'QUOTE' ? 'QUOTE_REQUESTED' : 'REQUESTED',
      cooperativeId: m.best ? (await db.worker.findUnique({ where: { id: m.best.id }, select: { cooperativeId: true } }))?.cooperativeId ?? null : null,
      workerId: m.best?.id ?? null,
      estimatedPrice: mode === 'QUOTE' ? null : m.priceEstimate.total,
      lang,
      // Phase 6 #66: only the SIH demo engine flags its bookings so RESET DEMO
      // can remove them — genuine WhatsApp bookings are never auto-deleted.
      isDemoScript,
      timelineJson: JSON.stringify([
        { status: mode === 'QUOTE' ? 'QUOTE_REQUESTED' : 'REQUESTED', at: new Date().toISOString(), note: mode === 'QUOTE' ? 'Quote requested via WhatsApp booking assistant' : 'Booked via WhatsApp booking assistant' },
      ]),
      autoAcceptAt: mode === 'QUOTE' ? null : new Date(Date.now() + 8000),
      autoStageAt: mode === 'QUOTE' ? new Date(Date.now() + 6000) : null,
    },
  })
  return { ref: row.refCode, id: row.id }
}

export async function handleWaMessage(params: {
  message: string
  lang: Lang
  state: WaState
  customerId: string
  confirm?: boolean
  quote?: boolean
  /** true only when the SIH demo engine drives the conversation (#66 reset scope) */
  demoScript?: boolean
}): Promise<WaBotResponse> {
  const { message } = params
  let state: WaState = { ...params.state }
  // per-message language detection (user may switch)
  const lang: Lang = message ? detectLang(message, params.lang) : params.lang

  // explicit quick-reply / action paths
  if (params.confirm && state.pendingSlot) {
    const r = await createBooking(params.customerId, state, 'INSTANT', lang, params.demoScript)
    state = { ...state, stage: 'done' }
    return { ok: true, replies: [{ text: copy('confirmed', lang, { ref: r.ref }) }], quickReplies: [{ label: '🧾 Track booking', value: 'TRACK' }, { label: '➕ New booking', value: 'NEW' }], bookingRef: r.ref, bookingId: r.id, lang, state }
  }
  if (params.quote && state.pendingSlot) {
    const r = await createBooking(params.customerId, state, 'QUOTE', lang, params.demoScript)
    state = { ...state, stage: 'done' }
    return { ok: true, replies: [{ text: copy('quoteRequested', lang, { ref: r.ref }) }], quickReplies: [{ label: '🧾 Track booking', value: 'TRACK' }, { label: '➕ New booking', value: 'NEW' }], bookingRef: r.ref, bookingId: r.id, lang, state }
  }

  const text = (message ?? '').trim()
  if (!text || /^(hi|hello|hey|नमस्कार|नमस्ते|start|new)$/i.test(text) || text === 'NEW') {
    state = { stage: 'awaiting_service', lastLang: lang }
    return { ok: true, replies: [{ text: copy('welcome', lang) }], quickReplies: SERVICE_QUICK_REPLIES, lang, state, pendingSlot: null }
  }
  if (text === 'TRACK') {
    return { ok: true, replies: [{ text: copy('helper', lang) }], quickReplies: [{ label: '➕ New booking', value: 'NEW' }], lang, state: { stage: 'new' }, pendingSlot: null }
  }
  if (/help|madad|मदत|मदद/i.test(text)) {
    return { ok: true, replies: [{ text: copy('helper', lang) }], quickReplies: SERVICE_QUICK_REPLIES, lang, state }
  }

  // --- progressive extraction: always try to fill missing slots from any message ---
  const svc = extractService(text)
  if (svc && !state.categoryKey) state.categoryKey = svc
  if (!state.problem && text.length > 8 && svc) state.problem = extractProblem(text)
  const area = extractArea(text)
  if (area && !state.area) state.area = area
  const dateWord = extractDateWord(text)
  if (dateWord && !state.dateWord) state.dateWord = dateWord
  const slot = extractTimeOfDay(text)
  if (slot && !state.slot) state.slot = slot
  if (EMERGENCY_WORDS.some((w) => text.toLowerCase().includes(w))) state.urgency = 'EMERGENCY'
  else if (dateWord === 'now' && !state.urgency) state.urgency = 'URGENT'

  const replies: string[] = []
  let quickReplies: WaQuickReply[] = []
  let workerCard: WaWorkerCard | null = null

  // stage 1: service
  if (!state.categoryKey) {
    const svcFromButton = SERVICE_QUICK_REPLIES.find((q) => q.value.toLowerCase() === text.toLowerCase())
    const chosen = svcFromButton ? svcFromButton.value.toLowerCase() : null
    if (chosen && chosen !== 'other') state.categoryKey = chosen
    if (!state.categoryKey) {
      state.stage = 'awaiting_service'
      replies.push(copy(svcFromButton ? 'askService' : 'askService', lang))
      if (svcFromButton?.value === 'Other') {
        replies.push(copy('helper', lang))
      }
      return { ok: true, replies: replies.map((t) => ({ text: t })), quickReplies: SERVICE_QUICK_REPLIES, lang, state, pendingSlot: null }
    }
  }

  // stage 2: problem
  if (!state.problem) {
    state.stage = 'awaiting_problem'
    const sLabel = SERVICE_LABEL[state.categoryKey]?.[lang === 'mr' ? 1 : lang === 'hi' ? 2 : 0] ?? state.categoryKey
    replies.push(copy('gotService', lang, { service: sLabel }))
    return { ok: true, replies: replies.map((t) => ({ text: t })), quickReplies: [], lang, state, pendingSlot: null }
  }

  // stage 3: location
  if (!state.area) {
    state.stage = 'awaiting_location'
    replies.push(copy('askLocation', lang))
    return { ok: true, replies: replies.map((t) => ({ text: t })), quickReplies: [{ label: '📍 Kothrud', value: 'Kothrud' }, { label: '📍 Karve Nagar', value: 'Karve Nagar' }, { label: '📍 Aundh', value: 'Aundh' }, { label: '📍 Baner', value: 'Baner' }, { label: '📍 Hadapsar', value: 'Hadapsar' }], lang, state, pendingSlot: null }
  }

  // stage 4: time (only if not extracted)
  if (!state.dateWord) {
    state.stage = 'awaiting_time'
    replies.push(copy('askTime', lang))
    return { ok: true, replies: replies.map((t) => ({ text: t })), quickReplies: [{ label: '🌅 Tomorrow morning', value: 'tomorrow morning' }, { label: '🌆 Today evening', value: 'today evening' }, { label: '⚡ Right now', value: 'now' }], lang, state, pendingSlot: null }
  }

  // all slots filled → search worker
  if (state.stage !== 'ready') {
    state.stage = 'ready'
    replies.push(copy('searching', lang))
    const when = scheduledAtFor(state.dateWord, state.slot)
    const urgency = state.urgency ?? inferUrgency(state.problem ?? '')
    workerCard = await findWorkerCard(state.categoryKey!, state.area, urgency, when.toISOString())
    if (!workerCard) {
      return { ok: true, replies: [{ text: copy('noWorker', lang) }], quickReplies: [{ label: '➕ Try again', value: 'NEW' }], lang, state: { stage: 'awaiting_service' }, pendingSlot: null }
    }
    replies.push(copy('workerFound', lang, { km: String(workerCard.distanceKm) }))
    state.pendingSlot = {
      categoryKey: state.categoryKey!,
      title: `${SERVICE_LABEL[state.categoryKey!]?.[0] ?? 'Service'} — ${state.problem!.slice(0, 48)}`,
      description: state.problem!,
      area: state.area!,
      address: `${state.area}, Pune (shared on WhatsApp — confirm on call)`,
      scheduledAt: when.toISOString(),
      urgency,
    }
    return {
      ok: true,
      replies: replies.map((t) => ({ text: t })),
      quickReplies: [
        { label: '✅ CONFIRM BOOKING', value: 'CONFIRM', kind: 'primary' },
        { label: '📝 REQUEST QUOTE', value: 'QUOTE', kind: 'normal' },
      ],
      workerCard,
      pendingSlot: state.pendingSlot,
      lang,
      state,
    }
  }

  // already ready but user typed something else — re-show options
  return { ok: true, replies: [{ text: copy('helper', lang) }], quickReplies: [{ label: '✅ CONFIRM BOOKING', value: 'CONFIRM', kind: 'primary' }, { label: '📝 REQUEST QUOTE', value: 'QUOTE', kind: 'normal' }], workerCard, pendingSlot: state.pendingSlot ?? null, lang, state }
}
