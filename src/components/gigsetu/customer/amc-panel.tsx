'use client'

// AMC / Contract Management (#33) — per-contract dashboard for institutional customers.
// Live against GET /api/amc?customerId= (Task 14-a server contract).

import { useQuery } from '@tanstack/react-query'
import { api, inr } from '@/lib/api-client'
import { t } from '@/lib/i18n'
import { useAppStore } from '@/store/app-store'
import type { Lang, AmcContractDTO } from '@/lib/types'
import { SectionCard, EmptyState, PrototypeNotice } from '../shared/ui-kit'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import {
  Building2, School, Hospital, BedDouble, Briefcase, Landmark, Zap, Droplets, Sparkles, Flower2,
  ShieldCheck, Siren, Hammer, CalendarRange, Users,
} from 'lucide-react'

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

const PROPERTY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  SOCIETY: Building2, SCHOOL: School, HOSPITAL: Hospital, HOSTEL: BedDouble, BUSINESS: Briefcase, GOVT: Landmark,
}

/** Service label → icon (keyword match over the seeded service names). */
function serviceIcon(s: string): React.ComponentType<{ className?: string }> {
  const v = s.toLowerCase()
  if (v.includes('plumb') || v.includes('water')) return Droplets
  if (v.includes('electr')) return Zap
  if (v.includes('clean')) return Sparkles
  if (v.includes('garden') || v.includes('landscap')) return Flower2
  if (v.includes('preventive') || v.includes('maintenance') || v.includes('amc')) return ShieldCheck
  if (v.includes('emergency') || v.includes('sos')) return Siren
  return Hammer
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

/** Date-only display (contract validity lines). */
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function roleChip(role: string | undefined, lang: Lang): { cls: string; label: string } {
  const r = (role ?? 'Crew').toUpperCase()
  if (r === 'LEAD') return { cls: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300', label: t('amcRoleLead', lang) }
  if (r === 'SUPPORT') return { cls: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300', label: t('amcRoleSupport', lang) }
  return { cls: 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400', label: t('amcRoleCrew', lang) }
}

/** Small stat cell for the dashboard row. */
function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`truncate text-sm font-bold tabular-nums ${tone ?? ''}`}>{value}</p>
    </div>
  )
}

// ---------- per-contract card ----------

function ContractCard({ c, lang }: { c: AmcContractDTO; lang: Lang }) {
  const trr = tr(lang)
  const PropertyIcon = PROPERTY_ICONS[c.propertyType] ?? Building2
  const active = c.status.toUpperCase() === 'ACTIVE'
  const daysLeft = Math.max(0, Math.ceil((new Date(c.endDate).getTime() - Date.now()) / 86400000))
  const renewalSoon = daysLeft < 60

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary"><PropertyIcon className="h-4.5 w-4.5" /></span>
          <span className="min-w-0">
            <span className="block truncate leading-tight">{c.title}</span>
            <span className="block text-xs font-normal text-muted-foreground">{trr('amcUnits', { n: c.units })} · {c.propertyType}</span>
          </span>
        </span>
      }
      actions={
        <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${active ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300' : 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400'}`}>
          {c.status}
        </span>
      }
    >
      <div className="space-y-4">
        {/* Services included */}
        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t('amcServices', lang)}</p>
          <div className="flex flex-wrap gap-1.5">
            {c.services.map((s) => {
              const Icon = serviceIcon(s)
              return (
                <span key={s} className="inline-flex items-center gap-1 rounded-full border bg-muted/40 px-2.5 py-1 text-[11px] font-medium">
                  <Icon className="h-3.5 w-3.5 text-primary" /> {s}
                </span>
              )
            })}
          </div>
        </div>

        {/* Dashboard row */}
        <div className="grid grid-cols-2 gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label={t('ipKpiRequests', lang)} value={String(c.monthlyRequests)} />
          <Stat label={t('ipKpiCompleted', lang)} value={String(c.completedJobs)} tone="text-emerald-600 dark:text-emerald-400" />
          <Stat label={t('ipKpiPending', lang)} value={String(c.pendingJobs)} tone={c.pendingJobs > 0 ? 'text-amber-600 dark:text-amber-400' : ''} />
          <Stat label={t('ipSla', lang)} value={`${c.slaHours}h`} />
          <Stat label={t('amcCost', lang)} value={`${inr(c.monthlyFeeRs)}${t('amcPerMonth', lang)}`} tone="text-primary" />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">SLA met</p>
            <div className="mt-1 flex items-center gap-1.5">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" role="progressbar" aria-valuenow={Math.round(c.slaMetPct)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, c.slaMetPct)}%` }} />
              </div>
              <span className="shrink-0 text-[10px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{trr('amcSlaMet', { pct: Math.round(c.slaMetPct) })}</span>
            </div>
          </div>
        </div>

        {/* Worker allocation */}
        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t('amcWorkers', lang)}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {c.workers.map((w, i) => {
              const chip = roleChip(w.role, lang)
              return (
                <div key={`${w.name}-${i}`} className="flex items-center gap-2.5 rounded-lg border p-2.5">
                  <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-primary">{initials(w.name)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold leading-tight">{w.name}</p>
                    {w.skill && <p className="truncate text-[11px] text-muted-foreground">{w.skill}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${chip.cls}`}>{chip.label}</span>
                </div>
              )
            })}
          </div>
          {c.cooperative && (
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
              <Users className="h-3 w-3" /> {t('cooperative', lang)}: {c.cooperative.name}
              {c.cooperative.repName ? ` · ${t('amcRep', lang)} ${c.cooperative.repName}` : ''}
              {c.cooperative.emergencyPoolSize ? ` · ${t('amcPool', lang)} ${c.cooperative.emergencyPoolSize}` : ''}
            </p>
          )}
        </div>

        {/* Validity */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-xs">
          <CalendarRange className="h-4 w-4 shrink-0 text-primary" />
          <span className="font-semibold">{t('amcValidity', lang)}:</span>
          <span className="tabular-nums">{fmtDate(c.startDate)} → {fmtDate(c.endDate)}</span>
          <span className={`ml-auto inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${renewalSoon ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300' : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'}`}>
            {trr('amcRenewal', { n: daysLeft })}
          </span>
        </div>
      </div>
    </SectionCard>
  )
}

// ---------- main ----------

export function AmcPanel({ customerId }: { customerId: string }) {
  const lang = useAppStore((s) => s.lang)
  const amcQ = useQuery({
    queryKey: ['amc', customerId],
    queryFn: () => api.get<{ ok: boolean; contracts: AmcContractDTO[] }>(`/api/amc?customerId=${customerId}`),
    staleTime: 30_000,
  })

  if (amcQ.isLoading) {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    )
  }

  if (amcQ.isError) {
    return <EmptyState title={t('bdActionFailed', lang)} body="Could not load contracts." action={<Button variant="outline" size="sm" onClick={() => amcQ.refetch()}>Retry</Button>} />
  }

  const contracts = amcQ.data?.contracts ?? []
  return (
    <div className="space-y-5" role="region" aria-label={t('amcTitle', lang)}>
      <div>
        <h2 className="text-lg font-bold">{t('amcTitle', lang)}</h2>
        <p className="text-xs text-muted-foreground">{t('amcSub', lang)}</p>
      </div>
      {contracts.length === 0 ? (
        <EmptyState title={t('amcEmpty', lang)} body={t('amcEmptyBody', lang)} />
      ) : (
        contracts.map((c) => <ContractCard key={c.id} c={c} lang={lang} />)
      )}
      <PrototypeNotice>
        Cooperative maintenance contract — prototype data, designed for authorized integration.
      </PrototypeNotice>
    </div>
  )
}
