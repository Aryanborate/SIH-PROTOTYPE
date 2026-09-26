'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, inr, timeAgo } from '@/lib/api-client'
import { t } from '@/lib/i18n'
import { useAppStore } from '@/store/app-store'
import { SectionCard, KpiCard, StatusChip, EmptyState } from '../shared/ui-kit'
import { BookingFlow } from './booking-flow'
import { BookingDetail } from './booking-detail'
import { ReceiptDialog } from './receipt'
import { DiagnoseDialog } from './diagnose-dialog'
import { EmergencyEscalationPanel } from './emergency-escalation'
import { MaintenancePanel } from './maintenance-panel'
import { InstitutionPortal } from './institution-portal'
import { AmcPanel } from './amc-panel'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { DEMO_AREAS, type BookingDTO, type DemoUser, type ServiceCategoryDTO } from '@/lib/types'
import {
  Zap, Droplets, Hammer, Paintbrush, Sparkles, Car, HeartHandshake, Leaf, Wrench, Refrigerator,
  MoreHorizontal, Search, MapPin, Siren, Clock, Wallet, LifeBuoy, ChevronRight, Loader2, PhoneCall, Languages, ShieldCheck, Star, ReceiptText, History, RotateCcw, ClipboardCheck, Building2, ScrollText,
} from 'lucide-react'

const ICONS: Record<string, React.ReactNode> = {
  electrician: <Zap className="h-5 w-5" />, plumber: <Droplets className="h-5 w-5" />,
  carpenter: <Hammer className="h-5 w-5" />, painter: <Paintbrush className="h-5 w-5" />,
  cleaning: <Sparkles className="h-5 w-5" />, driver: <Car className="h-5 w-5" />,
  caregiver: <HeartHandshake className="h-5 w-5" />, gardener: <Leaf className="h-5 w-5" />,
  technician: <Wrench className="h-5 w-5" />, appliance: <Refrigerator className="h-5 w-5" />,
  other: <MoreHorizontal className="h-5 w-5" />,
}

const MR_SAMPLES = [
  'माझ्या घरात फक्त आता फॅन आणि लाईट बंद पडले आहेत. MCB वारंवार ट्रिप होत आहे. तातडीने इलेक्ट्रिशियन हवा आहे.',
  'स्वयंपाकघराच्या नळातून पाणी गळत आहे, आज संध्याकाळी कोणीतरी पाहू द्या.',
]

/** Greeting name: institutions keep their full org name, people get their first name (honorific-aware). */
function shortGreetingName(user: DemoUser): string {
  if (user.role === 'INSTITUTION') return user.name
  const stripped = user.name.replace(/^(dr\.?|mr\.?|mrs\.?|ms\.?|shri|smt\.?|st\.?)\s+/i, '')
  const first = stripped.split(' ')[0] ?? user.name
  return first.length >= 3 ? first : user.name
}

const FAQS = [
  { q: 'How is the price decided?', a: 'Every job is priced from the federation rate card — visit base + estimated work, with capped urgency/evening surcharges. Workers cannot overcharge and customers cannot underpay below the cooperative floor that protects worker income.' },
  { q: 'Can I choose the same worker again?', a: 'The matching engine recommends ONE best verified worker each time. After a service you rated highly, cooperative dispatch keeps your feedback on file — repeat requests are honoured whenever that worker is available.' },
  { q: 'What if something goes wrong during the service?', a: 'Service evidence (notes + completion photo) is captured on site. Raise a complaint via the cooperative helpdesk — serious complaints are escalated to the taluka committee and tracked on the cooperative dashboard until resolved.' },
  { q: 'Where does the money go?', a: '≈86% goes directly to the worker, 8% to the cooperative for operations, 2% to the worker welfare fund (accidents, skill training, family support) and 4% platform fee. The split is printed on every receipt.' },
  { q: 'Is my location data safe?', a: 'Your address is shared with the assigned worker only after they accept the job (prototype privacy rule). The cooperative stores the minimum needed to verify service delivery.' },
]

export function CustomerApp({ user }: { user: DemoUser }) {
  const { lang } = useAppStore()
  const focusBookingRef = useAppStore((s) => s.focusBookingRef)
  const clearFocusBooking = useAppStore((s) => s.clearFocusBooking)
  const [tab, setTab] = useState('home')
  const [flowCategory, setFlowCategory] = useState<string | null>(null)
  const [flowOpen, setFlowOpen] = useState(false)
  const [emergency, setEmergency] = useState(false)
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [area, setArea] = useState('Kothrud')
  const [gpsNote, setGpsNote] = useState<string | null>(null)
  const [gpsBusy, setGpsBusy] = useState(false)
  /** Problem text carried over from the Diagnose-before-dispatch consult (spec §13). */
  const [prefillDescription, setPrefillDescription] = useState<string | null>(null)
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL')
  const [historySearch, setHistorySearch] = useState('')
  const [receiptBooking, setReceiptBooking] = useState<BookingDTO | null>(null)
  const [diagnoseOpen, setDiagnoseOpen] = useState(false)
  const [escDemoCat, setEscDemoCat] = useState('electrician')

  const catsQ = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<{ ok: boolean; categories: ServiceCategoryDTO[] }>('/api/categories'),
  })

  const bookingsQ = useQuery({
    queryKey: ['bookings', user.customerId],
    queryFn: () => api.get<{ ok: boolean; bookings: BookingDTO[] }>(`/api/bookings?customerId=${user.customerId}`),
    refetchInterval: 6000,
  })

  const bookings = bookingsQ.data?.bookings ?? []
  const active = useMemo(() => bookings.filter((b) => !['REVIEWED', 'CANCELLED', 'PAID'].includes(b.status) && b.status !== 'COMPLETED'), [bookings])
  const completed = useMemo(() => bookings.filter((b) => ['COMPLETED', 'PAID', 'REVIEWED'].includes(b.status)), [bookings])
  const paidTotal = bookings.filter((b) => b.payment).reduce((s, b) => s + (b.payment?.amount ?? 0), 0)

  // Actionable nudges: completed-but-unpaid first, then paid-but-unrated
  const needsPayment = useMemo(() => bookings.filter((b) => b.status === 'COMPLETED'), [bookings])
  const needsRating = useMemo(() => bookings.filter((b) => b.status === 'PAID'), [bookings])

  const filteredCats = (catsQ.data?.categories ?? []).filter((c) => {
    const q = search.trim().toLowerCase()
    if (!q) return true
    // FIX: unguarded .toLowerCase() on six API fields threw a TypeError on every
    // keystroke whenever a translation was missing. Fall back to the English text.
    return [c.nameEn, c.nameMr, c.nameHi, c.descEn, c.descMr, c.descHi]
      .filter((v): v is string => typeof v === 'string' && v.length > 0)
      .some((v) => v.toLowerCase().includes(q))
  })

  function openFlow(key: string, isEmergency = false, areaOverride?: string) {
    setFlowCategory(key)
    setEmergency(isEmergency)
    if (areaOverride) setArea(areaOverride)
    setFlowOpen(true)
  }

  /**
   * FIX: this called navigator.geolocation and then DISCARDED the fix, so the UI
   * said "Using current location" while the booking still used the previously
   * selected area. The coordinates are now reverse-geocoded (GeoApify, with an
   * offline grid fallback) and the resolved locality actually becomes the area.
   */
  function useCurrentLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsNote('GPS unavailable on this device — using the selected area (prototype)')
      return
    }
    setGpsBusy(true)
    setGpsNote('Locating you…')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude
          const lon = pos.coords.longitude
          const res = await api.get<{ source: string; result: { area: string; label: string } | null }>(
            `/api/geo/reverse?lat=${lat.toFixed(6)}&lon=${lon.toFixed(6)}`,
          )
          const resolved = res.result?.area
          if (resolved) setArea(resolved)
          setGpsNote(
            res.result
              ? `Using current location — ${res.result.label} (${res.source === 'geoapify' ? 'reverse geocoded' : 'offline estimate'})`
              : 'GPS fix received but no locality resolved — using the selected area',
          )
        } catch (e) {
          setGpsNote(`Could not resolve the GPS fix (${(e as Error).message}) — using the selected area`)
        } finally {
          setGpsBusy(false)
        }
      },
      (err) => {
        setGpsBusy(false)
        setGpsNote(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied — pick your area manually'
            : 'GPS unavailable — using the selected area (prototype)',
        )
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    )
  }

  const selectedBookingBase = bookings.find((b) => b.id === selectedBookingId) ?? null
  // Notification deep-link: a clicked bell row pins the referenced booking open in Track Booking
  // (derived, takes precedence until the ref is cleared by Back / row click / manual tab change).
  const focusBooking = focusBookingRef ? bookings.find((x) => x.refCode === focusBookingRef) ?? null : null
  const selectedBooking = focusBooking ?? selectedBookingBase

  /** Open a booking from any list/nudge — also consumes any pending notification deep-link. */
  function openBooking(id: string) {
    setSelectedBookingId(id)
    clearFocusBooking()
  }
  const visibleHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase()
    return [...active, ...completed]
      .filter((b) => historyFilter === 'ALL' || (historyFilter === 'ACTIVE' ? active.includes(b) : completed.includes(b)))
      .filter((b) => !q || [b.title, b.refCode, b.area, b.workerName ?? '', b.status].some((v) => v.toLowerCase().includes(q)))
  }, [active, completed, historyFilter, historySearch])

  // One-tap rebook chips: most recent completed booking per service category (max 5)
  const rebookables = useMemo(() => {
    const byCat = new Map<string, BookingDTO>()
    for (const b of completed) {
      if (b.categoryKey && !byCat.has(b.categoryKey)) byCat.set(b.categoryKey, b)
    }
    return Array.from(byCat.values()).slice(0, 5)
  }, [completed])

  const catName = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of catsQ.data?.categories ?? []) {
      m.set(c.key, lang === 'mr' ? c.nameMr : lang === 'hi' ? c.nameHi : c.nameEn)
    }
    return m
  }, [catsQ.data, lang])

  if (flowOpen && flowCategory) {
    return (
      <BookingFlow
        user={user}
        categoryKey={flowCategory}
        area={area}
        emergency={emergency}
        initialDescription={prefillDescription ?? undefined}
        onClose={() => {
          setPrefillDescription(null)
          setFlowOpen(false)
        }}
        onBooked={(id) => {
          setFlowOpen(false)
          openBooking(id)
          setTab('bookings')
          bookingsQ.refetch()
        }}
      />
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {user.role === 'INSTITUTION' && (
        <div className="rounded-xl border border-primary/30 bg-accent px-4 py-2.5 text-sm">
          <span className="font-semibold">{user.name}</span> — {t('ipBanner', lang)}
        </div>
      )}

      <Tabs value={focusBooking ? 'bookings' : tab} onValueChange={(v) => { setTab(v); clearFocusBooking() }}>
        {user.role === 'INSTITUTION' ? (
          <TabsList className="flex w-full overflow-x-auto p-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-700">
            <TabsTrigger value="home" className="shrink-0 gap-1.5 px-3 text-xs sm:text-sm"><Search className="h-3.5 w-3.5" /> {t('home', lang)}</TabsTrigger>
            <TabsTrigger value="bookings" className="shrink-0 gap-1.5 px-3 text-xs sm:text-sm"><Clock className="h-3.5 w-3.5" /> {t('trackBooking', lang)} {active.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{active.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="institution" className="shrink-0 gap-1.5 px-3 text-xs sm:text-sm"><Building2 className="h-3.5 w-3.5" /> {t('ipTab', lang)}</TabsTrigger>
            <TabsTrigger value="contracts" className="shrink-0 gap-1.5 px-3 text-xs sm:text-sm"><ScrollText className="h-3.5 w-3.5" /> {t('amcTab', lang)}</TabsTrigger>
            <TabsTrigger value="payments" className="shrink-0 gap-1.5 px-3 text-xs sm:text-sm"><Wallet className="h-3.5 w-3.5" /> {t('payments', lang)}</TabsTrigger>
            <TabsTrigger value="support" className="shrink-0 gap-1.5 px-3 text-xs sm:text-sm"><LifeBuoy className="h-3.5 w-3.5" /> {t('support', lang)}</TabsTrigger>
            <TabsTrigger value="maintenance" className="shrink-0 gap-1.5 px-3 text-xs sm:text-sm"><ClipboardCheck className="h-3.5 w-3.5" /> {t('pmTab', lang)}</TabsTrigger>
          </TabsList>
        ) : (
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="home" className="gap-1.5 text-xs sm:text-sm"><Search className="h-3.5 w-3.5" /> {t('home', lang)}</TabsTrigger>
            <TabsTrigger value="bookings" className="gap-1.5 text-xs sm:text-sm"><Clock className="h-3.5 w-3.5" /> {t('trackBooking', lang)} {active.length > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{active.length}</Badge>}</TabsTrigger>
            <TabsTrigger value="payments" className="gap-1.5 text-xs sm:text-sm"><Wallet className="h-3.5 w-3.5" /> {t('payments', lang)}</TabsTrigger>
            <TabsTrigger value="support" className="gap-1.5 text-xs sm:text-sm"><LifeBuoy className="h-3.5 w-3.5" /> {t('support', lang)}</TabsTrigger>
          </TabsList>
        )}

        {/* HOME */}
        <TabsContent value="home" className="space-y-5 pt-2">
          {(needsPayment.length > 0 || needsRating.length > 0) && (
            <div className="space-y-2" aria-label="Pending actions">
              {needsPayment.slice(0, 1).map((b) => (
                <button
                  key={b.id}
                  onClick={() => { openBooking(b.id); setTab('bookings') }}
                  className="flex w-full items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-left transition hover:border-amber-400 hover:bg-amber-100/70 dark:border-amber-800 dark:bg-amber-950/40 dark:hover:bg-amber-950/70"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white"><Wallet className="h-4.5 w-4.5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{t('payNudgeTitle', lang)} · {b.workerName ?? b.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{b.title} · {inr(b.finalPrice ?? b.estimatedPrice ?? 0)} · transparent cooperative split</span>
                  </span>
                  <span className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white">{t('payNudgeCta', lang)}</span>
                </button>
              ))}
              {needsRating.slice(0, 1).map((b) => (
                <button
                  key={b.id}
                  onClick={() => { openBooking(b.id); setTab('bookings') }}
                  className="flex w-full items-center gap-3 rounded-xl border border-primary/30 bg-accent px-4 py-3 text-left transition hover:border-primary/60"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Star className="h-4.5 w-4.5 fill-current" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{t('rateNudgeTitle', lang)}</span>
                    <span className="block truncate text-xs text-muted-foreground">{b.title} · {b.workerName ?? 'your worker'} — ratings feed worker & cooperative performance</span>
                  </span>
                  <span className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">{t('rateNudgeCta', lang)}</span>
                </button>
              ))}
            </div>
          )}

          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-amber-500 p-5 text-primary-foreground shadow-sm">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-[0.15]"
              style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '14px 14px' }}
            />
            <div className="relative">
              <p className="text-sm opacity-90">Namaskar, {shortGreetingName(user)} 👋</p>
              <h2 className="mt-1 text-xl font-bold leading-snug">{t('tagline', lang)}</h2>
            </div>
            <div className="relative mt-3 flex flex-wrap items-center gap-2">
              <Select value={area} onValueChange={setArea}>
                <SelectTrigger className="h-9 w-[190px] border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground" aria-label={t('location', lang)}>
                  <MapPin className="h-4 w-4" /><SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEMO_AREAS.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="secondary" size="sm" className="h-9 bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25" disabled={gpsBusy}
                onClick={useCurrentLocation}
              >
                <MapPin className="mr-1 h-3.5 w-3.5" /> {t('currentLocation', lang)}
              </Button>
              {gpsNote && <span className="text-[11px] opacity-90">{gpsNote}</span>}
            </div>
          </div>

          <Button
            variant="destructive"
            size="lg"
            className="w-full justify-between text-left"
            onClick={() => openFlow('electrician', true)}
          >
            <span className="flex items-center gap-2.5">
              <Siren className="h-5 w-5 animate-pulse" />
              <span>
                <span className="block font-bold">{t('emergency', lang)} — priority dispatch</span>
                <span className="block text-xs opacity-90">{t('emergencySub', lang)}</span>
              </span>
            </span>
            <ChevronRight className="h-5 w-5" />
          </Button>

          {/* Diagnose before dispatch — secondary consult entry (Task 13) */}
          <button
            type="button"
            onClick={() => setDiagnoseOpen(true)}
            className="flex min-h-[44px] w-full items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 text-left transition hover:border-primary/50 hover:bg-accent/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary"><PhoneCall className="h-4.5 w-4.5" /></span>
              <span className="min-w-0">
                <span className="block text-sm font-bold">{t('dgTitle', lang)}</span>
                <span className="block truncate text-xs text-muted-foreground">{t('dgSub', lang)}</span>
              </span>
            </span>
            <ChevronRight className="h-4.5 w-4.5 shrink-0 text-muted-foreground" />
          </button>

          {/* Live emergency escalation demo (Task 16) */}
          <Accordion type="single" collapsible className="rounded-xl border bg-card px-4">
            <AccordionItem value="esc-demo" className="border-b-0">
              <AccordionTrigger className="min-h-[44px] py-3 hover:no-underline">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Siren className="h-4 w-4 text-destructive" />
                  {t('escDemo', lang)}
                  <span className="text-xs font-normal text-muted-foreground">· {area}</span>
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Select value={escDemoCat} onValueChange={setEscDemoCat}>
                    <SelectTrigger className="h-9 w-[170px]" aria-label={`${t('escDemo', lang)} category`}>
                      <span className="flex items-center gap-1.5">{ICONS[escDemoCat] ?? ICONS.other}<SelectValue /></span>
                    </SelectTrigger>
                    <SelectContent>
                      {['electrician', 'plumber'].map((k) => (
                        <SelectItem key={k} value={k}>
                          <span className="flex items-center gap-1.5">{ICONS[k] ?? ICONS.other} {catName.get(k) ?? k}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-[11px] leading-snug text-muted-foreground">{t('escDemoSub', lang)}</span>
                </div>
                <EmergencyEscalationPanel categoryKey={escDemoCat} area={area} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={`${t('search', lang)} services (English / मराठी / हिन्दी)`} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>

          {rebookables.length > 0 && (
            <div aria-label={t('bookAgain', lang)}>
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><History className="h-4 w-4 text-primary" /> {t('bookAgain', lang)}</h3>
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-700">
                {rebookables.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => openFlow(b.categoryKey, false, b.area)}
                    className="group flex shrink-0 items-center gap-2.5 rounded-full border bg-card py-2 pl-2.5 pr-4 text-left transition hover:border-primary/50 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                      {ICONS[b.categoryKey] ?? ICONS.other}
                    </span>
                    <span className="min-w-0">
                      <span className="block max-w-[150px] truncate text-xs font-semibold leading-tight">{catName.get(b.categoryKey) ?? b.categoryName ?? b.categoryKey}</span>
                      <span className="block text-[10px] text-muted-foreground">{b.area} · ★ {b.rating ?? '—'}</span>
                    </span>
                    <RotateCcw className="h-3 w-3 shrink-0 text-muted-foreground transition group-hover:text-primary" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold">{t('bookService', lang)}</h3>
            {catsQ.isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4">
                {filteredCats.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => openFlow(c.key)}
                    className="group flex flex-col items-start gap-1.5 rounded-xl border bg-card p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-primary group-hover:bg-primary group-hover:text-primary-foreground">
                      {ICONS[c.key] ?? ICONS.other}
                    </span>
                    <span className="text-sm font-semibold leading-tight">{lang === 'mr' ? c.nameMr : lang === 'hi' ? c.nameHi : c.nameEn}</span>
                    <span className="line-clamp-1 text-[11px] text-muted-foreground">{lang === 'mr' ? (c.descMr || c.descEn) : lang === 'hi' ? (c.descHi || c.descEn) : c.descEn}</span>
                    <span className="text-[11px] font-medium text-primary">{t('fromPrice', lang)} {inr(c.baseRate)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {active.length > 0 && (
            <SectionCard title={`${t('trackBooking', lang)} — live`} description="Status updates automatically as the cooperative network progresses your request">
              <div className="space-y-2">
                {active.map((b) => (
                  <button key={b.id} onClick={() => { openBooking(b.id); setTab('bookings') }} className="flex w-full items-center gap-3 rounded-lg border p-3 text-left transition hover:border-primary/40 hover:bg-accent/50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{b.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{b.refCode} · {b.area} · {b.workerName ?? 'matching worker…'}</p>
                    </div>
                    <StatusChip status={b.status} />
                  </button>
                ))}
              </div>
            </SectionCard>
          )}

          {/* Household hint — preventive maintenance is institutional (Task 31) */}
          {user.role === 'CUSTOMER' && (
            <div className="flex items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary"><ClipboardCheck className="h-4.5 w-4.5" /></span>
              <p className="leading-snug"><span className="font-semibold text-foreground">{t('pmHintTitle', lang)}</span> {t('pmHintBody', lang)}</p>
            </div>
          )}
        </TabsContent>

        {/* BOOKINGS */}
        <TabsContent value="bookings" className="space-y-4 pt-2">
          {selectedBooking ? (
            <BookingDetail
              booking={selectedBooking}
              refetch={() => bookingsQ.refetch()}
              onBack={() => { setSelectedBookingId(null); setTab('bookings'); clearFocusBooking() }}
              onRebook={(categoryKey, bookingArea) => {
                setSelectedBookingId(null)
                clearFocusBooking()
                openFlow(categoryKey, false, bookingArea)
              }}
            />
          ) : (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <h3 className="text-sm font-semibold">Active & recent</h3>
                <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
                  <div className="inline-flex rounded-lg border bg-card p-0.5" role="group" aria-label="Filter bookings">
                    {(['ALL', 'ACTIVE', 'COMPLETED'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setHistoryFilter(f)}
                        aria-pressed={historyFilter === f}
                        className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition ${historyFilter === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
                      >
                        {f === 'ALL' ? 'All' : f === 'ACTIVE' ? 'Active' : 'Completed'}
                      </button>
                    ))}
                  </div>
                  <div className="relative w-full sm:w-56">
                    <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} placeholder="Search bookings, area, worker…" className="h-8 pl-8 text-xs" aria-label="Search booking history" />
                  </div>
                </div>
              </div>
              {bookings.length === 0 ? (
                <EmptyState title="No bookings yet" body="Book your first verified cooperative service from the Home tab." />
              ) : (
                <div className="space-y-2">
                  {visibleHistory.length === 0 ? (
                    <EmptyState
                      title="Nothing here yet"
                      body={`No ${historyFilter === 'ACTIVE' ? 'active' : historyFilter === 'COMPLETED' ? 'completed' : ''} bookings match${historySearch ? ` “${historySearch}”` : ''} — try a different filter or search.`}
                    />
                  ) : (
                    visibleHistory.map((b) => {
                      const done = ['COMPLETED', 'PAID', 'REVIEWED'].includes(b.status)
                      const cancelled = b.status === 'CANCELLED'
                      return (
                        <button
                          key={b.id}
                          onClick={() => openBooking(b.id)}
                          className="flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition hover:border-primary/40 hover:bg-accent/50 motion-safe:hover:-translate-y-px motion-safe:hover:shadow-sm"
                        >
                          <span
                            aria-hidden
                            className={`h-10 w-1 shrink-0 rounded-full ${
                              cancelled
                                ? 'bg-zinc-300 dark:bg-zinc-700'
                                : done
                                  ? 'bg-emerald-500/80'
                                  : 'bg-amber-500' + (b.urgency === 'EMERGENCY' ? ' animate-pulse' : '')
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-semibold">{b.title}</p>
                              {b.urgency === 'EMERGENCY' && <Badge variant="destructive" className="h-4 px-1 text-[9px]">SOS</Badge>}
                            </div>
                            <p className="truncate text-xs text-muted-foreground">
                              {b.refCode} · {b.area} · {timeAgo(b.createdAt)} {b.workerName ? `· ${b.workerName}` : ''}
                            </p>
                          </div>
                          <div className="text-right">
                            <StatusChip status={b.status} />
                            {(b.finalPrice || b.estimatedPrice) && <p className="mt-1 text-xs font-semibold">{inr(b.finalPrice ?? b.estimatedPrice)}</p>}
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* INSTITUTION PORTAL (#32) — institution role only */}
        {user.role === 'INSTITUTION' && (
          <TabsContent value="institution" className="space-y-4 pt-2">
            <InstitutionPortal customerId={user.customerId ?? user.id} />
          </TabsContent>
        )}

        {/* CONTRACTS / AMC (#33) — institution role only */}
        {user.role === 'INSTITUTION' && (
          <TabsContent value="contracts" className="space-y-4 pt-2">
            <AmcPanel customerId={user.customerId ?? user.id} />
          </TabsContent>
        )}

        {/* PAYMENTS */}
        <TabsContent value="payments" className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <KpiCard label="Total spent" value={inr(paidTotal)} tone="primary" />
            <KpiCard label="Paid jobs" value={bookings.filter((b) => b.payment).length} />
            <KpiCard label="Avg job value" value={inr(bookings.filter((b) => b.payment).length ? Math.round(paidTotal / bookings.filter((b) => b.payment).length) : 0)} />
          </div>
          <SectionCard title="Payment history" description="UPI-style prototype payments with transparent cooperative splits">
            {bookings.filter((b) => b.payment).length === 0 ? (
              <EmptyState title="No payments yet" />
            ) : (
              <div className="space-y-2">
                {bookings.filter((b) => b.payment).map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 transition hover:border-primary/40">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{b.title}</p>
                      <p className="text-xs text-muted-foreground">{b.payment?.method} · {b.payment?.txnId ?? 'demo settlement'} · {timeAgo(b.payment?.paidAt ?? b.createdAt)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <div className="text-right">
                        <p className="text-sm font-bold">{inr(b.payment?.amount)}</p>
                        <p className="text-[10px] text-muted-foreground">worker {inr(b.payment?.workerShare)} · welfare {inr(b.payment?.welfare)}</p>
                      </div>
                      <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-[11px]" onClick={() => setReceiptBooking(b)}>
                        <ReceiptText className="h-3 w-3" /> Receipt
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <ReceiptDialog booking={receiptBooking} open={!!receiptBooking} onOpenChange={(v) => { if (!v) setReceiptBooking(null) }} />
        </TabsContent>

        {/* SUPPORT */}
        <TabsContent value="support" className="space-y-4 pt-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <SectionCard title="Cooperative helpdesk" description="Your local primary society handles exceptions & serious complaints">
              <div className="space-y-2 text-sm">
                <p className="flex items-center gap-2"><PhoneCall className="h-4 w-4 text-primary" /> 1800-266-7788 (toll-free, 7am–10pm)</p>
                <p className="flex items-center gap-2"><Languages className="h-4 w-4 text-primary" /> Marathi · Hindi · English</p>
                <p className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Escalation: Haveli Taluka → Pune District → State Federation</p>
              </div>
            </SectionCard>
            <SectionCard title="Safety & trust" description="Every worker arrives with a verified digital identity">
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>• Cooperative-verified certification & ID</li>
                <li>• Fair-price rate card, no hidden charges</li>
                <li>• Service evidence captured on completion</li>
                <li>• Welfare contribution funds worker protection</li>
              </ul>
            </SectionCard>
          </div>
          <SectionCard title="Voice & language" description="Prototype accessibility features">
            <p className="text-sm text-muted-foreground">
              Voice input in the booking flow uses speech-to-text (prototype ASR). Try the Marathi sample scripts during your demo. Interface language can be switched any time from the header.
            </p>
            <div className="mt-3 space-y-2">
              {MR_SAMPLES.map((s, i) => (
                <button key={i} className="w-full rounded-lg border bg-muted/40 p-2.5 text-left text-xs" onClick={() => { navigator.clipboard?.writeText(s).catch(() => {}) }}>
                  <span className="font-semibold">Sample {i + 1} (tap to copy): </span>{s}
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard title={t('faqTitle', lang)} description="How the cooperative model works in practice">
            <Accordion type="single" collapsible className="w-full">
              {FAQS.map((f, i) => (
                <AccordionItem key={i} value={`faq-${i}`}>
                  <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">{f.q}</AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </SectionCard>
        </TabsContent>
        {/* MAINTENANCE (institution only) */}
        {user.role === 'INSTITUTION' && (
          <TabsContent value="maintenance" className="space-y-4 pt-2">
            <MaintenancePanel />
          </TabsContent>
        )}
      </Tabs>

      {/* Diagnose-before-dispatch dialog (Task 13) */}
      <DiagnoseDialog
        user={user}
        open={diagnoseOpen}
        onOpenChange={setDiagnoseOpen}
        onBookNow={(categoryKey, consultSummary) => {
          // FIX: the consult summary was built by the dialog and then DISCARDED,
          // so nothing the technician said reached the booking. It is now
          // forwarded as the pre-filled problem description.
          setDiagnoseOpen(false)
          setPrefillDescription(consultSummary ?? '')
          openFlow(categoryKey, false)
        }}
        onEmergency={(categoryKey) => {
          setDiagnoseOpen(false)
          openFlow(categoryKey, true)
        }}
      />
    </div>
  )
}
