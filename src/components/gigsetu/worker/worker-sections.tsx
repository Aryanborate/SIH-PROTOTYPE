'use client'

// Worker app tab sections: Jobs, Earnings, Welfare, Training, Ratings

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { useToast } from '@/hooks/use-toast'
import { api, inr, timeAgo } from '@/lib/api-client'
import { t } from '@/lib/i18n'
import { KpiCard, SectionCard, EmptyState, PrototypeNotice } from '../shared/ui-kit'
import { useSkillLabel } from '../shared/skill-label'
import { useAppStore } from '@/store/app-store'
import { BookingRow, JobActionCard, isActiveJob, useJobActions } from './job-card'
import { TrustReportButton } from './trust-report-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import type { BookingDTO, DemoUser, WelfareWalletDTO, WorkerEarningsDTO, TrustWorkerDTO, Lang } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  Award, BadgeCheck, Clock3, Fingerprint, Gift, GraduationCap, Inbox, LifeBuoy, Loader2, MapPinned, MessageSquareText,
  PiggyBank, RefreshCw, Search, ShieldCheck, Star, TrendingUp, Users, Wallet,
} from 'lucide-react'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// Shared scroll list styling — thin scrollbar, webkit-styled to match the cooperative dashboard
const SCROLL_LIST = 'max-h-96 space-y-2.5 overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 [&::-webkit-scrollbar]:w-1.5 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-700'

function dayLabel(d: string): string {
  // d is 'YYYY-MM-DD' — parse by slicing to stay timezone-safe
  return `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1] ?? '?'}`
}

interface TFn {
  (key: string): string
  (key: string, map: Record<string, string | number>): string
}
/** t() with {placeholder} interpolation for the Phase 5 worker sections. */
function tr(lang: Lang): TFn {
  const fn = (key: string, map?: Record<string, string | number>) => {
    let s: string = t(key, lang)
    if (map) for (const [k, v] of Object.entries(map)) s = s.replaceAll(`{${k}}`, String(v))
    return s
  }
  return fn as TFn
}

/** Compact inline retry card for a failed Phase 5 side query (main section still renders). */
function SideQueryError({ onRetry, labelKey }: { onRetry: () => void; labelKey: string }) {
  const lang = useAppStore((s) => s.lang)
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-amber-300 bg-amber-50/50 px-3 py-2.5 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
      <span>{t(labelKey, lang)}</span>
      <Button variant="outline" size="sm" className="min-h-9" onClick={onRetry}>
        <RefreshCw className="mr-1.5 h-3 w-3" /> Retry
      </Button>
    </div>
  )
}

export function LoadingBlock() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  )
}

export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState
      title="Could not load data"
      body="The cooperative network is not responding. Check the connection and retry."
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
        </Button>
      }
    />
  )
}

// ============================================================
// JOBS
// ============================================================

type HistoryFilter = 'ALL' | 'AWAITING_PAYMENT' | 'SETTLED' | 'CANCELLED'

const HISTORY_FILTERS: Array<{ key: HistoryFilter; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'AWAITING_PAYMENT', label: 'Awaiting payment' },
  { key: 'SETTLED', label: 'Settled' },
  { key: 'CANCELLED', label: 'Cancelled' },
]

function historyBucket(b: BookingDTO): HistoryFilter | null {
  if (b.status === 'CANCELLED') return 'CANCELLED'
  if (b.status === 'COMPLETED') return 'AWAITING_PAYMENT'
  if (b.status === 'PAID' || b.status === 'REVIEWED') return 'SETTLED'
  return null
}

export function JobsSection({ user }: { user: DemoUser }) {
  const wid = user.workerId ?? ''
  const lang = useAppStore((s) => s.lang)
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('ALL')
  const [historySearch, setHistorySearch] = useState('')
  const q = useQuery({
    queryKey: ['worker-jobs', wid],
    queryFn: () => api.get<{ ok: boolean; jobs: BookingDTO[] }>(`/api/worker?id=${wid}&section=jobs`),
    enabled: !!wid,
    refetchInterval: 8000,
  })
  const actions = useJobActions(wid)
  const jobs = q.data?.jobs ?? []
  const active = useMemo(() => jobs.filter(isActiveJob), [jobs])
  const history = useMemo(() => jobs.filter((b) => historyBucket(b) !== null), [jobs])

  const filteredHistory = useMemo(() => {
    const s = historySearch.trim().toLowerCase()
    return history
      .filter((b) => historyFilter === 'ALL' || historyBucket(b) === historyFilter)
      .filter((b) => !s || [b.title, b.refCode, b.area, b.customerName ?? '', b.review ?? ''].some((v) => v.toLowerCase().includes(s)))
  }, [history, historyFilter, historySearch])
  const viewEarnings = filteredHistory.reduce((sum, b) => sum + (b.payment?.workerShare ?? b.finalPrice ?? b.estimatedPrice ?? 0), 0)

  if (q.isLoading) return <LoadingBlock />
  if (q.isError) return <LoadError onRetry={() => void q.refetch()} />

  return (
    <div className="space-y-4">
      <SectionCard
        title={`${t('activeJobsTitle', lang)} (${active.length})`}
        description={t('activeJobsDesc', lang)}
      >
        {active.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-10 w-10 text-primary/40" />}
            title={t('noActiveJobs', lang)}
            body={t('noActiveJobsBody', lang)}
          />
        ) : (
          <div className="space-y-3">
            {active.map((b) => <JobActionCard key={b.id} b={b} actions={actions} />)}
          </div>
        )}
      </SectionCard>

      <SectionCard title={`${t('jobHistoryTitle', lang)} (${history.length})`} description={t('jobHistoryDesc', lang)}>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <div className="inline-flex w-fit flex-wrap rounded-lg border bg-card p-0.5" role="group" aria-label="Filter job history">
            {HISTORY_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setHistoryFilter(f.key)}
                aria-pressed={historyFilter === f.key}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[11px] font-semibold transition',
                  historyFilter === f.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative sm:w-56">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder={t('searchJobsPh', lang)}
              className="h-8 pl-8 text-xs"
              aria-label="Search job history"
            />
          </div>
        </div>
        {history.length === 0 ? (
          <EmptyState
            icon={<Clock3 className="h-10 w-10 text-muted-foreground/40" />}
            title="No history yet"
            body="Completed jobs will appear here with your earnings and customer reviews."
          />
        ) : filteredHistory.length === 0 ? (
          <EmptyState
            title="Nothing here yet"
            body={`No ${HISTORY_FILTERS.find((f) => f.key === historyFilter)?.label.toLowerCase() ?? ''} jobs match${historySearch ? ` “${historySearch}”` : ''} — try a different filter or search.`}
          />
        ) : (
          <>
            <div className={SCROLL_LIST}>
              {filteredHistory.map((b) => <BookingRow key={b.id} b={b} />)}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-dashed pt-2.5 text-xs">
              <span className="text-muted-foreground">
                {filteredHistory.length} / {history.length} {t('jobsInView', lang)}
              </span>
              <span className="font-semibold tabular-nums">
                {t('workerShareInView', lang)} <span className="text-emerald-600 dark:text-emerald-400">{inr(viewEarnings)}</span>
              </span>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  )
}

// ============================================================
// EARNINGS
// ============================================================

interface EarningsData {
  ok: boolean
  daily: Array<{ date: string; jobs: number; earnings: number }>
  monthTotal: number
  lifetimeJobs: number
  payouts: BookingDTO[]
}

function EarningsTip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: { date: string; jobs: number; earnings: number } }> }) {
  if (!active || !payload?.length || !payload[0]?.payload) return null
  const p = payload[0].payload
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-semibold">{dayLabel(p.date)}</p>
      <p className="tabular-nums text-muted-foreground">{inr(p.earnings)} · {p.jobs} job{p.jobs === 1 ? '' : 's'}</p>
    </div>
  )
}

// ============================================================
// EARNINGS — Phase 5 boost (#39): 4 KPIs + 7-day SVG chart + category mix
// ============================================================

/** Custom SVG bar chart (no chart lib) — amber bars per day, value labels on hover via <title>. */
function WeekBars({ series, tt }: { series: WorkerEarningsDTO['weekSeries']; tt: TFn }) {
  const W = 560, H = 150, PT = 14, PB = 24, PX = 36
  const plotH = H - PT - PB
  const n = series.length || 1
  const slot = (W - PX * 2) / n
  const bw = Math.min(slot * 0.5, 40)
  const maxV = Math.max(...series.map((p) => p.amount), 1)
  const fmtAxis = (v: number) => (v >= 1000 ? `₹${(v / 1000).toFixed(1)}k` : `₹${Math.round(v)}`)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={tt('erChartAria')}>
      {/* gridlines */}
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={PX} x2={W - PX} y1={PT + plotH - plotH * f} y2={PT + plotH - plotH * f}
            className="stroke-zinc-200 dark:stroke-zinc-800" strokeWidth="1" strokeDasharray="3 4" />
          <text x={PX - 5} y={PT + plotH - plotH * f + 3} textAnchor="end" fontSize="9" className="fill-zinc-400 dark:fill-zinc-500">
            {fmtAxis(maxV * f)}
          </text>
        </g>
      ))}
      {/* bars */}
      {series.map((p, i) => {
        const h = (p.amount / maxV) * plotH
        const x = PX + i * slot + (slot - bw) / 2
        const y = PT + plotH - h
        const earned = p.amount > 0
        return (
          <g key={p.date}>
            <title>{`${p.day} ${dayLabel(p.date)} · ${inr(p.amount)} · ${p.jobs} ${tt('erJobsShort')}`}</title>
            <rect x={x} y={y} width={bw} height={Math.max(h, 2)} rx="3"
              className={earned ? 'fill-amber-500' : 'fill-zinc-200 dark:fill-zinc-800'} />
            <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="9"
              className={earned ? 'fill-amber-600 font-semibold dark:fill-amber-400' : 'fill-zinc-400 dark:fill-zinc-500'}>
              {p.day}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

const MIX_SHADES = ['bg-amber-600', 'bg-amber-500', 'bg-amber-400', 'bg-amber-300', 'bg-amber-200']

function EarningsBoost({ wid }: { wid: string }) {
  const lang = useAppStore((s) => s.lang)
  const tt = tr(lang)
  const skillLabel = useSkillLabel()
  const q = useQuery({
    queryKey: ['welfare-earnings5', wid],
    queryFn: () => api.get<WorkerEarningsDTO>(`/api/earnings?workerId=${wid}`),
    enabled: !!wid,
    staleTime: 30000,
  })

  if (q.isLoading) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
        <Skeleton className="h-44 w-full" />
      </div>
    )
  }
  if (q.isError || !q.data) return <SideQueryError onRetry={() => void q.refetch()} labelKey="erLoadFailed" />
  const d = q.data
  const mix = d.categoryMix.slice(0, 5)
  const weekTotal = d.weekSeries.reduce((s, p) => s + p.amount, 0)

  return (
    <div className="space-y-4">
      {/* 4 KPI cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label={tt('erToday')} value={inr(d.today)} tone="success" icon={<Wallet className="h-4 w-4" />} sub={tt('erTodaySub', { n: d.todayJobs })} />
        <KpiCard label={tt('erThisWeek')} value={inr(d.week)} icon={<TrendingUp className="h-4 w-4" />} sub={inr(weekTotal)} />
        <KpiCard label={t('thisMonth', lang)} value={inr(d.month)} tone="primary" icon={<Award className="h-4 w-4" />} sub={`${d.completedJobs} ${t('lifetimeJobsLabel', lang).toLowerCase()}`} />
        <KpiCard label={tt('erPending')} value={inr(d.pending)} tone="warning" icon={<Clock3 className="h-4 w-4" />} sub={tt('erPendingSub')} className="col-span-2 lg:col-span-1" />
      </div>

      {/* 7-day SVG bar chart */}
      <SectionCard title={tt('erChartTitle')} description={tt('erChartSub')}>
        {weekTotal === 0 ? (
          <EmptyState icon={<Wallet className="h-8 w-8 text-muted-foreground/40" />} title={tt('erNoEarnings')} />
        ) : (
          <WeekBars series={d.weekSeries} tt={tt} />
        )}
      </SectionCard>

      {/* Category mix */}
      {mix.length > 0 && (
        <SectionCard title={tt('erMixTitle')} description={tt('erMixSub')}>
          {/* stacked bar */}
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label={tt('erMixTitle')}>
            {mix.map((c, i) => (
              <div key={c.key} className={MIX_SHADES[i % MIX_SHADES.length]} style={{ width: `${c.pct ?? 0}%` }} title={`${skillLabel(c.key)} · ${c.pct ?? 0}%`} />
            ))}
          </div>
          <div className="mt-3 grid gap-1.5 sm:grid-cols-2">
            {mix.map((c, i) => (
              <div key={c.key} className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5">
                <span className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-sm', MIX_SHADES[i % MIX_SHADES.length])} aria-hidden />
                <span className="min-w-0 flex-1 truncate text-xs font-medium">{skillLabel(c.key)}</span>
                <span className="text-xs font-semibold tabular-nums">{inr(c.amount)}</span>
                <Badge variant="secondary" className="shrink-0 tabular-nums">{c.pct ?? 0}%</Badge>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <PrototypeNotice>{d.prototypeNote}</PrototypeNotice>
    </div>
  )
}

export function EarningsSection({ user }: { user: DemoUser }) {
  const wid = user.workerId ?? ''
  const lang = useAppStore((s) => s.lang)
  const q = useQuery({
    queryKey: ['worker-earnings', wid],
    queryFn: () => api.get<EarningsData>(`/api/worker?id=${wid}&section=earnings`),
    enabled: !!wid,
  })
  const data = q.data
  const payouts = data?.payouts ?? []
  const avgPayout = payouts.length ? Math.round(payouts.reduce((s, b) => s + (b.payment?.workerShare ?? 0), 0) / payouts.length) : 0

  if (q.isLoading) return <LoadingBlock />
  if (q.isError) return <LoadError onRetry={() => void q.refetch()} />

  return (
    <div className="space-y-4">
      <EarningsBoost wid={wid} />

      <div className="grid grid-cols-2 gap-3">
        <KpiCard label={t('lifetimeJobsLabel', lang)} value={(data?.lifetimeJobs ?? 0).toLocaleString('en-IN')} icon={<Award className="h-4 w-4" />} />
        <KpiCard label={t('avgPayoutLabel', lang)} value={avgPayout ? inr(avgPayout) : '—'} tone="success" icon={<TrendingUp className="h-4 w-4" />} sub={`${t('lastPayouts', lang)} ${payouts.length} ${t('payoutsWord', lang)}`} />
      </div>

      <SectionCard
        title={t('dailyEarningsTitle', lang)}
        description={t('dailyEarningsDesc', lang)}
      >
        {!data?.daily.length ? (
          <EmptyState title="No paid jobs yet" body="Your daily earnings chart appears once jobs are completed and paid." />
        ) : (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.daily} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="date" tickFormatter={dayLabel} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
                <YAxis tickFormatter={(v: number) => (v >= 1000 ? `₹${(v / 1000).toFixed(1)}k` : `₹${v}`)} tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} width={44} />
                <Tooltip content={<EarningsTip />} cursor={{ fill: 'var(--accent)' }} />
                <Bar dataKey="earnings" fill="#d97706" radius={[4, 4, 0, 0]} maxBarSize={26} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>

      <SectionCard title={t('recentPayoutsTitle', lang)} description={t('recentPayoutsDesc', lang)}>
        {payouts.length === 0 ? (
          <EmptyState title="No payouts yet" body="Settlements appear here within hours of each completed, paid job." />
        ) : (
          <div className={cn(SCROLL_LIST, 'space-y-2')}>
            {payouts.map((b) => (
              <div key={b.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 transition hover:border-primary/40">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{b.title}</p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-mono">{b.refCode}</span> · {b.payment?.method ?? 'UPI'} · {timeAgo(b.payment?.paidAt ?? b.scheduledAt)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{inr(b.payment?.workerShare)}</p>
                  <p className="text-[10px] text-muted-foreground">{t('yourNetShare', lang)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

// ============================================================
// WELFARE
// ============================================================

interface WelfareData {
  ok: boolean
  balance: number
  contributions: number
  benefits: number
  ledger: Array<{ id: string; type: 'CONTRIBUTION' | 'BENEFIT'; amount: number; note: string; createdAt: string }>
  schemes: Array<{ name: string; status: string; detail: string }>
}

function SchemeBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
    ELIGIBLE: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
    CLAIMED: 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400',
    LAPSED: 'border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400',
  }
  return <Badge variant="outline" className={cn('shrink-0', map[status] ?? map.CLAIMED)}>{status}</Badge>
}

// ---------- Phase 5 welfare wallet status (#21) ----------

function fmtDate(d: string): string {
  if (!d) return '—'
  // 'YYYY-MM-DD' — parse by slicing to stay timezone-safe
  return `${Number(d.slice(8, 10))} ${MONTHS[Number(d.slice(5, 7)) - 1] ?? '?'} ${d.slice(0, 4)}`
}

const WW_GOOD = new Set(['ACTIVE', 'UP_TO_DATE', 'VALID', 'LINKED', 'AVAILABLE', 'ELIGIBLE'])
const WW_WARN = new Set(['PENDING', 'DUE', 'EXPIRING', 'IN_PROGRESS'])
const WW_BAD = new Set(['EXPIRED', 'OVERDUE', 'NOT_LINKED', 'LAPSED'])

const WW_TONES: Record<string, { tile: string; badge: string }> = {
  good: {
    tile: 'border-emerald-200/80 bg-emerald-50/40 dark:border-emerald-900/70 dark:bg-emerald-950/20',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
  },
  warn: {
    tile: 'border-amber-200/80 bg-amber-50/40 dark:border-amber-900/70 dark:bg-amber-950/20',
    badge: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
  },
  bad: {
    tile: 'border-red-200/80 bg-red-50/40 dark:border-red-900/70 dark:bg-red-950/20',
    badge: 'border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400',
  },
  neutral: {
    tile: 'border-border bg-muted/40',
    badge: 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400',
  },
}

function wwTone(status: string) {
  if (WW_BAD.has(status)) return WW_TONES.bad
  if (WW_WARN.has(status)) return WW_TONES.warn
  if (WW_GOOD.has(status)) return WW_TONES.good
  return WW_TONES.neutral
}

const WW_STATUS_KEYS: Record<string, string> = {
  ACTIVE: 'wwStActive', PENDING: 'wwStPending', EXPIRED: 'wwStExpired',
  UP_TO_DATE: 'wwStUpToDate', DUE: 'wwStDue', OVERDUE: 'wwStOverdue',
  VALID: 'wwStValid', EXPIRING: 'wwStExpiring', LINKED: 'wwStLinked',
  NOT_LINKED: 'wwStNotLinked', AVAILABLE: 'wwStAvailable', ELIGIBLE: 'wwStEligible',
}

interface WelfareTile {
  key: string
  icon: React.ReactNode
  label: string
  badge: string
  tone: { tile: string; badge: string }
  lines: string[]
}

function WelfareWalletStatus({ wid }: { wid: string }) {
  const lang = useAppStore((s) => s.lang)
  const tt = tr(lang)
  const q = useQuery({
    queryKey: ['welfare-wallet', wid],
    queryFn: () => api.get<WelfareWalletDTO>(`/api/welfare?workerId=${wid}`),
    enabled: !!wid,
    staleTime: 30000,
  })

  if (q.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-64 max-w-full" />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      </div>
    )
  }
  if (q.isError || !q.data) return <SideQueryError onRetry={() => void q.refetch()} labelKey="wwLoadFailed" />
  const d = q.data
  const benefitsValue = d.benefits.reduce((s, b) => s + (b.valueRs ?? 0), 0)
  const anyCashValue = d.benefits.some((b) => b.valueRs != null)
  const emTone = wwTone(d.emergencySupport.status)

  const tiles: WelfareTile[] = [
    {
      key: 'insurance', icon: <ShieldCheck className="h-3.5 w-3.5" />, label: tt('wwInsurance'),
      badge: tt(WW_STATUS_KEYS[d.insurance.status] ?? d.insurance.status), tone: wwTone(d.insurance.status),
      lines: [tt('wwPolicy', { no: d.insurance.policy }), `${inr(d.insurance.coverRs)} ${tt('wwCoverLabel')}`, tt('wwRenews', { date: fmtDate(d.insurance.renewal) })],
    },
    {
      key: 'training', icon: <GraduationCap className="h-3.5 w-3.5" />, label: tt('wwTraining'),
      badge: tt(WW_STATUS_KEYS[d.training.status] ?? d.training.status), tone: wwTone(d.training.status),
      lines: [tt('wwNextDue', { date: fmtDate(d.training.nextDue) })],
    },
    {
      key: 'cert', icon: <BadgeCheck className="h-3.5 w-3.5" />, label: tt('wwCertification'),
      badge: tt(WW_STATUS_KEYS[d.certification.status] ?? d.certification.status), tone: wwTone(d.certification.status),
      lines: [d.certification.name, tt('wwExpires', { date: fmtDate(d.certification.expiry) })],
    },
    {
      key: 'ss', icon: <Fingerprint className="h-3.5 w-3.5" />, label: tt('wwSocialSecurity'),
      badge: tt(WW_STATUS_KEYS[d.socialSecurity.status] ?? d.socialSecurity.status), tone: wwTone(d.socialSecurity.status),
      lines: [d.socialSecurity.id, d.socialSecurity.scheme],
    },
    {
      key: 'benefits', icon: <Gift className="h-3.5 w-3.5" />, label: tt('wwBenefits'),
      badge: tt('wwAvailCount', { n: d.benefits.length }), tone: WW_TONES.good,
      lines: [anyCashValue ? inr(benefitsValue) : tt('wwNoCashValue'), tt('wwBenefitsSub')],
    },
  ]

  return (
    <SectionCard title={tt('wwStatusTitle')} description={tt('wwStatusSub')}>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((tl) => (
          <div key={tl.key} className={cn('rounded-xl border p-3 transition', tl.tone.tile)}>
            <div className="flex items-center justify-between gap-1.5">
              <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold">
                {tl.icon}<span className="truncate">{tl.label}</span>
              </span>
              <Badge variant="outline" className={cn('shrink-0 px-1.5 py-0 text-[9px] font-bold leading-4', tl.tone.badge)}>{tl.badge}</Badge>
            </div>
            <div className="mt-2 space-y-0.5">
              {tl.lines.map((l, i) => (
                <p key={i} className={cn('truncate text-[10px] leading-snug', i === 0 ? 'font-medium text-foreground/80' : 'text-muted-foreground')}>
                  {l}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Benefits — horizontal list */}
      {d.benefits.length > 0 && (
        <div className="mt-4 border-t border-dashed pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tt('wwBenefitsTitle')}</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {d.benefits.map((b) => (
              <div key={b.name} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-sm font-semibold leading-snug">{b.name}</p>
                  <Badge variant="outline" className={cn('shrink-0 px-1.5 py-0 text-[9px] font-bold leading-4', wwTone(b.status).badge)}>
                    {tt(WW_STATUS_KEYS[b.status] ?? b.status)}
                  </Badge>
                </div>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">{b.detail}</p>
                <p className="mt-1.5 text-xs font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {b.valueRs != null ? tt('wwWorthUpTo', { amt: inr(b.valueRs) }) : tt('wwNoCashValue')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Emergency support strip */}
      <div className={cn('mt-3 flex items-start gap-3 rounded-xl border p-3.5', emTone.tile)}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
          <LifeBuoy className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{tt('wwEmergencyTitle')}</p>
          <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{d.emergencySupport.note}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-bold tabular-nums">{inr(d.emergencySupport.fundRs)}</p>
          <Badge variant="outline" className={cn('px-1.5 py-0 text-[9px] font-bold leading-4', emTone.badge)}>
            {tt(WW_STATUS_KEYS[d.emergencySupport.status] ?? d.emergencySupport.status)}
          </Badge>
        </div>
      </div>

      <PrototypeNotice className="mt-3">
        <span className="font-semibold">{tt('wwPrototypeLabel')}</span> — {String(d.prototypeNote ?? 'Prototype welfare integration').replace(/^Prototype welfare integration\s*[—\-–]?\s*/i, '')}
      </PrototypeNotice>
    </SectionCard>
  )
}

export function WelfareSection({ user }: { user: DemoUser }) {
  const wid = user.workerId ?? ''
  const lang = useAppStore((s) => s.lang)
  const q = useQuery({
    queryKey: ['worker-welfare', wid],
    queryFn: () => api.get<WelfareData>(`/api/worker?id=${wid}&section=welfare`),
    enabled: !!wid,
  })
  const d = q.data

  if (q.isLoading) return <LoadingBlock />
  if (q.isError) return <LoadError onRetry={() => void q.refetch()} />

  return (
    <div className="space-y-4">
      <WelfareWalletStatus wid={wid} />

      <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-emerald-100/60 p-5 dark:border-emerald-900 dark:from-emerald-950/50 dark:to-emerald-950/20">
        <p className="text-xs font-medium uppercase tracking-wide text-emerald-800/70 dark:text-emerald-300/70">{t('welfareWallet', lang)}</p>
        <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-emerald-700 dark:text-emerald-300">{inr(d?.balance)}</p>
        <p className="mt-1 text-xs text-emerald-800/70 dark:text-emerald-300/70">
          {t('welfareWalletBody', lang)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <KpiCard label={t('contribIn', lang)} value={inr(d?.contributions)} tone="primary" icon={<PiggyBank className="h-4 w-4" />} sub={t('contribSub', lang)} />
        <KpiCard label={t('benefitsIn', lang)} value={inr(d?.benefits)} tone="success" icon={<Gift className="h-4 w-4" />} sub={t('benefitsSub', lang)} />
      </div>

      <SectionCard title={t('schemeEligTitle', lang)} description={t('schemeEligDesc', lang)}>
        <div className="space-y-2">
          {(d?.schemes ?? []).map((s) => (
            <div key={s.name} className="flex items-start justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{s.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.detail}</p>
              </div>
              <SchemeBadge status={s.status} />
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title={t('welfareLedgerTitle', lang)} description={t('welfareLedgerDesc', lang)}>
        {(d?.ledger ?? []).length === 0 ? (
          <EmptyState
            icon={<PiggyBank className="h-10 w-10 text-emerald-500/40" />}
            title="Ledger is empty"
            body="Your 2% welfare contribution from every paid job lands here automatically."
          />
        ) : (
          <div className={cn(SCROLL_LIST, 'space-y-2')}>
            {d!.ledger.map((l) => (
              <div key={l.id} className="flex items-start gap-3 rounded-lg border p-3">
                <span className={cn(
                  'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                  l.type === 'CONTRIBUTION' ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
                )}>
                  {l.type === 'CONTRIBUTION' ? <PiggyBank className="h-3.5 w-3.5" /> : <Gift className="h-3.5 w-3.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium leading-snug">{l.note}</p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{l.type === 'CONTRIBUTION' ? t('contribution', lang) : t('benefit', lang)} · {timeAgo(l.createdAt)}</p>
                </div>
                <p className={cn('shrink-0 text-sm font-bold tabular-nums', l.type === 'CONTRIBUTION' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')}>
                  {l.type === 'CONTRIBUTION' ? '−' : '+'}{inr(l.amount)}
                </p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

// ============================================================
// TRAINING
// ============================================================

interface TrainingCourse {
  id: string
  title: string
  categoryKey: string
  provider: string
  durationHrs: number
  mode: string
  certification: string
  seats: number
}

interface TrainingData {
  ok: boolean
  courses: TrainingCourse[]
  enrollments: Array<{ id: string; courseId: string; progress: number; status: string; course: TrainingCourse }>
  recommended: TrainingCourse[]
  trainingsDone: number
}

function ModeBadge({ mode }: { mode: string }) {
  if (mode === 'ONLINE') {
    return <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">Online</Badge>
  }
  return <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">Field</Badge>
}

export function TrainingSection({ user }: { user: DemoUser }) {
  const wid = user.workerId ?? ''
  const lang = useAppStore((s) => s.lang)
  const qc = useQueryClient()
  const [pendingEnrollment, setPendingEnrollment] = useState<string | null>(null)
  const [enrollingCourse, setEnrollingCourse] = useState<string | null>(null)
  const q = useQuery({
    queryKey: ['worker-training', wid],
    queryFn: () => api.get<TrainingData>(`/api/worker?id=${wid}&section=training`),
    enabled: !!wid,
  })
  const d = q.data
  const enrollmentByCourse = new Map((d?.enrollments ?? []).map((e) => [e.courseId, e]))
  const { toast } = useToast()
  const recommendedIds = new Set((d?.recommended ?? []).map((c) => c.id))

  // FIX: both of these had an empty `.catch(() => {})`, so an enrolment or
  // progress update that failed left the worker with a spinner that stopped and
  // no indication that anything went wrong.
  function enroll(courseId: string) {
    setEnrollingCourse(courseId)
    api.patch('/api/worker', { id: wid, action: 'enroll', value: courseId })
      .then(() => qc.invalidateQueries({ queryKey: ['worker-training', wid] }))
      .catch((e) => toast({ title: 'Could not enrol', description: (e as Error).message, variant: 'destructive' }))
      .finally(() => setEnrollingCourse(null))
  }

  function markProgress(enrollmentId: string, current: number) {
    const next = Math.min(100, current + 25)
    setPendingEnrollment(enrollmentId)
    api.patch('/api/worker', { id: wid, action: 'trainingProgress', value: { enrollmentId, progress: next } })
      .then(() => qc.invalidateQueries({ queryKey: ['worker-training', wid] }))
      .catch((e) => toast({ title: 'Could not save progress', description: (e as Error).message, variant: 'destructive' }))
      .finally(() => setPendingEnrollment(null))
  }

  if (q.isLoading) return <LoadingBlock />
  if (q.isError) return <LoadError onRetry={() => void q.refetch()} />

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label={t('trainingsDoneLabel', lang)} value={d?.trainingsDone ?? 0} tone="success" icon={<GraduationCap className="h-4 w-4" />} sub={t('trainingsSub', lang)} />
        <KpiCard label={t('enrolledNow', lang)} value={d?.enrollments.filter((e) => e.status !== 'COMPLETED').length ?? 0} icon={<Clock3 className="h-4 w-4" />} sub={t('enrolledSub', lang)} />
      </div>

      {(d?.recommended ?? []).length > 0 && (
        <SectionCard title={t('recommendedTitle', lang)} description={t('recommendedDesc', lang)}>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {d!.recommended.map((c) => (
              <div key={c.id} className="rounded-xl border-2 border-primary/40 bg-accent/60 p-3.5">
                <div className="flex items-center gap-1.5">
                  <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary">Recommended</span>
                </div>
                <p className="mt-1.5 text-sm font-semibold leading-snug">{c.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">{c.provider} · {c.durationHrs} hrs · {c.certification}</p>
                <div className="mt-2 flex items-center gap-1.5">
                  <ModeBadge mode={c.mode} />
                  <Badge variant="secondary" className="text-[10px]"><Users className="mr-1 h-2.5 w-2.5" /> {c.seats} seats</Badge>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      <SectionCard title={t('allCoursesTitle', lang)} description={t('allCoursesDesc', lang)}>
        <div className="space-y-2.5">
          {(d?.courses ?? []).map((c) => {
            const enr = enrollmentByCourse.get(c.id)
            const rec = recommendedIds.has(c.id)
            return (
              <div key={c.id} className={cn('rounded-xl border p-3.5', rec && 'border-primary/40 bg-accent/40')}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-semibold leading-snug">{c.title}</p>
                      {rec && <Badge className="h-4 bg-primary/15 px-1.5 text-[9px] font-bold text-primary">RECOMMENDED</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{c.provider} · {c.certification}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <ModeBadge mode={c.mode} />
                      <Badge variant="secondary" className="text-[10px]">{c.durationHrs} hrs</Badge>
                      <Badge variant="secondary" className="text-[10px]"><Users className="mr-1 h-2.5 w-2.5" /> {c.seats} seats</Badge>
                    </div>
                    {enr && (
                      <div className="mt-3 flex items-center gap-3">
                        <Progress value={enr.progress} className="h-2 max-w-52 flex-1" />
                        <span className="text-xs font-semibold tabular-nums">{enr.progress}%</span>
                        {enr.status === 'COMPLETED' && (
                          <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                            Completed
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="shrink-0">
                    {!enr ? (
                      <Button size="sm" variant="outline" className="min-h-10 min-w-28" disabled={enrollingCourse === c.id} onClick={() => enroll(c.id)}>
                        {enrollingCourse === c.id && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                        {enrollingCourse === c.id ? t('enrolling', lang) : t('enrollBtn', lang)}
                      </Button>
                    ) : enr.status !== 'COMPLETED' ? (
                      <Button size="sm" className="min-h-10 min-w-28" disabled={pendingEnrollment === enr.id} onClick={() => markProgress(enr.id, enr.progress)}>
                        {pendingEnrollment === enr.id && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                        {pendingEnrollment === enr.id ? t('saving', lang) : t('markProgress', lang)}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </SectionCard>
    </div>
  )
}

// ============================================================
// RATINGS
// ============================================================

interface RatingsData {
  ok: boolean
  reviews: BookingDTO[]
  rating: number
  completionRate: number
  completedJobs: number
}

function StarsRow({ value }: { value: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={cn('h-3.5 w-3.5', i <= Math.round(value) ? 'fill-amber-500 text-amber-500' : 'fill-zinc-200 text-zinc-200 dark:fill-zinc-700 dark:text-zinc-700')} />
      ))}
    </span>
  )
}

// ============================================================
// RATINGS — Phase 5 transparency card + worker report (#35)
// ============================================================

const TRUST_FACTOR_KEYS: Record<string, string> = {
  quality: 'trFactorQuality', timeliness: 'trFactorTimeliness',
  behaviour: 'trFactorBehaviour', communication: 'trFactorCommunication',
}

function TrustTransparencyCard({ wid }: { wid: string }) {
  const lang = useAppStore((s) => s.lang)
  const tt = tr(lang)
  const q = useQuery({
    queryKey: ['trust-worker', wid],
    queryFn: () => api.get<TrustWorkerDTO>(`/api/trust?workerId=${wid}`),
    enabled: !!wid,
    staleTime: 30000,
  })

  if (q.isLoading) return <Skeleton className="h-56 w-full" />
  if (q.isError || !q.data) return <SideQueryError onRetry={() => void q.refetch()} labelKey="trLoadFailed" />
  const d = q.data

  return (
    <SectionCard
      title={tt('trTransparencyTitle')}
      description={tt('trTransparencySub')}
      actions={<TrustReportButton workerId={wid} className="shrink-0" />}
    >
      {d.totalRatings === 0 ? (
        <p className="text-sm text-muted-foreground">{tt('trNoRatings')}</p>
      ) : (
        <div className="space-y-2.5">
          {d.factors.map((f) => {
            const label = tt(TRUST_FACTOR_KEYS[f.key] ?? f.key)
            return (
              <div key={f.key} className="flex items-center gap-3" role="img" aria-label={`${label} ${f.avg} ${tt('trOutOf')}`}>
                <span className="w-24 shrink-0 truncate text-xs font-medium sm:w-32">{label}</span>
                <Progress value={(f.avg / 5) * 100} className="h-2 flex-1" />
                <span className="w-20 shrink-0 text-right text-xs font-bold tabular-nums">
                  {f.avg.toFixed(1)} <span className="font-normal text-muted-foreground">{tt('trOutOf')}</span>
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-dashed pt-3 text-center">
        <div>
          <p className="text-lg font-bold tabular-nums">{d.totalRatings}</p>
          <p className="text-[10px] leading-tight text-muted-foreground">{tt('trRatingsLabel')}</p>
        </div>
        <div>
          <p className="text-lg font-bold tabular-nums">{d.complaintsOpen}</p>
          <p className="text-[10px] leading-tight text-muted-foreground">{tt('trComplaintsOpen')}</p>
        </div>
        <div>
          <p className="text-lg font-bold tabular-nums">{d.reportsAgainst}</p>
          <p className="text-[10px] leading-tight text-muted-foreground">{tt('trReportsFiled')}</p>
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{d.note}</p>
    </SectionCard>
  )
}

export function RatingsSection({ user }: { user: DemoUser }) {
  const wid = user.workerId ?? ''
  const lang = useAppStore((s) => s.lang)
  const q = useQuery({
    queryKey: ['worker-ratings', wid],
    queryFn: () => api.get<RatingsData>(`/api/worker?id=${wid}&section=ratings`),
    enabled: !!wid,
  })
  const d = q.data

  if (q.isLoading) return <LoadingBlock />
  if (q.isError) return <LoadError onRetry={() => void q.refetch()} />

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 text-center sm:col-span-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('custRating', lang)}</p>
          <p className="mt-1 text-4xl font-bold tabular-nums tracking-tight text-primary">{(d?.rating ?? 0).toFixed(2)}</p>
          <div className="mt-1.5 flex justify-center"><StarsRow value={d?.rating ?? 0} /></div>
          <p className="mt-1 text-[11px] text-muted-foreground">{t('acrossReviews', lang)} {d?.reviews.length ?? 0} {t('verifiedReviews', lang)}</p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('completionRate', lang)}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">{d?.completionRate ?? 0}%</p>
          <Progress value={d?.completionRate ?? 0} className="mt-2 h-1.5" />
          <p className="mt-1.5 text-[11px] text-muted-foreground">{t('completionSub', lang)}</p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('completedJobsLabel', lang)}</p>
          <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight">{(d?.completedJobs ?? 0).toLocaleString('en-IN')}</p>
          <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3 shrink-0 text-primary" /> {t('trTransparencySub', lang)}
          </p>
        </div>
      </div>

      <TrustTransparencyCard wid={wid} />

      <SectionCard title={t('customerReviewsTitle', lang)} description={t('customerReviewsDesc', lang)}>
        {(d?.reviews ?? []).length === 0 ? (
          <EmptyState
            icon={<MessageSquareText className="h-10 w-10 text-primary/40" />}
            title="No reviews yet"
            body="Complete jobs to receive your first verified customer review."
          />
        ) : (
          <div className={SCROLL_LIST}>
            {d!.reviews.map((r) => (
              <div key={r.id} className="rounded-lg border bg-card p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <StarsRow value={r.rating ?? 0} />
                  <span className="text-[10px] text-muted-foreground">{timeAgo(r.scheduledAt)}</span>
                </div>
                {r.review && <p className="mt-2 text-sm italic leading-relaxed text-muted-foreground">&ldquo;{r.review}&rdquo;</p>}
                <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <MapPinned className="h-3 w-3" /> {r.customerName ?? 'Customer'} · {r.area} · <span className="font-mono">{r.refCode}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <PrototypeNotice>Ratings feed the cooperative matching engine — higher-rated workers get priority dispatch and emergency-pool eligibility.</PrototypeNotice>
    </div>
  )
}
