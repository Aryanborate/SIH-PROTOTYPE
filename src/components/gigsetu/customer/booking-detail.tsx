'use client'

import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, inr, fmtDateTime, timeAgo } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import { BOOKING_STATUS_ORDER, STATUS_LABELS, type BookingDTO, type SavedPlaceDTO } from '@/lib/types'
import { SectionCard, StatusChip, EmptyState } from '../shared/ui-kit'
import { ReceiptDialog } from './receipt'
import { EmergencyEscalationPanel } from './emergency-escalation'
import { ServiceEvidenceCard } from './service-evidence-card'
import { RatingPanel } from './rating-dialog'
import { PaymentMethodChooser, PaymentSplitStrip, PaymentHistoryList, payMethodLabel, type PayMethod } from './payment-methods'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { t } from '@/lib/i18n'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  ArrowLeft, Star, CheckCircle2, Circle, Loader2, ShieldCheck, Route, Phone, MapPin,
  Wallet, Camera, MessageSquareText, IndianRupee, Handshake, Ban, ReceiptText, Sparkles, Repeat, Eye,
  ClipboardList, Wrench, Navigation, CircleDot, Flag, BookmarkPlus,
} from 'lucide-react'

const SETTLED = ['COMPLETED', 'PAID', 'REVIEWED']

const QUOTE_STAGES = ['QUOTE_REQUESTED', 'QUOTED', 'NEGOTIATING']

/** Worker initials for quote-offer avatars. */
function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

/** Per-stage semantic icon for the live-status timeline. */
const STAGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  REQUESTED: ClipboardList,
  ACCEPTED: Handshake,
  ON_THE_WAY: Navigation,
  IN_PROGRESS: Wrench,
  COMPLETED: CheckCircle2,
  PAID: Wallet,
  REVIEWED: Star,
  QUOTE_REQUESTED: MessageSquareText,
  QUOTED: Handshake,
  NEGOTIATING: IndianRupee,
}

/** Safe string read from a loosely-typed analysis record; returns null when absent/empty. */
function str(v: unknown): string | null {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s.length > 0 && s !== 'undefined' && s !== 'null' ? s : null
}

/** Safe number read; returns null when not a finite number. */
function numField(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) && v !== null && v !== undefined && v !== '' ? n : null
}

export function BookingDetail({ booking, refetch, onBack, onRebook }: { booking: BookingDTO; refetch: () => void; onBack: () => void; onRebook?: (categoryKey: string, area: string) => void }) {
  const { toast } = useToast()
  const lang = useAppStore((s) => s.lang)
  const user = useAppStore((s) => s.user)
  const qc = useQueryClient()
  const [acting, setActing] = useState(false)
  const [counterPrice, setCounterPrice] = useState('')
  const [payMethod, setPayMethod] = useState<PayMethod>('upi')
  const [evidenceNote, setEvidenceNote] = useState('')
  const [evidencePhoto, setEvidencePhoto] = useState<string | undefined>()
  const [receiptOpen, setReceiptOpen] = useState(false)
  // report-an-issue dialog state
  const [riOpen, setRiOpen] = useState(false)
  const [riSubject, setRiSubject] = useState('')
  const [riDetail, setRiDetail] = useState('')
  const [riSeverity, setRiSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM')
  const [reportedFor, setReportedFor] = useState<string | null>(null)
  // 3-worker quote offers: which offer row has an open counter-input
  const [counterFor, setCounterFor] = useState<string | null>(null)

  const live = !['REVIEWED', 'CANCELLED', 'PAID', 'COMPLETED'].includes(booking.status)
  // FIX 1: the local `t` shadowed the imported i18n `t` — rename it.
  // FIX 2: the interval depended on an INLINE `refetch` prop (new identity every
  // parent render), so the 3 s live poll was torn down and recreated on every
  // parent render (the parent polls every 6 s), degrading the tracking cadence.
  // A ref keeps the timer stable without re-subscribing.
  const refetchRef = useRef(refetch)
  useEffect(() => {
    refetchRef.current = refetch
  }, [refetch])
  useEffect(() => {
    if (!live) return
    const timer = setInterval(() => refetchRef.current(), 3000)
    return () => clearInterval(timer)
  }, [live, booking.id])

  /**
   * FIX: the negotiation floor shown to the customer was FABRICATED client-side
   * as `estimatedPrice * 0.9` with a hardcoded 400 fallback. The real floor comes
   * from the cooperative pricing policy and travels with the booking response.
   */
  const [floor, setFloor] = useState(0)
  useEffect(() => {
    let alive = true
    void api
      .get<{ ok: boolean; floor: number }>(`/api/bookings/${booking.id}`)
      .then((r) => {
        if (alive && typeof r.floor === 'number') setFloor(r.floor)
      })
      .catch(() => {
        /* keep 0 — the input stays usable, the server is the real gate */
      })
    return () => {
      alive = false
    }
  }, [booking.id, booking.estimatedPrice, booking.cooperativeId])
  const effectiveFloor = floor || Math.floor((booking.estimatedPrice ?? 0) * 0.92)

  // Saved places (shared cache key with the booking flow) — powers the "Save this address" quick action.
  const placesKey = ['places', user?.id ?? ''] as const
  const placesQ = useQuery({
    queryKey: placesKey,
    queryFn: () => api.get<{ ok: boolean; places: SavedPlaceDTO[] }>(`/api/places?customerId=${user?.id}`),
    enabled: !!user,
  })
  const places = placesQ.data?.places ?? []
  // Whitespace/case-insensitive match so near-identical addresses count as saved.
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
  const addressSaved = places.some((p) => p.area === booking.area && norm(p.address) === norm(booking.address))
  const savePlaceM = useMutation({
    mutationFn: () => api.post<{ ok: boolean }>('/api/places', { customerId: user?.id, label: booking.area, area: booking.area, address: booking.address.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: placesKey })
      toast({ title: t('placeSaved', lang) })
    },
    onError: (e) => toast({ title: t('bdActionFailed', lang), description: (e as Error).message, variant: 'destructive' }),
  })

  const reportM = useMutation({
    mutationFn: () => api.post<{ ok: boolean }>('/api/complaints', { bookingId: booking.id, subject: riSubject, detail: riDetail, severity: riSeverity }),
    onSuccess: () => {
      setReportedFor(booking.id)
      setRiOpen(false)
      setRiSubject('')
      setRiDetail('')
      toast({ title: t('riSubmitted', lang), description: t('riSubmittedSub', lang) })
    },
    onError: (e) => toast({ title: t('riFail', lang), description: (e as Error).message, variant: 'destructive' }),
  })

  /** Localized status label for the timeline; falls back to the shared EN map. */
  const stLabel = (s: string) => {
    const v = t(`st${s}`, lang)
    return v === `st${s}` ? STATUS_LABELS[s] ?? s : v
  }

  async function act(body: Record<string, unknown>, okMsg: string) {
    setActing(true)
    try {
      await api.patch(`/api/bookings/${booking.id}`, body)
      toast({ title: okMsg })
      refetch()
    } catch (e) {
      toast({ title: t('bdActionFailed', lang), description: (e as Error).message, variant: 'destructive' })
    } finally {
      setActing(false)
    }
  }

  // ---------- 3-worker quote offers (Task 11) ----------
  function acceptOffer(workerId: string) {
    act({ action: 'acceptOffer', workerId }, t('qoAcceptedToast', lang))
    qc.invalidateQueries({ queryKey: ['bookings'] })
  }

  async function sendCounter(workerName: string) {
    await act({ action: 'counter', price: Number(counterPrice), note: `Counter for ${workerName} offer` }, t('bdCounterSent', lang))
    setCounterFor(null)
    setCounterPrice('')
  }

  function declineAllOffers() {
    if (window.confirm(t('qoDeclineConfirm', lang))) {
      act({ action: 'rejectOffers' }, t('qoDeclinedToast', lang))
    }
  }

  const inQuote = QUOTE_STAGES.includes(booking.status)
  const lastWorkerQuote = [...booking.quotes].reverse().find((q) => q.by === 'WORKER')
  const canPay = booking.status === 'COMPLETED'
  const payableAmount = booking.finalPrice ?? booking.estimatedPrice ?? 0
  const rateReady = Number.isFinite(payableAmount) && payableAmount > 0
  const canRate = booking.status === 'PAID'
  const hasEvidence = !!booking.evidence
  const stageIdx = BOOKING_STATUS_ORDER.indexOf(booking.status as (typeof BOOKING_STATUS_ORDER)[number])
  const reported = reportedFor === booking.id

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label={t('back', lang)}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold">{booking.title}</h2>
          <p className="text-xs text-muted-foreground">{booking.refCode} · {booking.area} · {t('bdBooked', lang)} {timeAgo(booking.createdAt)}</p>
        </div>
        <StatusChip status={booking.status} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        {/* LEFT: timeline + description */}
        <div className="space-y-4">
          <SectionCard title={t('bdLiveStatus', lang)} description={live ? t('bdUpdatesAuto', lang) : t('bdJourneyComplete', lang)}>
            {/* quote stage hint */}
            {inQuote && (
              <div className="mb-3 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300">
                <Handshake className="mr-1 inline h-3.5 w-3.5" /> {booking.status === 'QUOTE_REQUESTED' ? t('bdQuoteHintRequested', lang) : booking.status === 'QUOTED' ? t('bdQuoteHintQuoted', lang) : t('bdQuoteHintNegotiating', lang)}
              </div>
            )}

            <ol className="relative space-y-0">
              {(inQuote ? ['QUOTE_REQUESTED', 'QUOTED'] : BOOKING_STATUS_ORDER).map((s, i) => {
                const done = inQuote
                  ? booking.timeline.some((tl) => tl.status === s)
                  : stageIdx >= i && booking.status !== 'CANCELLED'
                const entry = [...booking.timeline].reverse().find((tl) => tl.status === s)
                const isCurrent = booking.status === s
                const StageIcon = STAGE_ICONS[s] ?? CircleDot
                return (
                  <li key={s} className="flex gap-3 pb-4 last:pb-0">
                    <div className="flex flex-col items-center">
                      {done ? (
                        <span
                          className={`relative flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                            isCurrent
                              ? 'bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background'
                              : 'bg-emerald-500 text-white'
                          }`}
                        >
                          <StageIcon className="h-3.5 w-3.5" />
                          {isCurrent && <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-primary" /></span>}
                        </span>
                      ) : (
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-card">
                          <StageIcon className="h-3.5 w-3.5 text-muted-foreground/50" />
                        </span>
                      )}
                      {i < (inQuote ? 1 : BOOKING_STATUS_ORDER.length - 1) && <span className={`h-full min-h-6 w-px ${done ? 'bg-emerald-300 dark:bg-emerald-700' : 'bg-border'}`} />}
                    </div>
                    <div className="min-w-0 flex-1 pt-1">
                      <p className={`text-sm font-semibold leading-tight ${done ? (isCurrent ? 'text-primary' : '') : 'text-muted-foreground'}`}>
                        {stLabel(s)}
                        {isCurrent && <span className="ml-1.5 rounded bg-primary/10 px-1.5 py-0.5 align-middle text-[9px] font-bold uppercase tracking-widest text-primary">{t('bdNow', lang)}</span>}
                      </p>
                      {entry && <p className="text-[11px] text-muted-foreground">{fmtDateTime(entry.at)}{entry.note ? ` · ${entry.note}` : ''}</p>}
                    </div>
                  </li>
                )
              })}
            </ol>
            {booking.status === 'CANCELLED' && <Badge variant="destructive">{t('bdCancelledBadge', lang)}</Badge>}
          </SectionCard>

          {/* Emergency escalation ladder (Task 16) — live for active emergency bookings */}
          {booking.urgency === 'EMERGENCY' && ['REQUESTED', 'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS'].includes(booking.status) && (
            <SectionCard title={t('escTitle', lang)} description={t('escSubtitle', lang)}>
              <EmergencyEscalationPanel categoryKey={booking.categoryKey} area={booking.area} compact />
            </SectionCard>
          )}

          <SectionCard title={t('bdRequestDetails', lang)}>
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">{booking.description || '—'}</p>
              <Separator />
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {booking.address}</span>
                <span className="flex items-center gap-1"><Route className="h-3.5 w-3.5" /> {fmtDateTime(booking.scheduledAt)}</span>
                <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> {t('bdUrgency', lang)}: {booking.urgency}</span>
                <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> {booking.customerPhone ?? '—'}</span>
              </div>
              {user && (
                addressSaved ? (
                  <p className="flex w-fit items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> {t('savedPlaces', lang)} · {booking.area}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => savePlaceM.mutate()}
                    disabled={savePlaceM.isPending}
                    className="flex w-fit items-center gap-1 rounded-md border border-dashed px-2 py-1 text-[11px] text-muted-foreground transition hover:border-primary/50 hover:text-primary"
                  >
                    {savePlaceM.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookmarkPlus className="h-3 w-3" />}
                    {t('savePlace', lang)}
                  </button>
                )
              )}
              {booking.media.length > 0 && (
                <div className="flex gap-2 pt-1">
                  {booking.media.filter((m) => m && m.startsWith('data:image')).map((m, i) => (
                    <img key={i} src={m} alt={`${t('bdAttachment', lang)} ${i + 1}`} className="h-16 w-16 rounded-lg border object-cover" />
                  ))}
                </div>
              )}
              {booking.analysis && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent-foreground">
                    <Sparkles className="h-3 w-3 text-primary" /> AI
                  </span>
                  <span className="rounded-md border bg-muted/40 px-1.5 py-0.5 text-[11px] font-medium">
                    {str(booking.analysis.title) ?? booking.title}
                  </span>
                  <span className="rounded-md border bg-muted/40 px-1.5 py-0.5 text-[11px] font-medium">
                    {str(booking.analysis.urgency) ?? booking.urgency} {t('bdPriority', lang)}
                  </span>
                  {numField(booking.analysis.estimatedMinutes) !== null && (
                    <span className="rounded-md border bg-muted/40 px-1.5 py-0.5 text-[11px] font-medium">~{numField(booking.analysis.estimatedMinutes)} {t('bdMinutes', lang)}</span>
                  )}
                  {str(booking.analysis.difficulty) && (
                    <span className="rounded-md border bg-muted/40 px-1.5 py-0.5 text-[11px] font-medium capitalize">{str(booking.analysis.difficulty)}</span>
                  )}
                  <span className="rounded-md border border-dashed px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {t('bdSource', lang)}: {str(booking.analysis.source) ?? 'heuristic'}
                  </span>
                </div>
              )}
            </div>
          </SectionCard>

          {/* 3-worker quote offers (Task 11) — compare / accept / negotiate */}
          {inQuote && booking.quoteOffers && booking.quoteOffers.length > 0 && (
            <SectionCard title={t('qoTitle', lang)} description={t('qoDesc', lang)}>
              <div className="space-y-2">
                {booking.quoteOffers.map((o) => (
                  <div key={o.workerId} className="rounded-lg border p-3">
                    <div className="flex items-start gap-3">
                      <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-primary">
                        {initials(o.workerName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="text-sm font-bold">{o.workerName}</p>
                          <span className="truncate text-xs text-muted-foreground">· {o.coopName}</span>
                          <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                            <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> {o.rating.toFixed(1)}
                          </span>
                          {o.certStatus === 'VERIFIED' ? (
                            <span className="inline-flex items-center gap-0.5 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                              <ShieldCheck className="h-2.5 w-2.5" /> VERIFIED
                            </span>
                          ) : (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">{o.certStatus}</span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {t('qoAvailable', lang)} {o.availableAt} · {t('escEta', lang)} ~{o.etaMin} {t('escMin', lang)}
                        </p>
                      </div>
                      <p className="shrink-0 text-base font-bold tabular-nums">{inr(o.price)}</p>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button size="sm" className="h-8 flex-1 sm:flex-none" disabled={acting} onClick={() => acceptOffer(o.workerId)}>
                        {t('qoAccept', lang)} · {inr(o.price)}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8"
                        disabled={acting}
                        aria-expanded={counterFor === o.workerId}
                        onClick={() => { setCounterPrice(''); setCounterFor(counterFor === o.workerId ? null : o.workerId) }}
                      >
                        <IndianRupee className="mr-1 h-3.5 w-3.5" /> {t('qoCounter', lang)}
                      </Button>
                    </div>
                    {counterFor === o.workerId && (
                      <div className="mt-2 flex gap-2">
                        <Input
                          type="number"
                          inputMode="numeric"
                          placeholder={t('qoCounterPh', lang)}
                          value={counterPrice}
                          onChange={(e) => setCounterPrice(e.target.value)}
                          aria-label={t('qoCounterPh', lang)}
                        />
                        <Button
                          size="sm"
                          className="h-9 shrink-0"
                          disabled={acting || !counterPrice || Number(counterPrice) <= 0}
                          onClick={() => sendCounter(o.workerName)}
                        >
                          {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : t('qoCounterConfirm', lang)}
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 w-full text-destructive transition-colors hover:bg-destructive/5 hover:text-destructive"
                disabled={acting}
                onClick={declineAllOffers}
              >
                <Ban className="mr-2 h-3.5 w-3.5" /> {t('qoDecline', lang)}
              </Button>
            </SectionCard>
          )}

          {booking.quotes.length > 0 && (
            <SectionCard title={t('bdQuoteHistory', lang)} description={t('bdQuoteHistoryDesc', lang)}>
              <div className="space-y-2">
                {booking.quotes.map((q, i) => (
                  <div key={i} className={`flex items-center justify-between gap-3 rounded-lg border p-2.5 text-sm ${q.by === 'WORKER' ? 'bg-muted/40' : 'bg-accent/40'}`}>
                    <div className="min-w-0">
                      <p className="text-xs font-bold">{q.by === 'WORKER' ? t('bdWorkerSide', lang) : t('bdYou', lang)}</p>
                      <p className="truncate text-xs text-muted-foreground">{q.note}</p>
                    </div>
                    <span className="font-bold tabular-nums">{inr(q.price)}</span>
                  </div>
                ))}
              </div>
              {booking.status === 'QUOTED' && lastWorkerQuote && (
                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <div className="flex flex-1 items-center gap-2">
                    <IndianRupee className="h-4 w-4 text-muted-foreground" />
                    <Input type="number" placeholder={`${t('bdYourOffer', lang)} (${t('bdFloor', lang)} ${inr(effectiveFloor)})`} value={counterPrice} onChange={(e) => setCounterPrice(e.target.value)} />
                  </div>
                  <Button variant="outline" disabled={acting || !counterPrice} onClick={() => act({ action: 'counter', price: Number(counterPrice) }, t('bdCounterSent', lang))}>{t('bdSendOffer', lang)}</Button>
                  <Button disabled={acting} onClick={() => act({ action: 'acceptQuote' }, t('bdQuoteAccepted', lang))}>{t('bdAcceptQuote', lang)} {inr(lastWorkerQuote.price)}</Button>
                </div>
              )}
            </SectionCard>
          )}
        </div>

        {/* RIGHT: worker, payment, evidence, rating */}
        <div className="space-y-4">
          {booking.workerName ? (
            <SectionCard title={t('bdVerifiedWorker', lang)} description={booking.cooperativeName}>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-bold">{booking.workerName}</p>
                  <Badge variant="outline" className="border-emerald-200 text-emerald-700"><ShieldCheck className="mr-1 h-3 w-3" /> {t('bdCoopVerified', lang)}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{t('bdSkillPrivacy', lang)}: {booking.workerSkill} · {t('bdPrivacyNote', lang)}</p>
                {['ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS'].includes(booking.status) && (
                  <p className="flex items-center gap-1.5 text-xs text-emerald-700"><Phone className="h-3.5 w-3.5" /> {booking.workerPhone}</p>
                )}
              </div>
            </SectionCard>
          ) : (
            <SectionCard title={t('bdMatching', lang)} description={t('bdMatchingDesc', lang)}>
              <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin text-primary" /> {t('bdFinding', lang)}</div>
            </SectionCard>
          )}

          {(booking.finalPrice || booking.estimatedPrice) && !booking.payment && (
            <SectionCard title={t('bdPrice', lang)} description={inQuote ? t('bdPriceQuoteStage', lang) : booking.status === 'COMPLETED' ? t('bdPriceDue', lang) : t('bdPriceOnAccept', lang)}>
              <p className="text-2xl font-bold tabular-nums">{inr(booking.finalPrice ?? booking.estimatedPrice)}</p>
            </SectionCard>
          )}

          {canPay && (
            <SectionCard title={t('bdPayment', lang)} description={t('bdPayDesc', lang)}>
              <div className="space-y-3">
                {rateReady ? (
                  <>
                    <PaymentMethodChooser value={payMethod} onChange={setPayMethod} disabled={acting} />
                    <Button className="h-11 w-full" disabled={acting} onClick={() => act({ action: 'pay', method: payMethodLabel(payMethod) }, t('bdPaymentRecorded', lang))}>
                      <Wallet className="mr-2 h-4 w-4" /> {t('bdPayNow', lang)} {inr(payableAmount)}
                    </Button>
                    <p className="text-[11px] text-muted-foreground">{t('bdGatewayNote', lang)}</p>
                  </>
                ) : (
                  <div className="flex items-start gap-2 rounded-lg border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
                    <IndianRupee className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{t('bdRatePending', lang)}</span>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {booking.payment && (
            <SectionCard title={t('bdReceipt', lang)} description={`${booking.payment.method} · ${str(booking.payment.txnId) ?? t('bdDemoSettlement', lang)}`}>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{t('bdTotal', lang)}</span><span className="font-bold tabular-nums">{inr(booking.payment.amount)}</span></div>
                {/* Transparent settlement split (#38) */}
                <PaymentSplitStrip payment={booking.payment} />
                {!str(booking.payment.txnId) && <p className="text-[10px] text-muted-foreground">{t('bdSeededNote', lang)}</p>}
                <Button variant="outline" size="sm" className="w-full" onClick={() => setReceiptOpen(true)}>
                  <Eye className="mr-1.5 h-3.5 w-3.5" /> {t('bdViewReceipt', lang)}
                </Button>
                {user?.id && <PaymentHistoryList customerId={user.id} />}
              </div>
            </SectionCard>
          )}

          <ReceiptDialog booking={booking} open={receiptOpen} onOpenChange={setReceiptOpen} />

          {SETTLED.includes(booking.status) ? (
            <ServiceEvidenceCard booking={booking} />
          ) : hasEvidence && (
            <SectionCard title={t('bdEvidence', lang)} description={t('bdEvidenceCap', lang)}>
              <div className="space-y-2 text-sm">
                {booking.evidence?.photo && (
                  <img src={booking.evidence.photo} alt={t('bdEvidence', lang)} className="max-h-40 w-full rounded-lg border object-cover" />
                )}
                <p className="text-muted-foreground">{booking.evidence?.notes || t('bdEvidenceDefault', lang)}</p>
                <p className="text-[11px] text-muted-foreground">{booking.evidence?.at ? fmtDateTime(booking.evidence.at) : ''}</p>
              </div>
            </SectionCard>
          )}

          {canRate && (
            <SectionCard title={t('bdRateTitle', lang)} description={t('bdRateDesc', lang)}>
              <RatingPanel
                lang={lang}
                disabled={acting}
                onSubmit={({ rating, review, factors }) =>
                  act({ action: 'rate', rating, review, factors }, t('bdRatingThanks', lang))
                }
              />
            </SectionCard>
          )}

          {booking.rating != null && (
            <SectionCard title={t('bdYourRating', lang)}>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((s) => <Star key={s} className={`h-4 w-4 ${s <= (booking.rating ?? 0) ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/30'}`} />)}
                {booking.review && <span className="ml-2 text-xs text-muted-foreground">“{booking.review}”</span>}
              </div>
              {booking.ratingFactors && (
                <div className="mt-2 grid grid-cols-2 gap-1.5 border-t pt-2">
                  {([['rtQuality', booking.ratingFactors.quality], ['rtTimeliness', booking.ratingFactors.timeliness], ['rtBehaviour', booking.ratingFactors.behaviour], ['rtCommunication', booking.ratingFactors.communication]] as const).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-1 rounded-md bg-muted/40 px-2 py-1 text-[11px]">
                      <span className="text-muted-foreground">{t(k, lang)}</span>
                      <span className="flex items-center gap-0.5 font-bold tabular-nums"><Star className="h-3 w-3 fill-amber-500 text-amber-500" />{v}</span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          )}

          {['COMPLETED', 'PAID', 'REVIEWED'].includes(booking.status) && onRebook && (
            <Button variant="outline" className="w-full" onClick={() => onRebook(booking.categoryKey, booking.area)}>
              <Repeat className="mr-2 h-4 w-4" /> {t('bdRebook', lang)}
            </Button>
          )}

          {booking.workerName && booking.status !== 'CANCELLED' && (
            reported ? (
              <div className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed py-2 text-xs text-muted-foreground">
                <Flag className="h-3.5 w-3.5 text-primary" /> {t('riBadge', lang)}
              </div>
            ) : (
              <Dialog open={riOpen} onOpenChange={setRiOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full text-muted-foreground transition-colors hover:text-foreground">
                    <Flag className="mr-2 h-3.5 w-3.5" /> {t('riTitle', lang)}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><Flag className="h-4 w-4 text-primary" /> {t('riTitle', lang)}</DialogTitle>
                    <DialogDescription>{t('riDesc', lang)}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium">{t('riSubject', lang)}</label>
                      <Input value={riSubject} onChange={(e) => setRiSubject(e.target.value)} placeholder={t('riSubjectPh', lang)} maxLength={120} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium">{t('riDetail', lang)}</label>
                      <Textarea value={riDetail} onChange={(e) => setRiDetail(e.target.value)} placeholder={t('riDetailPh', lang)} rows={3} maxLength={600} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium">{t('riSeverity', lang)}</label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['LOW', 'MEDIUM', 'HIGH'] as const).map((sv) => (
                          <button
                            key={sv}
                            type="button"
                            aria-pressed={riSeverity === sv}
                            onClick={() => setRiSeverity(sv)}
                            className={`rounded-lg border p-2 text-xs font-medium transition ${riSeverity === sv ? 'border-primary bg-accent text-primary' : 'text-muted-foreground hover:bg-accent/40'}`}
                          >
                            {t(sv === 'LOW' ? 'riSevLow' : sv === 'MEDIUM' ? 'riSevMedium' : 'riSevHigh', lang)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button className="w-full" disabled={reportM.isPending || !riSubject.trim() || !riDetail.trim()} onClick={() => reportM.mutate()}>
                      {reportM.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Flag className="mr-2 h-4 w-4" />}
                      {t('riSubmit', lang)}
                    </Button>
                    <p className="text-center text-[11px] text-muted-foreground">{t('riUrgencyNote', lang).trim()}</p>
                  </div>
                </DialogContent>
              </Dialog>
            )
          )}

          {!inQuote && !['CANCELLED', 'COMPLETED', 'PAID', 'REVIEWED'].includes(booking.status) && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="w-full text-destructive transition-colors hover:border-destructive/40 hover:bg-destructive/5 hover:text-destructive" disabled={acting}>
                  <Ban className="mr-2 h-4 w-4" /> {t('cancelBooking', lang)}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('cancelTitle', lang)}</AlertDialogTitle>
                  <AlertDialogDescription>{t('cancelDesc', lang)}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t('cancelKeep', lang)}</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={acting}
                    onClick={(e) => { e.preventDefault(); act({ action: 'cancel' }, t('bdCancelledToast', lang)) }}
                  >
                    {acting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4" />}
                    {t('cancelYes', lang)}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {/* Worker-side demo helpers */}
          {['ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS'].includes(booking.status) && (
            <SectionCard title={t('bdDemoControls', lang)} description={t('bdDemoControlsDesc', lang)}>
              <div className="space-y-2">
                <Button variant="outline" className="w-full" disabled={acting} onClick={() => act({ action: 'advance' }, t('bdStatusAdvanced', lang))}>{t('bdAdvance', lang)}</Button>
                {booking.status === 'IN_PROGRESS' && !hasEvidence && (
                  <div className="space-y-2 rounded-lg border p-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold"><Camera className="h-3.5 w-3.5" /> {t('bdEvidenceCapture', lang)}</p>
                    <Input value={evidenceNote} onChange={(e) => setEvidenceNote(e.target.value)} placeholder={t('bdEvidencePh', lang)} />
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="file" accept="image/*" className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (!f) return
                          const r = new FileReader()
                          r.onload = () => setEvidencePhoto(r.result as string)
                          r.readAsDataURL(f)
                        }}
                      />
                      <span className="rounded border px-2 py-1">{t('bdAttachPhoto', lang)}</span>
                      {evidencePhoto && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                    </label>
                    <Button size="sm" className="w-full" disabled={acting} onClick={() => act({ action: 'evidence', notes: evidenceNote, photo: evidencePhoto }, t('bdEvidenceSaved', lang))}>{t('bdSaveEvidence', lang)}</Button>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {booking.status === 'CANCELLED' && <EmptyState title={t('bdCancelledState', lang)} />}
          <p className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground"><ReceiptText className="h-3 w-3" /> {t('bdPrototypeNote', lang)}</p>
        </div>
      </div>
    </div>
  )
}
