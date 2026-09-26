'use client'

import { useQuery, useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useAppStore } from '@/store/app-store'
import { t } from '@/lib/i18n'
import { api, inr } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { SectionCard, KpiCard, EmptyState, RatingStars, VerifiedBadge } from '@/components/gigsetu/shared/ui-kit'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import {
  TrendingUp, TrendingDown, Minus, FlaskConical, RefreshCw, BrainCircuit, CheckCircle2,
  GraduationCap, Briefcase, MapPin, Clock3, Zap, Wrench, Hammer, Paintbrush, Sparkles,
  Car, HeartHandshake, Leaf, Cog, Refrigerator, SlidersHorizontal, ScrollText, Users,
} from 'lucide-react'
import type {
  DemoUser, Lang, ForecastResponse, SkillGapResponse, AllocateResponse, MatchedWorkerDTO,
} from '@/lib/types'

// ---------- helpers ----------

interface TFn {
  (key: string): string
  (key: string, map: Record<string, string | number>): string
}
/** t() with {placeholder} interpolation for this view. */
function tr(lang: Lang): TFn {
  const fn = (key: string, map?: Record<string, string | number>) => {
    let s: string = t(key, lang)
    if (map) for (const [k, v] of Object.entries(map)) s = s.replaceAll(`{${k}}`, String(v))
    return s
  }
  return fn as TFn
}

const SKILL_KEYS = ['electrician', 'plumber', 'carpenter', 'painter', 'cleaning', 'driver', 'caregiver', 'gardener', 'technician', 'appliance'] as const

const SKILL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  electrician: Zap, plumber: Wrench, carpenter: Hammer, painter: Paintbrush,
  cleaning: Sparkles, driver: Car, caregiver: HeartHandshake, gardener: Leaf,
  technician: Cog, appliance: Refrigerator,
}
function skillIcon(key: string) {
  const I = SKILL_ICONS[key] ?? Sparkles
  return I
}
const SKILL_NAME_KEYS: Record<string, string> = {
  electrician: 'skElectrician', plumber: 'skPlumber', carpenter: 'skCarpenter', painter: 'skPainter',
  cleaning: 'skCleaning', driver: 'skDriver', caregiver: 'skCaregiver', gardener: 'skGardener',
  technician: 'skTechnician', appliance: 'skAppliance',
}
function skillName(key: string, tt: TFn) {
  return tt(SKILL_NAME_KEYS[key] ?? key)
}

const LAB_AREAS = ['Kothrud', 'Karve Nagar', 'Aundh', 'Baner', 'Hadapsar', 'Warje', 'Shivajinagar', 'Wakad']

function slotIso(slot: 'now' | 'evening' | 'tomorrow'): string {
  const d = new Date()
  if (slot === 'evening') { d.setHours(18, 30, 0, 0); return d.toISOString() }
  if (slot === 'tomorrow') { d.setDate(d.getDate() + 1); d.setHours(8, 30, 0, 0); return d.toISOString() }
  return d.toISOString()
}

/** API returns {key,label}[]; the shared type declares string[] — normalize here. */
function zoneChoices(d: ForecastResponse): Array<{ key: string; label: string }> {
  return (d.zoneOptions as unknown[]).map((z) =>
    typeof z === 'string' ? { key: z, label: z } : (z as { key: string; label: string }),
  )
}

function Disclaimer({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/60 px-3 py-2 text-[11px] leading-relaxed text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300" role="note">
      <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{text}</span>
    </div>
  )
}

function Retry({ onRetry, busy, label }: { onRetry: () => void; busy: boolean; label: string }) {
  return (
    <Button variant="outline" size="sm" className="mt-1 min-h-11 gap-1.5" onClick={onRetry}>
      <RefreshCw className={cn('h-3.5 w-3.5', busy && 'animate-spin')} /> {label}
    </Button>
  )
}

// ---------- Tab 1: Demand forecast ----------

function ForecastPanel({ tt }: { tt: TFn }) {
  const [zone, setZone] = useState('pune-z4')
  const q = useQuery({
    queryKey: ['ai-forecast', zone],
    queryFn: () => api.get<ForecastResponse>(`/api/ai/forecast?zone=${encodeURIComponent(zone)}`),
    staleTime: 60000,
  })
  const d = q.data

  if (q.isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-11 w-full max-w-xs" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }
  if (q.isError || !d?.ok) {
    return (
      <EmptyState icon={<FlaskConical className="h-8 w-8" />} title={tt('aiLoadFailed')}
        action={<Retry label={tt('aiRetry')} busy={q.isFetching} onRetry={() => q.refetch()} />} />
    )
  }

  // Chart geometry — responsive viewBox, one bar per day (total expected volume).
  const W = 560, H = 210, PX = 30, PT = 20, PB = 26
  const plotH = H - PT - PB
  const n = d.series.length || 1
  const slot = (W - PX * 2) / n
  const bw = slot * 0.56
  const totals = d.series.map((p) => Object.values(p.volumes).reduce((a, b) => a + b, 0))
  const maxV = Math.max(...totals, 1)

  return (
    <div className="space-y-4">
      {/* zone selector */}
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="fc-zone">{tt('fcZone')}</label>
        <Select value={zone} onValueChange={setZone}>
          <SelectTrigger id="fc-zone" className="h-11 w-full max-w-xs" aria-label={tt('fcZone')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {zoneChoices(d).map((z) => <SelectItem key={z.key} value={z.key}>{z.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {tt('aiModelRun')}: {new Date(d.generatedAt).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
        </span>
      </div>

      {/* weekend pulse cards */}
      <SectionCard title={tt('fcPulseTitle')} description={tt('fcPulseSub')}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {d.categories.map((c) => {
            const Icon = skillIcon(c.categoryKey)
            const up = c.trend === 'up'
            const TrendIcon = c.trend === 'flat' ? Minus : up ? TrendingUp : TrendingDown
            return (
              <div key={c.categoryKey} className={cn(
                'rounded-xl border p-4 transition-colors',
                up ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/25'
                   : 'border-zinc-200 bg-muted/40 dark:border-zinc-800',
              )}>
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex min-w-0 items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
                    <span className="truncate text-sm font-semibold">{c.name}</span>
                  </span>
                  <span className={cn('inline-flex items-center gap-1 text-sm font-bold tabular-nums', up ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
                    <TrendIcon className="h-4 w-4" />{c.pct > 0 ? '+' : ''}{c.pct}%
                  </span>
                </div>
                <p className="mt-2 text-xs leading-snug text-muted-foreground">
                  <span className="font-semibold text-foreground">{c.name} {c.pct > 0 ? '+' : ''}{c.pct}%</span> {tt('fcExpectedThis')}
                  <span className="block">{tt('fcBaseToExpected', { a: c.baseWeekend, b: c.expectedWeekend })}</span>
                </p>
                {c.drivers.length > 0 && (
                  <ul className="mt-2 space-y-1 border-t border-dashed pt-2" aria-label={tt('fcDrivers')}>
                    <li className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">{tt('fcDrivers')}</li>
                    {c.drivers.map((dr) => (
                      <li key={dr} className="flex items-start gap-1.5 text-[11px] leading-snug text-foreground/80">
                        <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />{dr}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </SectionCard>

      {/* 7-day SVG bar chart */}
      <SectionCard title={tt('fcChartTitle')} description={tt('fcChartSub')}>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={tt('fcChartTitle')}>
          {/* weekend bands */}
          {d.series.map((p, i) => p.isWeekend ? (
            <rect key={`band-${p.date}`} x={PX + i * slot} y={PT - 8} width={slot} height={plotH + 12}
              className="fill-amber-100/80 dark:fill-amber-900/25" rx="4" />
          ) : null)}
          {/* gridlines */}
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={PX} x2={W - PX} y1={PT + plotH - plotH * f} y2={PT + plotH - plotH * f}
                className="stroke-zinc-200 dark:stroke-zinc-800" strokeWidth="1" strokeDasharray="3 4" />
              <text x={PX - 5} y={PT + plotH - plotH * f + 3} textAnchor="end" fontSize="9"
                className="fill-zinc-400 dark:fill-zinc-500">{Math.round(maxV * f)}</text>
            </g>
          ))}
          {/* bars */}
          {d.series.map((p, i) => {
            const v = totals[i]
            const h = (v / maxV) * plotH
            const x = PX + i * slot + (slot - bw) / 2
            const y = PT + plotH - h
            return (
              <g key={p.date}>
                <title>{`${p.label} · ${v} ${tt('fcJobsShort')}`}</title>
                <rect x={x} y={y} width={bw} height={Math.max(h, 2)} rx="3"
                  className={cn(p.isWeekend ? 'fill-amber-500' : 'fill-amber-300 dark:fill-amber-800')} />
                <text x={x + bw / 2} y={y - 4} textAnchor="middle" fontSize="10" fontWeight="700"
                  className="fill-zinc-600 dark:fill-zinc-300">{v}</text>
                <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="9"
                  className={cn(p.isWeekend ? 'fill-amber-600 font-semibold dark:fill-amber-400' : 'fill-zinc-400 dark:fill-zinc-500')}>{p.label}</text>
              </g>
            )
          })}
        </svg>
        {/* legend */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t pt-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-amber-300 dark:bg-amber-800" />{tt('fcLegendWeekday')}</span>
          <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-sm bg-amber-500" />{tt('fcLegendWeekend')}</span>
          <span className="mx-1 h-4 w-px bg-border" aria-hidden />
          {d.categories.map((c) => {
            const Icon = skillIcon(c.categoryKey)
            return <span key={c.categoryKey} className="inline-flex items-center gap-1"><Icon className="h-3.5 w-3.5 text-primary" />{c.name}</span>
          })}
        </div>
      </SectionCard>

      <Disclaimer text={tt('fcDisclaimer')} />
    </div>
  )
}

// ---------- Tab 2: Skill gap ----------

function GapPanel({ tt }: { tt: TFn }) {
  const q = useQuery({
    queryKey: ['ai-skillgap'],
    queryFn: () => api.get<SkillGapResponse>('/api/ai/skill-gap?district=Pune'),
    staleTime: 60000,
  })
  const d = q.data

  if (q.isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="grid gap-3 sm:grid-cols-2"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
        <div className="grid gap-3 lg:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-44" />)}</div>
      </div>
    )
  }
  if (q.isError || !d?.ok) {
    return (
      <EmptyState icon={<FlaskConical className="h-8 w-8" />} title={tt('aiLoadFailed')}
        action={<Retry label={tt('aiRetry')} busy={q.isFetching} onRetry={() => q.refetch()} />} />
    )
  }

  const maxGap = Math.max(...d.rows.map((r) => r.gap), 1)
  const badgeCls: Record<string, string> = {
    CRITICAL: 'border-red-200 bg-red-100 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
    TIGHT: 'border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
    OK: 'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
  }
  const barCls: Record<string, string> = { CRITICAL: 'bg-red-500', TIGHT: 'bg-amber-500', OK: 'bg-emerald-500' }
  const levelKey: Record<string, string> = { CRITICAL: 'sgLevelCritical', TIGHT: 'sgLevelTight', OK: 'sgLevelOk' }

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2">
        <KpiCard label={tt('sgTotalGap')} value={d.totalGap} sub={tt('sgWorkersNeeded')} icon={<Users className="h-4 w-4" />} tone="warning" />
        <KpiCard label={tt('sgCriticalSkills')} value={d.criticalSkills.length} sub={d.criticalSkills.map((k) => skillName(k, tt)).join(' · ')} icon={<TrendingUp className="h-4 w-4" />} tone="danger" />
      </div>

      {/* per-skill cards */}
      <div className="grid gap-3 lg:grid-cols-2">
        {d.rows.map((r) => {
          const Icon = skillIcon(r.categoryKey)
          return (
            <div key={r.categoryKey} className="rounded-xl border bg-card p-4 shadow-sm dark:border-zinc-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex min-w-0 items-center gap-2">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{r.name}</span>
                    <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">{tt('sgDistrict')}: {d.districtName}</span>
                  </span>
                </span>
                <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide', badgeCls[r.gapLevel])}>
                  {tt(levelKey[r.gapLevel] ?? 'sgLevelOk')}{r.gap > 0 ? ` · ${r.gap}` : ''}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted/60 px-2 py-1.5 dark:bg-zinc-900">
                  <p className="text-[9px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">{tt('sgExpectedDemand')}</p>
                  <p className="text-sm font-bold tabular-nums">{r.expectedDemand.toLocaleString('en-IN')}</p>
                </div>
                <div className="rounded-lg bg-muted/60 px-2 py-1.5 dark:bg-zinc-900">
                  <p className="text-[9px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">{tt('sgCertified')}</p>
                  <p className="text-sm font-bold tabular-nums">{r.certifiedWorkers}</p>
                </div>
                <div className="rounded-lg bg-muted/60 px-2 py-1.5 dark:bg-zinc-900">
                  <p className="text-[9px] font-semibold uppercase leading-tight tracking-wide text-muted-foreground">{tt('sgActive')}</p>
                  <p className="text-sm font-bold tabular-nums">{r.activeWorkers}</p>
                </div>
              </div>

              {/* gap bar */}
              <div className="mt-3" role="img" aria-label={`${r.name} ${tt('sgGap')} ${r.gap}`}>
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div className={cn('h-full rounded-full transition-all', barCls[r.gapLevel])} style={{ width: `${Math.max((r.gap / maxGap) * 100, 4)}%` }} />
                </div>
                <p className="mt-1 text-[10px] text-muted-foreground">{tt('sgGap')}: {r.gap} {tt('sgWorkersNeeded')}</p>
              </div>

              {r.trainingRecommendation && (
                <div className="mt-3 flex items-start gap-2 rounded-lg bg-primary/5 px-2.5 py-2 text-[11px] leading-snug dark:bg-primary/10">
                  <GraduationCap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="font-semibold">{tt('sgTraining')}: </span>{r.trainingRecommendation}
                    {r.courseTitle && (
                      <span className="ml-1 inline-flex max-w-full items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        {tt('sgCourse')}: {r.courseTitle}
                      </span>
                    )}
                  </span>
                </div>
              )}

              <p className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                <Briefcase className="h-3.5 w-3.5 shrink-0" />{tt('sgEmployment')}: {r.employmentOpportunity}
              </p>
            </div>
          )
        })}
      </div>

      <Disclaimer text={tt('sgDisclaimer')} />
    </div>
  )
}

// ---------- Tab 3: Allocation lab ----------

function WorkerMini({ w, tt }: { w: MatchedWorkerDTO; tt: TFn }) {
  return (
    <div className="rounded-lg border bg-muted/40 p-2.5 text-[11px] dark:border-zinc-800 dark:bg-zinc-900">
      <p className="font-bold">{w.name} <span className="font-normal text-muted-foreground">· {w.cooperativeName}</span></p>
      <p className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
        <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">★ {w.rating.toFixed(1)}</span>
        <span>{tt('lbKmAway', { km: w.distanceKm })}</span>
        <span>{tt('lbEta')} ~{w.etaMin} {tt('lbMin')}</span>
      </p>
    </div>
  )
}

function LabPanel({ tt, user, toast }: { tt: TFn; user: DemoUser; toast: ReturnType<typeof useToast>['toast'] }) {
  const [skill, setSkill] = useState<string>('electrician')
  const [area, setArea] = useState<string>('Kothrud')
  const [urgency, setUrgency] = useState<string>('NORMAL')
  const [when, setWhen] = useState<string>('now')

  const m = useMutation({
    mutationFn: () => api.post<AllocateResponse>('/api/ai/allocate', {
      categoryKey: skill, area, urgency,
      scheduledAt: slotIso(when as 'now' | 'evening' | 'tomorrow'),
      customerId: user.customerId ?? undefined,
    }),
    onError: () => toast({ title: tt('aiLoadFailed'), variant: 'destructive' }),
  })
  const r = m.data

  const field = 'grid gap-1.5'
  const trigger = 'h-11 w-full'
  const fieldLabel = 'text-xs font-semibold uppercase tracking-wide text-muted-foreground'

  return (
    <div className="space-y-4">
      {/* form */}
      <SectionCard title={tt('lbTitle')} description={tt('lbSub')} actions={<SlidersHorizontal className="h-4 w-4 text-muted-foreground" />}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className={field}>
            <label className={fieldLabel}>{tt('lbSkill')}</label>
            <Select value={skill} onValueChange={setSkill}>
              <SelectTrigger className={trigger} aria-label={tt('lbSkill')}><SelectValue /></SelectTrigger>
              <SelectContent>
                {SKILL_KEYS.map((k) => <SelectItem key={k} value={k}>{skillName(k, tt)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className={field}>
            <label className={fieldLabel}>{tt('lbArea')}</label>
            <Select value={area} onValueChange={setArea}>
              <SelectTrigger className={trigger} aria-label={tt('lbArea')}><SelectValue /></SelectTrigger>
              <SelectContent>
                {LAB_AREAS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className={field}>
            <label className={fieldLabel}>{tt('lbUrgency')}</label>
            <Select value={urgency} onValueChange={setUrgency}>
              <SelectTrigger className={trigger} aria-label={tt('lbUrgency')}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="NORMAL">{tt('uNormal')}</SelectItem>
                <SelectItem value="URGENT">{tt('uUrgent')}</SelectItem>
                <SelectItem value="EMERGENCY">{tt('uEmergency')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className={field}>
            <label className={fieldLabel}>{tt('lbWhen')}</label>
            <Select value={when} onValueChange={setWhen}>
              <SelectTrigger className={trigger} aria-label={tt('lbWhen')}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="now">{tt('tNow')}</SelectItem>
                <SelectItem value="evening">{tt('tEvening')}</SelectItem>
                <SelectItem value="tomorrow">{tt('tTomorrowMorning')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button className="mt-4 h-11 w-full gap-2 text-sm font-bold sm:w-auto sm:px-8" disabled={m.isPending} onClick={() => m.mutate()}>
          {m.isPending
            ? (<><RefreshCw className="h-4 w-4 animate-spin" />{tt('lbRunning')}</>)
            : (<><SlidersHorizontal className="h-4 w-4" />{tt('lbRun')}</>)}
        </Button>
      </SectionCard>

      {/* result */}
      {m.isPending && (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-40" /><Skeleton className="h-32" /><Skeleton className="h-24" />
        </div>
      )}

      {!m.isPending && m.isError && (
        <EmptyState icon={<SlidersHorizontal className="h-8 w-8" />} title={tt('aiLoadFailed')}
          action={<Retry label={tt('aiRetry')} busy={false} onRetry={() => m.mutate()} />} />
      )}

      {!m.isPending && !m.isError && r && (!r.ok || !r.recommended) && (
        <EmptyState icon={<SlidersHorizontal className="h-8 w-8" />} title={tt('lbEmptyTitle')} body={tt('lbEmptyBody')} />
      )}

      {!m.isPending && !m.isError && r?.ok && r.recommended && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Badge variant="outline" className="h-7 gap-1.5 border-primary/40 bg-primary/10 px-3 text-[11px] font-semibold text-primary">
              <BrainCircuit className="h-3.5 w-3.5 shrink-0" />{r.aiLabel}
            </Badge>
            {r.priceRange && (
              <span className="text-xs text-muted-foreground">
                {tt('lbPriceRange')}: <span className="font-bold text-foreground">{inr(r.priceRange.floor)}–{inr(r.priceRange.ceiling)}</span>
              </span>
            )}
          </div>

          <SectionCard title={tt('lbResultTitle')}>
            {/* recommended worker card */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-base font-bold">{r.recommended.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{r.recommended.cooperativeName}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <RatingStars value={r.recommended.rating} />
                  <VerifiedBadge status={r.recommended.certStatus} />
                </div>
              </div>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">{r.recommended.certName}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{tt('lbKmAway', { km: r.recommended.distanceKm })}</span>
                <span className="inline-flex items-center gap-1 font-semibold text-primary"><Clock3 className="h-3.5 w-3.5" />{tt('lbEta')} ~{r.etaMin ?? r.recommended.etaMin} {tt('lbMin')}</span>
                <span>{tt('lbExperience', { y: r.recommended.experienceYears })}</span>
                <span>{r.recommended.completedJobs} {tt('fcJobsShort')}</span>
              </div>
              {r.recommended.skills.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.recommended.skills.slice(0, 5).map((s) => (
                    <span key={s} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">{s}</span>
                  ))}
                </div>
              )}
            </div>

            {/* matched because */}
            {r.explain.length > 0 && (
              <div className="mt-4" role="list" aria-label={tt('lbMatchedBecause')}>
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">{tt('lbMatchedBecause')}</p>
                <ul className="grid gap-1 sm:grid-cols-2">
                  {r.explain.map((e) => (
                    <li key={e} role="listitem" className="flex items-start gap-1.5 text-xs leading-snug">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />{e}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* factor table with weight bars */}
            {r.factorTable.length > 0 && (
              <div className="mt-4 border-t pt-3">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {tt('lbFactorTitle')} <span className="font-normal normal-case tracking-normal">· {tt('lbFactorSub')}</span>
                </p>
                <div className="mt-2 overflow-hidden rounded-lg border dark:border-zinc-800">
                  {r.factorTable.map((f, i) => (
                    <div key={f.label} className={cn('px-3 py-2', i % 2 === 1 && 'bg-muted/40 dark:bg-zinc-900/60')}>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="min-w-0 truncate font-semibold">
                          {f.label}<span className="font-normal text-muted-foreground"> — {f.detail}</span>
                        </span>
                        <span className="shrink-0 font-bold tabular-nums text-primary">{f.score}</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" role="img" aria-label={`${f.label} ${tt('lbWeight')} ${f.weightPct}%`}>
                          <div className="h-full rounded-full bg-primary" style={{ width: `${f.weightPct}%` }} />
                        </div>
                        <span className="w-9 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">{f.weightPct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* policy notes — dashed section */}
            {r.policyNotes.length > 0 && (
              <div className="mt-4 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-950/30" role="note">
                <p className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300"><ScrollText className="h-3.5 w-3.5" />{tt('lbPolicyTitle')}</p>
                <ul className="mt-1.5 space-y-1">
                  {r.policyNotes.map((p) => (
                    <li key={p} className="flex items-start gap-1.5 text-[11px] leading-snug text-amber-800/90 dark:text-amber-200/90">
                      <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500" />{p}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* alternatives chips */}
            {r.alternatives.length > 0 && (
              <div className="mt-4 border-t pt-3">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{tt('lbAlternatives')}</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {r.alternatives.map((w) => <WorkerMini key={w.id} w={w} tt={tt} />)}
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {!m.isPending && !m.isError && !r && (
        <EmptyState icon={<SlidersHorizontal className="h-8 w-8" />} title={tt('lbTitle')} body={tt('lbSub')} />
      )}
    </div>
  )
}

// ---------- Root view ----------

export function AiIntelligence({ user }: { user: DemoUser }) {
  const lang = useAppStore((s) => s.lang)
  const tt = tr(lang)
  const { toast } = useToast()

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-4 pb-8 md:p-6">
      <header className="space-y-1">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <BrainCircuit className="h-5 w-5 text-primary" />{tt('aiTitle')}
        </h1>
        <p className="text-sm text-muted-foreground">{tt('aiSubtitle')}</p>
      </header>

      <Tabs defaultValue="forecast">
        <TabsList className="grid h-11 w-full grid-cols-3">
          <TabsTrigger value="forecast" className="text-xs sm:text-sm">{tt('aiTabForecast')}</TabsTrigger>
          <TabsTrigger value="gap" className="text-xs sm:text-sm">{tt('aiTabGap')}</TabsTrigger>
          <TabsTrigger value="lab" className="text-xs sm:text-sm">{tt('aiTabLab')}</TabsTrigger>
        </TabsList>
        <TabsContent value="forecast" className="mt-4" data-ai-panel="forecast"><ForecastPanel tt={tt} /></TabsContent>
        <TabsContent value="gap" className="mt-4" data-ai-panel="gap"><GapPanel tt={tt} /></TabsContent>
        <TabsContent value="lab" className="mt-4" data-ai-panel="lab"><LabPanel tt={tt} user={user} toast={toast} /></TabsContent>
      </Tabs>
    </div>
  )
}
