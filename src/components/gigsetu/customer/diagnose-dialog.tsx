'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { t } from '@/lib/i18n'
import { useAppStore } from '@/store/app-store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { DemoUser, ServiceCategoryDTO } from '@/lib/types'
import {
  PhoneCall, Video, Mic, MicOff, VideoOff, PhoneOff, CheckCircle2, Info, Siren,
  Zap, Droplets, Hammer, Wrench, HardHat, ArrowLeft,
} from 'lucide-react'

/**
 * Diagnose Before Dispatch (spec §13) — simulated voice/video consultation.
 *
 * FIX: the "technician" was three hardcoded fictional people invented in this
 * file. It is now the REAL best-match worker for the chosen trade, fetched from
 * /api/match, so the consult and the eventual booking are the same cooperative
 * member rather than a fabrication.
 */
const CAT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  electrician: Zap, plumber: Droplets, carpenter: Hammer,
}

type Step = 'choose' | 'call' | 'outcome'
type CallPhase = 'dialing' | 'connected'
type Outcome = 'solved' | 'minor' | 'major' | 'emergency'

const OUTCOME_CARDS: Array<{ key: Outcome; titleKey: string; subKey: string; icon: React.ComponentType<{ className?: string }>; cls: string }> = [
  { key: 'solved', titleKey: 'dgOutcome1', subKey: 'dgOutcome1Sub', icon: CheckCircle2, cls: 'border-emerald-300 hover:border-emerald-400 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-950/40' },
  { key: 'minor', titleKey: 'dgOutcome2', subKey: 'dgOutcome2Sub', icon: Wrench, cls: 'border-primary/40 hover:border-primary hover:bg-accent' },
  { key: 'major', titleKey: 'dgOutcome3', subKey: 'dgOutcome3Sub', icon: HardHat, cls: 'border-zinc-300 hover:border-zinc-400 hover:bg-muted dark:border-zinc-700 dark:hover:border-zinc-600' },
  { key: 'emergency', titleKey: 'dgOutcome4', subKey: 'dgOutcome4Sub', icon: Siren, cls: 'border-red-200 hover:border-red-300 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/40' },
]

/**
 * Diagnose Before Dispatch (Task 13) — simulated voice/video consultation before a worker is sent.
 * No real WebRTC: connecting dots → connected call with timer → outcome → booking/emergency handoff.
 */
export function DiagnoseDialog({ user, open, onOpenChange, onBookNow, onEmergency }: {
  user: DemoUser
  open: boolean
  onOpenChange: (o: boolean) => void
  onBookNow?: (categoryKey: string, summary: string) => void
  onEmergency?: (categoryKey: string) => void
}) {
  const lang = useAppStore((s) => s.lang)
  const [step, setStep] = useState<Step>('choose')
  const [mode, setMode] = useState<'voice' | 'video'>('voice')
  const [category, setCategory] = useState('electrician')
  const [phase, setPhase] = useState<CallPhase>('dialing')
  const [seconds, setSeconds] = useState(0)
  const [muted, setMuted] = useState(false)
  const [camOff, setCamOff] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  const catsQ = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<{ ok: boolean; categories: ServiceCategoryDTO[] }>('/api/categories'),
    staleTime: 300000,
  })

  // The technician who actually answers is the real cooperative best match for
  // this trade and the customer's area — the same worker the booking will assign.
  const matchQ = useQuery({
    queryKey: ['diagnose-match', category],
    queryFn: () =>
      api.post<{ ok: boolean; best: { name: string; cooperativeName: string; rating: number } | null }>('/api/match', {
        categoryKey: category,
        area: 'Kothrud',
        urgency: 'URGENT',
      }),
    staleTime: 60000,
  })
  const persona = {
    name: matchQ.data?.best?.name ?? t('dgConnecting', lang),
    coop: matchQ.data?.best?.cooperativeName ?? t('dgCoopNetwork', lang),
  }
  const CatIcon = CAT_ICONS[category] ?? Zap
  const catLabel = (() => {
    const c = catsQ.data?.categories.find((x) => x.key === category)
    return c ? (lang === 'mr' ? c.nameMr : lang === 'hi' ? c.nameHi : c.nameEn) : category
  })()

  // Fresh session on every close (event-handler reset, not effect — no cascading renders).
  // Every close path (ESC/overlay/outcome CTA) routes through here.
  function handleOpenChange(o: boolean) {
    onOpenChange(o)
    if (!o) {
      setStep('choose'); setPhase('dialing'); setSeconds(0); setOutcome(null)
      setMuted(false); setCamOff(false)
    }
  }

  // Simulated worker joins the call after ~1.2 s
  useEffect(() => {
    if (step !== 'call' || phase !== 'dialing') return
    const id = setTimeout(() => setPhase('connected'), 1200)
    return () => clearTimeout(id)
  }, [step, phase])

  // Call timer (connected state only)
  useEffect(() => {
    if (step !== 'call' || phase !== 'connected') return
    const id = setInterval(() => setSeconds((v) => v + 1), 1000)
    return () => clearInterval(id)
  }, [step, phase])

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')
  const connected = step === 'call' && phase === 'connected'

  function endAndRecommend() {
    setStep('outcome')
  }

  function chooseOutcome(o: Outcome) {
    setOutcome(o)
    if (o === 'minor') {
      // hand off to the booking flow; the consult context travels via the callback only
      onBookNow?.(category, `${t('dgConsultSummary', lang)} — ${persona.name} (${persona.coop}) · ${catLabel}`)
      handleOpenChange(false)
    }
    if (o === 'emergency') {
      onEmergency?.(category)
      handleOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary"><PhoneCall className="h-4 w-4" /></span>
            {t('dgTitle', lang)}
          </DialogTitle>
          <DialogDescription>{t('dgSub', lang)}</DialogDescription>
        </DialogHeader>

        <p className="inline-flex w-fit items-center rounded-full border border-dashed border-amber-300 bg-amber-50/60 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          {t('dgBadge', lang)}
        </p>

        {/* STEP A — choose consult mode */}
        {step === 'choose' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">{t('dgCategory', lang)}</span>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9 flex-1" aria-label={t('dgCategory', lang)}>
                  <span className="flex items-center gap-1.5"><CatIcon className="h-4 w-4 text-primary" /><SelectValue /></span>
                </SelectTrigger>
                <SelectContent>
                  {['electrician', 'plumber', 'carpenter'].map((k) => {
                    const c = catsQ.data?.categories.find((x) => x.key === k)
                    const label = c ? (lang === 'mr' ? c.nameMr : lang === 'hi' ? c.nameHi : c.nameEn) : k
                    const I = CAT_ICONS[k] ?? Zap
                    return (
                      <SelectItem key={k} value={k}>
                        <span className="flex items-center gap-1.5"><I className="h-3.5 w-3.5 text-primary" /> {label}</span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>

            <p className="text-sm font-semibold">{t('dgChoose', lang)}</p>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => { setMode('voice'); setStep('call'); setCamOff(false) }}
                className="flex min-h-[44px] flex-col items-start gap-1.5 rounded-xl border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-primary"><PhoneCall className="h-5 w-5" /></span>
                <span className="text-sm font-bold">{t('dgVoice', lang)}</span>
                <span className="text-[11px] leading-snug text-muted-foreground">{t('dgVoiceSub', lang)}</span>
              </button>
              <button
                type="button"
                onClick={() => { setMode('video'); setStep('call') }}
                className="flex min-h-[44px] flex-col items-start gap-1.5 rounded-xl border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-primary"><Video className="h-5 w-5" /></span>
                <span className="text-sm font-bold">{t('dgVideo', lang)}</span>
                <span className="text-[11px] leading-snug text-muted-foreground">{t('dgVideoSub', lang)}</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP B — simulated call */}
        {step === 'call' && (
          <div className="space-y-4">
            <div className={cn('relative overflow-hidden rounded-xl border p-5', mode === 'video' ? 'bg-zinc-900 dark:bg-zinc-950' : 'bg-accent/50 dark:bg-accent/20')}>
              {mode === 'video' && (
                <p aria-hidden className="absolute inset-x-0 top-0 bg-gradient-to-b from-zinc-800/80 to-transparent px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-zinc-300">
                  {mode === 'video' ? `${t('dgYou', lang)} · camera ${camOff ? 'off' : 'live'} (simulated)` : ''}
                </p>
              )}
              <div className="flex flex-col items-center gap-3 pt-2">
                {/* avatar with pulsing ring while connected */}
                <span className="relative flex h-20 w-20 items-center justify-center">
                  {connected && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-primary/25 motion-reduce:animate-none" />}
                  <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                    <CatIcon className="h-7 w-7" />
                  </span>
                </span>

                {phase === 'dialing' ? (
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-sm font-medium">{t('dgConnecting', lang)}</p>
                    <div className="flex gap-1.5" aria-hidden>
                      {[0, 1, 2].map((i) => (
                        <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-primary/60 motion-reduce:animate-none" style={{ animationDelay: `${i * 150}ms` }} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-center">
                    <p className="text-sm font-bold">{persona.name} <span className="font-normal text-muted-foreground">{t('dgJoined', lang)}</span></p>
                    <p className="text-[11px] text-muted-foreground">{persona.coop} · {catLabel}</p>
                    <p className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{t('dgConsultLive', lang)} · {mm}:{ss}</p>
                  </div>
                )}

                {/* waveform placeholder — animated bars (CSS only) */}
                <div className="flex h-8 items-end justify-center gap-1" aria-hidden>
                  {(muted ? [0.3, 0.2, 0.3, 0.2, 0.3, 0.2, 0.3] : [0.5, 0.9, 0.6, 1, 0.7, 0.85, 0.55]).map((h, i) => (
                    <span
                      key={i}
                      className={cn('w-1.5 rounded-full', connected && !muted ? 'animate-pulse bg-primary/70 motion-reduce:animate-none' : 'bg-muted-foreground/30')}
                      style={{ height: `${h * 100}%`, animationDelay: `${i * 120}ms`, animationDuration: '900ms' }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* visual-only call controls (44px targets) */}
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline" size="icon" className="h-11 w-11 rounded-full"
                aria-pressed={muted} aria-label={muted ? t('dgUnmute', lang) : t('dgMute', lang)}
                onClick={() => setMuted((m) => !m)}
              >
                {muted ? <MicOff className="h-4.5 w-4.5 text-destructive" /> : <Mic className="h-4.5 w-4.5" />}
              </Button>
              <Button
                variant="outline" size="icon" className="h-11 w-11 rounded-full"
                aria-pressed={camOff} aria-label={camOff ? t('dgCamOn', lang) : t('dgCamOff', lang)}
                onClick={() => setCamOff((c) => !c)}
              >
                {camOff ? <VideoOff className="h-4.5 w-4.5 text-destructive" /> : <Video className="h-4.5 w-4.5" />}
              </Button>
            </div>

            <Button variant="destructive" className="h-11 w-full" onClick={endAndRecommend}>
              <PhoneOff className="mr-2 h-4 w-4" /> {t('dgEndRecommend', lang)}
            </Button>
          </div>
        )}

        {/* STEP C — outcome */}
        {step === 'outcome' && (
          <div className="space-y-3">
            {!outcome && (
              <>
                <p className="text-sm font-semibold">{t('dgOutcomeTitle', lang)}</p>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {OUTCOME_CARDS.map((c) => {
                    const I = c.icon
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => chooseOutcome(c.key)}
                        className={cn('flex min-h-[44px] flex-col items-start gap-1 rounded-xl border bg-card p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring', c.cls)}
                      >
                        <span className="flex items-center gap-1.5 text-sm font-bold">
                          <I className={cn('h-4 w-4', c.key === 'solved' ? 'text-emerald-600' : c.key === 'emergency' ? 'text-destructive' : c.key === 'minor' ? 'text-primary' : 'text-muted-foreground')} />
                          {t(c.titleKey, lang)}
                        </span>
                        <span className="text-[11px] leading-snug text-muted-foreground">{t(c.subKey, lang)}</span>
                      </button>
                    )
                  })}
                </div>
                <Button variant="ghost" className="w-full" onClick={() => setStep('call')}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> {t('dgBackToOutcomes', lang)}
                </Button>
              </>
            )}

            {outcome === 'solved' && (
              <div className="space-y-3">
                <div className="flex items-start gap-2.5 rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 dark:border-emerald-800 dark:bg-emerald-950/40">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300">{t('dgOutcome1', lang)}</p>
                    <p className="text-xs leading-relaxed text-emerald-700 dark:text-emerald-400">{t('dgSolvedNote', lang)}</p>
                  </div>
                </div>
                <Button className="h-11 w-full" onClick={() => handleOpenChange(false)}>{t('dgClose', lang)}</Button>
              </div>
            )}

            {outcome === 'major' && (
              <div className="space-y-3">
                <div className="flex items-start gap-2.5 rounded-xl border border-dashed p-3.5">
                  <Info className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-bold">{t('dgOutcome3', lang)}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{t('dgRoutedNote', lang)}</p>
                  </div>
                </div>
                <Button className="h-11 w-full" onClick={() => handleOpenChange(false)}>{t('dgClose', lang)}</Button>
              </div>
            )}

            {outcome === 'emergency' && (
              <div className="space-y-3">
                <div className="flex items-start gap-2.5 rounded-xl border border-red-300 bg-red-50 p-3.5 dark:border-red-900 dark:bg-red-950/40">
                  <Siren className="mt-0.5 h-5 w-5 shrink-0 animate-pulse text-destructive motion-reduce:animate-none" />
                  <div>
                    <p className="text-sm font-bold text-red-800 dark:text-red-300">{t('dgOutcome4', lang)}</p>
                    <p className="text-xs leading-relaxed text-red-700 dark:text-red-400">{t('dgEmergencyNote', lang)}</p>
                  </div>
                </div>
                <Button variant="destructive" className="h-11 w-full" onClick={() => { onEmergency?.(category); handleOpenChange(false) }}>
                  <Siren className="mr-2 h-4 w-4" /> {t('dgOpenEmergency', lang)}
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
