'use client'

// Task 2-c shared helpers for the Taluka + District dashboards.
// NOTE: named `taluka-district-kit` (not `hierarchy-shared`) because Task 2-d
// owns the identically-named module for state/national views.
// Types mirror GET /api/hierarchy/dashboard?level=taluka|district responses.

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { DemandBadge, EmptyState } from '../shared/ui-kit'
import type { DemoUser } from '@/lib/types'
import type { ReactNode } from 'react'
import {
  Zap, Droplets, Hammer, Paintbrush, Car, Leaf, Wrench, Refrigerator, HeartHandshake,
  MoreHorizontal, AlertTriangle, RotateCw, Sparkles, Undo2,
} from 'lucide-react'

// ---------- API response types ----------

export type DemandLevel = 'LOW' | 'MEDIUM' | 'HIGH'
export type DemandMap = Record<string, DemandLevel>

export interface SkillGap {
  skill: string
  have: number
  need: number
}

export interface TalukaData {
  id: string
  name: string
  coordinator: string
  cooperatives: number
  workers: number
  availableWorkers: number
  emergencyCapacity: number
  jobsToday: number
  utilizationPct: number
  demandJson: DemandMap
  zonesJson: Array<{ zone: string; demand: DemandMap; note?: string }>
  skillGapJson: SkillGap[]
  recommendation: string
}

export interface TalukaCoop {
  id: string
  name: string
  sector: string
  workerCount: number
  activeToday: number
  jobsToday: number
  utilizationPct: number
  emergencyPoolSize: number
}

export interface TalukaResp {
  ok: boolean
  taluka: TalukaData
  cooperatives: TalukaCoop[]
}

export interface DistrictTaluka {
  id: string
  name: string
  coordinator: string
  workers: number
  availableWorkers: number
  emergencyCapacity: number
  jobsToday: number
  utilizationPct: number
  demand: DemandMap
  skillGap: SkillGap[]
  recommendation: string
  cooperatives: Array<{ id: string; name: string; sector: string; workerCount: number; jobsToday: number; utilizationPct: number }>
}

export interface DistrictData {
  id: string
  name: string
  coordinator: string
  zoneCount: number
  cooperatives: number
  workers: number
  activeWorkers: number
  jobsToday: number
  utilizationPct: number
  demandJson: DemandMap
  recommendationsJson: string[]
  mapPos: { x: number; y: number }
}

export interface ComparisonRow {
  coop: string
  skill: string
  available: number
  expectedJobs: number
}

export interface Opportunity extends ComparisonRow {
  gap: number
  kind: 'SURPLUS' | 'SHORTAGE' | 'BALANCED'
}

export interface DistrictResp {
  ok: boolean
  district: DistrictData
  talukas: DistrictTaluka[]
  comparison: ComparisonRow[]
  opportunities: Opportunity[]
  recommendations: string[]
}

// ---------- data hook ----------

export function useHierarchyDashboard<T>(level: 'taluka' | 'district', user: DemoUser, overrideId?: string) {
  const ownId = level === 'taluka' ? user.talukaId : user.districtId
  const id = overrideId || ownId
  return useQuery({
    queryKey: ['hierarchy-dashboard', level, id ?? 'featured'],
    queryFn: () => api.get<T>(`/api/hierarchy/dashboard?level=${level}${id ? `&id=${encodeURIComponent(id)}` : ''}`),
    refetchInterval: 20000,
  })
}

/**
 * Breadcrumb bar for drill-down dashboards: shows which entity is focused and
 * offers a one-tap way back to the coordinator's own default view.
 */
export function DrillBanner({
  label, sublabel, onClear, clearLabel = 'Back to my view',
}: {
  label: string
  sublabel?: string
  onClear: () => void
  clearLabel?: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-accent/70 px-3 py-2 text-sm" role="status">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
        Drill-down
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold leading-tight">{label}</span>
        {sublabel && <span className="block text-[11px] text-muted-foreground">{sublabel}</span>}
      </span>
      <Button size="sm" variant="outline" className="ml-auto h-7 text-xs" onClick={onClear}>
        <Undo2 className="mr-1 h-3.5 w-3.5" /> {clearLabel}
      </Button>
    </div>
  )
}

// ---------- skill helpers ----------

const SKILL_ICONS: Record<string, ReactNode> = {
  electrician: <Zap className="h-3.5 w-3.5" />,
  plumber: <Droplets className="h-3.5 w-3.5" />,
  carpenter: <Hammer className="h-3.5 w-3.5" />,
  painter: <Paintbrush className="h-3.5 w-3.5" />,
  cleaning: <Sparkles className="h-3.5 w-3.5" />,
  appliance: <Refrigerator className="h-3.5 w-3.5" />,
  caregiver: <HeartHandshake className="h-3.5 w-3.5" />,
  driver: <Car className="h-3.5 w-3.5" />,
  gardener: <Leaf className="h-3.5 w-3.5" />,
  technician: <Wrench className="h-3.5 w-3.5" />,
}

export function skillIcon(key: string): ReactNode {
  return SKILL_ICONS[key] ?? <MoreHorizontal className="h-3.5 w-3.5" />
}

export function skillLabel(key: string): string {
  return key ? key.charAt(0).toUpperCase() + key.slice(1) : key
}

export const fmt = (n: number): string => n.toLocaleString('en-IN')

const DEMAND_WEIGHT: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 }

export function demandEntries(demand: DemandMap): Array<[string, DemandLevel]> {
  return Object.entries(demand).sort((a, b) => (DEMAND_WEIGHT[b[1]] ?? 0) - (DEMAND_WEIGHT[a[1]] ?? 0))
}

export function hasLevel(demand: DemandMap, level: DemandLevel): boolean {
  return Object.values(demand).includes(level)
}

// ---------- small shared UI ----------

export function DemandLegend({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground', className)}>
      <span className="mr-0.5">Demand</span>
      <DemandBadge level="LOW" />
      <DemandBadge level="MEDIUM" />
      <DemandBadge level="HIGH" />
    </div>
  )
}

/** Mini utilization bar — emerald < 75%, amber 75–89%, red ≥ 90% */
export function UtilBar({ pct, showValue = true, className }: { pct: number; showValue?: boolean; className?: string }) {
  const v = Math.max(0, Math.min(100, pct))
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
        role="progressbar"
        aria-valuenow={Math.round(v)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Utilization ${v.toFixed(1)} percent`}
      >
        <div
          className={cn('h-full rounded-full', v >= 90 ? 'bg-red-500' : v >= 75 ? 'bg-amber-500' : 'bg-emerald-500')}
          style={{ width: `${v}%` }}
        />
      </div>
      {showValue && <span className="w-11 shrink-0 text-right text-xs font-semibold tabular-nums text-muted-foreground">{pct.toFixed(1)}%</span>}
    </div>
  )
}

/** Capacity-transfer status: SHORTAGE if available < expected−4, SURPLUS if available > expected+4, else BALANCED */
export function tradeKind(available: number, expectedJobs: number): 'SHORTAGE' | 'SURPLUS' | 'BALANCED' {
  if (available < expectedJobs - 4) return 'SHORTAGE'
  if (available > expectedJobs + 4) return 'SURPLUS'
  return 'BALANCED'
}

export function TradeChip({ kind, gap }: { kind: string; gap?: number }) {
  const map: Record<string, string> = {
    SHORTAGE: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
    SURPLUS: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
    BALANCED: 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300',
  }
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide', map[kind] ?? map.BALANCED)}>
      {kind}
      {gap !== undefined && gap !== 0 && (
        <span className="tabular-nums">
          {gap > 0 ? '+' : '−'}
          {Math.abs(gap)}
        </span>
      )}
    </span>
  )
}

export function signedGap(gap: number): string {
  return gap > 0 ? `+${gap}` : `−${Math.abs(gap)}`
}

// ---------- loading / error states ----------

const SCROLLBAR = '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-700'

/** Long-list scroll container: max-h-96 overflow-y-auto + slim scrollbar */
export function ScrollList({ children, className, ariaLabel }: { children: ReactNode; className?: string; ariaLabel?: string }) {
  return (
    <div aria-label={ariaLabel} className={cn('max-h-96 overflow-y-auto pr-1', SCROLLBAR, className)}>
      {children}
    </div>
  )
}

export function DashSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading dashboard">
      <Skeleton className="h-28 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
      <Skeleton className="h-56 rounded-xl" />
    </div>
  )
}

export function DashError({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <EmptyState
      icon={<AlertTriangle className="h-8 w-8" />}
      title="Could not load dashboard"
      body={message ?? 'The hierarchy data service did not respond. Retry, or switch roles from the header.'}
      action={
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw className="mr-1.5 h-3.5 w-3.5" /> Retry
        </Button>
      }
    />
  )
}
