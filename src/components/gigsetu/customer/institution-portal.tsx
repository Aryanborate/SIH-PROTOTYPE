'use client'

// Institutional Customer Portal (#32) — bulk/recurring requests, service history,
// monthly volume, invoices + CSV report, emergency escalation strip.
// Live against GET/POST /api/institution (Task 14-a server contract).

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, inr, fmtDateTime } from '@/lib/api-client'
import { t } from '@/lib/i18n'
import { useAppStore } from '@/store/app-store'
import type { Lang, InstitutionPortalDTO, ServiceCategoryDTO } from '@/lib/types'
import { SectionCard, KpiCard, EmptyState, PrototypeNotice } from '../shared/ui-kit'
import { useSkillLabel } from '../shared/skill-label'
import { csvRow, downloadCsv, slugify } from '../shared/csv'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import {
  Building2, School, Hospital, BedDouble, Briefcase, Landmark, Users, CalendarDays, Plus, Loader2,
  FileDown, Phone, Siren, FileText, Wallet,
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

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  SOCIETY: Building2, SCHOOL: School, HOSPITAL: Hospital, HOSTEL: BedDouble, BUSINESS: Briefcase, GOVT: Landmark,
}

/** Request-type chip — BULK zinc / RECURRING emerald / MAINTENANCE amber / EMERGENCY red. */
function TypeChip({ type, lang }: { type: string; lang: Lang }) {
  const map: Record<string, string> = {
    BULK: 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300',
    RECURRING: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
    MAINTENANCE: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
    EMERGENCY: 'border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400',
  }
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${map[type] ?? map.BULK}`}>
      {t(`ipType${type}`, lang) === `ipType${type}` ? type : t(`ipType${type}`, lang)}
    </span>
  )
}

/** Request status chip — localized via ipSt* keys, falls back to the raw status. */
function ReqStatusChip({ status, lang }: { status: string; lang: Lang }) {
  const map: Record<string, string> = {
    REQUESTED: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
    SCHEDULED: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
    APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
    IN_PROGRESS: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
    COMPLETED: 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300',
    REJECTED: 'border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400',
  }
  const raw = t(`ipSt${status}`, lang)
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${map[status] ?? map.REQUESTED}`}>
      {raw === `ipSt${status}` ? status.replace(/_/g, ' ') : raw}
    </span>
  )
}

const FREQ_KEYS: Record<string, string> = { 'ONE-TIME': 'ipFreqOneTime', DAILY: 'ipFreqDaily', WEEKLY: 'ipFreqWeekly', MONTHLY: 'ipFreqMonthly' }
const FREQ_VALUES = ['ONE-TIME', 'DAILY', 'WEEKLY', 'MONTHLY'] as const
const SLOTS = ['07:00', '09:00', '11:00', '14:00', '16:00', '18:00'] as const
const REQ_TYPES = ['BULK', 'RECURRING', 'MAINTENANCE', 'EMERGENCY'] as const

/** 6-bar SVG volume chart (amber), value-labelled, honest y-scale. */
function VolumeChart({ data }: { data: { label: string; jobs: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.jobs))
  const W = 100
  const barW = W / Math.max(1, data.length)
  return (
    <svg viewBox={`0 0 ${W} 64`} className="h-28 w-full" role="img" aria-label="Monthly service volume">
      {[0.5, 1].map((f) => (
        <line key={f} x1="0" x2={W} y1={56 - f * 48} y2={56 - f * 48} className="stroke-zinc-200 dark:stroke-zinc-800" strokeWidth="0.4" strokeDasharray="1.5 1.5" />
      ))}
      {data.map((d, i) => {
        const h = (d.jobs / max) * 48
        return (
          <g key={d.label + i}>
            <title>{`${d.label}: ${d.jobs}`}</title>
            <rect x={i * barW + barW * 0.2} y={56 - h} width={barW * 0.6} height={Math.max(h, 1)} rx="1.4" className="fill-amber-500/90 dark:fill-amber-400/80" />
            <text x={i * barW + barW / 2} y={54 - h - 1.5} textAnchor="middle" className="fill-zinc-500 dark:fill-zinc-400" fontSize="4.4" fontWeight="600">{d.jobs}</text>
            <text x={i * barW + barW / 2} y="62.5" textAnchor="middle" className="fill-zinc-500 dark:fill-zinc-400" fontSize="4.6">{d.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ---------- main ----------

export function InstitutionPortal({ customerId }: { customerId: string }) {
  const lang = useAppStore((s) => s.lang)
  const trr = tr(lang)
  const { toast } = useToast()
  const qc = useQueryClient()
  const skillLabel = useSkillLabel()

  const portalQ = useQuery({
    queryKey: ['institution-portal', customerId],
    queryFn: () => api.get<InstitutionPortalDTO & { ok: boolean }>(`/api/institution?customerId=${customerId}`),
    staleTime: 15_000,
    // FIX: with no interval and refetchOnWindowFocus disabled globally, the
    // institutional KPIs froze at whatever they were when the tab opened.
    refetchInterval: 20_000,
  })

  // New-request dialog state
  const [open, setOpen] = useState(false)
  const [rType, setRType] = useState('BULK')
  const [categoryKey, setCategoryKey] = useState('electrician')
  const [title, setTitle] = useState('')
  const [headcount, setHeadcount] = useState('2')
  const [freq, setFreq] = useState('ONE-TIME')
  const [slot, setSlot] = useState('09:00')
  const [date, setDate] = useState('')

  const catsQ = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<{ ok: boolean; categories: ServiceCategoryDTO[] }>('/api/categories'),
    enabled: open,
    staleTime: 300_000,
  })

  const createM = useMutation({
    mutationFn: () =>
      api.post<{ ok: boolean; request: { id: string } }>('/api/institution', {
        customerId,
        type: rType,
        categoryKey,
        title: title.trim(),
        detail: '',
        headcount: Math.max(1, Math.min(50, Number(headcount) || 1)),
        schedule: { freq, slot },
        scheduledAt: date ? new Date(`${date}T${slot}:00`).toISOString() : undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['institution-portal', customerId] })
      setOpen(false)
      setTitle('')
      setDate('')
      setHeadcount('2')
      toast({ title: t('ipToast', lang), description: t('ipToastSub', lang) })
    },
    onError: (e) => toast({ title: t('bdActionFailed', lang), description: (e as Error).message, variant: 'destructive' }),
  })

  const d = portalQ.data

  /** CSV service report built client-side from recentServices (no server round-trip). */
  function exportCsv() {
    if (!d) return
    const rows = [
      csvRow(['Ref', 'Service', 'Category', 'Status', 'Scheduled', 'Worker', 'Amount (INR)']),
      ...d.recentServices.map((s) => csvRow([s.refCode, s.title, s.categoryKey, s.status, new Date(s.scheduledAt).toISOString().slice(0, 10), s.workerName ?? '', s.price ?? ''])),
    ]
    downloadCsv(`gigsetu-${slugify(d.customer.name)}-service-report.csv`, rows.join('\n'))
  }

  if (portalQ.isLoading) {
    return (
      <div className="space-y-4" aria-busy>
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    )
  }

  if (portalQ.isError || !d) {
    return <EmptyState title={t('bdActionFailed', lang)} body="Could not load the institution portal." action={<Button variant="outline" size="sm" onClick={() => portalQ.refetch()}>Retry</Button>} />
  }

  const TypeIcon = TYPE_ICONS[d.customer.type] ?? Building2

  return (
    <div className="space-y-5" role="region" aria-label={t('ipPortal', lang)}>
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-amber-500 p-5 text-primary-foreground shadow-sm">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.15]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '14px 14px' }} />
        <div className="relative flex flex-wrap items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15"><TypeIcon className="h-6 w-6" /></span>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-bold leading-tight">{d.customer.name}</h2>
            <p className="text-xs opacity-90">{t('ipPortalSub', lang)}</p>
            <p className="mt-0.5 text-[11px] opacity-75">{d.customer.type} · {d.customer.area}, {d.customer.city} · {d.customer.address}</p>
          </div>
          <Badge className="ml-auto border-primary-foreground/30 bg-primary-foreground/15 text-primary-foreground">{d.customer.type}</Badge>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard label={t('ipKpiContracts', lang)} value={d.kpis.contracts} tone="primary" />
        <KpiCard label={t('ipKpiRequests', lang)} value={d.kpis.monthlyRequests} />
        <KpiCard label={t('ipKpiCompleted', lang)} value={d.kpis.completedJobs} tone="success" />
        <KpiCard label={t('ipKpiPending', lang)} value={d.kpis.pendingJobs} tone={d.kpis.pendingJobs > 0 ? 'warning' : 'default'} />
        <KpiCard label={t('ipKpiOpen', lang)} value={d.kpis.openRequests} />
        <KpiCard label={t('ipKpiSpend', lang)} value={inr(d.kpis.monthlySpendRs)} icon={<Wallet className="h-4 w-4" />} />
      </div>

      {/* Bulk / recurring requests */}
      <SectionCard
        title={t('ipRequestsTitle', lang)}
        description={t('ipRequestsSub', lang)}
        actions={
          <Button size="sm" className="h-9 gap-1.5" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> {t('ipNewRequest', lang)}
          </Button>
        }
      >
        {d.requests.length === 0 ? (
          <EmptyState icon={<Users className="h-8 w-8" />} title={t('ipEmptyRequests', lang)} body={t('ipEmptyRequestsBody', lang)} />
        ) : (
          <div className="max-h-96 space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-700" role="list">
            {d.requests.map((r) => (
              <div key={r.id} role="listitem" className="rounded-lg border p-3 transition hover:border-primary/40">
                <div className="flex flex-wrap items-center gap-2">
                  <TypeChip type={r.type} lang={lang} />
                  <p className="min-w-0 flex-1 truncate text-sm font-semibold">{r.title}</p>
                  <ReqStatusChip status={r.status} lang={lang} />
                  <span className="shrink-0 text-sm font-bold tabular-nums">{r.estimatedRs != null ? `${t('ipEst', lang)} ${inr(r.estimatedRs)}` : '—'}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {r.headcount} {t('ipWorkersUnit', lang)}</span>
                  <span>{skillLabel(r.categoryKey)}</span>
                  <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {fmtDateTime(r.scheduledAt)}</span>
                  {r.schedule?.freq && (
                    <span>
                      {t(FREQ_KEYS[r.schedule.freq] ?? '', lang) === (FREQ_KEYS[r.schedule.freq] ?? '') ? r.schedule.freq : t(FREQ_KEYS[r.schedule.freq] ?? '', lang)}
                      {r.schedule.day ? ` · ${r.schedule.day}` : ''}{r.schedule.slot ? ` · ${r.schedule.slot}` : ''}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* New-request dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('ipNewTitle', lang)}</DialogTitle>
            <DialogDescription>{t('ipNewDesc', lang)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium">{t('ipType', lang)}</label>
                <Select value={rType} onValueChange={setRType}>
                  <SelectTrigger className="h-11" aria-label={t('ipType', lang)}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REQ_TYPES.map((v) => <SelectItem key={v} value={v}>{t(`ipType${v}`, lang)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">{t('ipCategory', lang)}</label>
                <Select value={categoryKey} onValueChange={setCategoryKey}>
                  <SelectTrigger className="h-11" aria-label={t('ipCategory', lang)}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(catsQ.data?.categories ?? []).map((c) => (
                      <SelectItem key={c.key} value={c.key}>{lang === 'mr' ? c.nameMr : lang === 'hi' ? c.nameHi : c.nameEn}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium">{t('ipTitle', lang)}</label>
              <Input className="h-11" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('ipTitlePh', lang)} maxLength={120} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium">{t('ipHeadcount', lang)}</label>
                <Input className="h-11" type="number" min={1} max={50} inputMode="numeric" value={headcount} onChange={(e) => setHeadcount(e.target.value)} aria-label={t('ipHeadcount', lang)} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">{t('ipDate', lang)}</label>
                <Input className="h-11" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={t('ipDate', lang)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium">{t('ipFreq', lang)}</label>
                <Select value={freq} onValueChange={setFreq}>
                  <SelectTrigger className="h-11" aria-label={t('ipFreq', lang)}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQ_VALUES.map((v) => <SelectItem key={v} value={v}>{t(FREQ_KEYS[v], lang)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">{t('ipSlot', lang)}</label>
                <Select value={slot} onValueChange={setSlot}>
                  <SelectTrigger className="h-11" aria-label={t('ipSlot', lang)}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SLOTS.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="h-11 w-full" disabled={createM.isPending || !title.trim()} onClick={() => createM.mutate()}>
              {createM.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              {t('ipSubmit', lang)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        {/* Service history */}
        <SectionCard title={t('ipHistoryTitle', lang)} description={t('ipHistorySub', lang)}>
          {d.recentServices.length === 0 ? (
            <EmptyState title={t('ipEmptyRequests', lang)} />
          ) : (
            <div className="max-h-96 overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-700">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    <th className="pb-2 pr-2 font-semibold">Ref</th>
                    <th className="pb-2 pr-2 font-semibold">{t('ipTitle', lang)}</th>
                    <th className="pb-2 pr-2 font-semibold">{t('worker', lang)}</th>
                    <th className="pb-2 text-right font-semibold">₹</th>
                  </tr>
                </thead>
                <tbody>
                  {d.recentServices.map((s) => (
                    <tr key={s.refCode} className="border-t">
                      <td className="py-2 pr-2 font-mono text-[11px]">{s.refCode}</td>
                      <td className="py-2 pr-2">
                        <p className="max-w-[180px] truncate font-medium">{s.title}</p>
                        <div className="mt-0.5"><ReqStatusChip status={s.status} lang={lang} /></div>
                      </td>
                      <td className="py-2 pr-2 text-xs text-muted-foreground">{s.workerName ?? '—'}</td>
                      <td className="py-2 text-right font-semibold tabular-nums">{s.price != null ? inr(s.price) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>

        {/* Monthly volume */}
        <SectionCard title={t('ipVolume', lang)} description={t('ipVolumeSub', lang)}>
          <VolumeChart data={d.monthlyVolume} />
        </SectionCard>
      </div>

      {/* Invoices + CSV report */}
      <SectionCard
        title={t('ipInvoices', lang)}
        description={t('ipInvoicesSub', lang)}
        actions={
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={exportCsv}>
            <FileDown className="h-4 w-4" /> {t('ipReportsBtn', lang)}
          </Button>
        }
      >
        {d.invoices.length === 0 ? (
          <EmptyState icon={<FileText className="h-8 w-8" />} title={t('ipEmptyRequests', lang)} body={t('amcEmptyBody', lang)} />
        ) : (
          <div className="max-h-96 space-y-2 overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-700">
            {d.invoices.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 transition hover:border-primary/40">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{inv.ref}</p>
                  <p className="text-[11px] text-muted-foreground">{t('ipPeriodCol', lang)}: {inv.period} · {inv.jobs} {t('jobs', lang)} · {fmtDateTime(inv.issuedAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-sm font-bold tabular-nums">{inr(inv.amountRs)}</span>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${inv.status === 'PAID' ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300' : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300'}`}>
                    {inv.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Emergency support strip */}
      <div className="rounded-xl border-2 border-red-300 bg-red-50/70 p-4 dark:border-red-900 dark:bg-red-950/30" role="note">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-500/10"><Siren className="h-5 w-5 text-red-600 dark:text-red-400" /></span>
          <div className="min-w-0">
            <p className="text-sm font-bold">{t('ipEmergency', lang)}</p>
            <p className="text-xs text-muted-foreground">{t('ipEmergencySub', lang)}</p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-lg border border-red-200 bg-card px-2.5 py-1.5 font-semibold dark:border-red-900">{d.emergencyContact.coopName}</span>
            <span className="rounded-lg border border-red-200 bg-card px-2.5 py-1.5 font-semibold dark:border-red-900">{trr('ipSlaHours', { n: d.emergencyContact.slaHours })}</span>
            <a href={`tel:${d.emergencyContact.phone.replace(/\s/g, '')}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3 font-bold text-white transition hover:bg-red-700">
              <Phone className="h-3.5 w-3.5" /> {d.emergencyContact.phone}
            </a>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-red-700/80 dark:text-red-300/80">{t('ipEmergencyNote', lang)}</p>
      </div>

      <PrototypeNotice>{d.prototypeNote}</PrototypeNotice>
    </div>
  )
}
