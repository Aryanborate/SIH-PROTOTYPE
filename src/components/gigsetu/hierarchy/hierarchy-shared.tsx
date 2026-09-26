'use client'

// Shared types + chart kit for the State Federation & National/Apex dashboards (Task 2-d)
// Palette rule: amber/emerald/zinc + red/orange for demand intensity. NO indigo/blue.

import { Skeleton } from '@/components/ui/skeleton'
import type { ReactNode } from 'react'

// ---------- API response types ----------

export interface SkillGapRow {
  skill: string
  gap: number
  action: string
}

export interface StateFederationDTO {
  id: string
  type?: string
  name: string
  region: string
  chairperson: string
  regNo: string
  districts: number
  cooperatives: number
  workers: number
  activeWorkersPct: number
  jobsToday: number
  revenueMonthLakh: number
  welfareCoveragePct: number
  demandJson: Record<string, string>
  skillGapJson: SkillGapRow[]
}

export interface DistrictSummaryDTO {
  id: string
  name: string
  cooperatives: number
  workers: number
  activeWorkers: number
  jobsToday: number
  utilizationPct: number
  demand: Record<string, string>
  mapPos: { x: number; y: number }
  recommendations: string[]
}

export interface StateDashResp {
  ok: boolean
  federation: StateFederationDTO
  districts: DistrictSummaryDTO[]
  categoryDemand: Record<string, number>
}

export interface NationalStateDTO {
  state: string
  federations: number
  districts: number
  cooperatives: number
  workers: number
  intensity: number
}

export interface NationalDashResp {
  ok: boolean
  national: StateFederationDTO & {
    national: {
      states: NationalStateDTO[]
      contracts: { institutionalAMC: number; govtInstitutions: number; monthlyValueCr: number }
      note?: string
    }
  }
  stateFed: { id: string; name: string; region: string; workers: number } | null
}

// ---------- formatting helpers ----------

export const num = (n: number | null | undefined): string => (typeof n === 'number' ? n.toLocaleString('en-IN') : '—')

export function skillLabel(key: string): string {
  const map: Record<string, string> = {
    plumber: 'Plumbing', electrician: 'Electrician', cleaning: 'Cleaning', carpenter: 'Carpentry',
    appliance: 'Appliance repair', caregiver: 'Caregiving', painter: 'Painting', driver: 'Driving',
    gardener: 'Gardening', technician: 'Technician',
  }
  if (map[key]) return map[key]
  return key.charAt(0).toUpperCase() + key.slice(1)
}

export function levelWeight(level: string): number {
  return level === 'HIGH' ? 3 : level === 'MEDIUM' ? 2 : 1
}

/** Shorten district names for chart axes */
export function abbreviate(name: string): string {
  if (name === 'Chh. Sambhajinagar') return 'Ch. Sambhaji'
  return name.length <= 10 ? name : name.slice(0, 9) + '…'
}

export const demandLevelOrder = ['HIGH', 'MEDIUM', 'LOW'] as const
export function sortDemand(entries: Array<[string, string]>): Array<[string, string]> {
  return [...entries].sort((a, b) => levelWeight(b[1]) - levelWeight(a[1]) || a[0].localeCompare(b[0]))
}

// ---------- load / utilization color scales (amber → red, emerald for low) ----------

export interface Tone { dot: string; text: string; bar: string }

export function loadTone(jobs: number, max: number): Tone {
  const r = jobs / Math.max(1, max)
  if (r >= 0.8) return { dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400', bar: 'bg-red-500' }
  if (r >= 0.6) return { dot: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400', bar: 'bg-orange-500' }
  if (r >= 0.4) return { dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500' }
  if (r >= 0.2) return { dot: 'bg-amber-400', text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-400' }
  return { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' }
}

export function utilTone(pct: number): Tone {
  if (pct >= 80) return { dot: '', text: 'text-red-600 dark:text-red-400', bar: 'bg-red-500' }
  if (pct >= 70) return { dot: '', text: 'text-amber-600 dark:text-amber-400', bar: 'bg-amber-500' }
  return { dot: '', text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500' }
}

export function utilCellColor(pct: number): string {
  if (pct >= 80) return '#ef4444'
  if (pct >= 70) return '#f59e0b'
  return '#10b981'
}

export function scoreCellColor(score: number): string {
  if (score >= 16) return '#ef4444'
  if (score >= 14) return '#f59e0b'
  if (score >= 12) return '#fbbf24'
  return '#10b981'
}

export const PIE_COLORS = ['#f59e0b', '#10b981', '#f97316', '#ef4444', '#84cc16', '#eab308', '#14b8a6', '#a8a29e']

// ---------- recharts kit ----------

export const axisTick = { fill: 'var(--color-muted-foreground)', fontSize: 10 }

export function ChartTooltip({
  active, payload, label, suffix,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ name?: string | number; value?: number | string; color?: string }>
  label?: string | number
  suffix?: string
}) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      {label !== undefined && label !== '' && <p className="mb-1 font-semibold">{label}</p>}
      <div className="space-y-0.5">
        {payload.map((p, i) => (
          <p key={i} className="flex items-center gap-1.5 tabular-nums">
            <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: p.color ?? 'var(--color-primary)' }} />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="ml-auto pl-3 font-semibold">
              {typeof p.value === 'number' ? p.value.toLocaleString('en-IN') : p.value}{suffix ?? ''}
            </span>
          </p>
        ))}
      </div>
    </div>
  )
}

// ---------- loading / error states ----------

export function DashboardSkeleton({ kpis, kpiCols }: { kpis: number; kpiCols: string }) {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className={kpiCols}>
        {Array.from({ length: kpis }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
      <span className="sr-only">Loading dashboard data…</span>
    </div>
  )
}

export function LoadError({ message }: { message?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-red-300 bg-red-50/60 px-4 py-6 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
      <p className="font-semibold">Could not load federation data</p>
      <p className="mt-1 text-xs opacity-90">{message ?? 'The hierarchy API did not respond. Try the role switcher or refresh.'}</p>
    </div>
  )
}

// ---------- small building blocks ----------

export function UtilBar({ pct, className }: { pct: number; className?: string }) {
  const tone = utilTone(pct)
  return (
    <div className={className}>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">Utilization</span>
        <span className={`font-bold tabular-nums ${tone.text}`}>{pct.toFixed(1)}%</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
    </div>
  )
}

export function HeaderBlock({
  name, subtitle, chips, extra,
}: {
  name: string
  subtitle: ReactNode
  chips: ReactNode
  extra?: ReactNode
}) {
  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{name}</h1>
          <div className="mt-1 text-xs text-muted-foreground sm:text-sm">{subtitle}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">{chips}</div>
      </div>
      {extra}
    </div>
  )
}
