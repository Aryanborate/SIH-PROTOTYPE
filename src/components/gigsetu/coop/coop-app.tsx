'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, inr, timeAgo } from '@/lib/api-client'
import type { BookingDTO, DemoUser, ExchangeDTO, MatchWeightsDTO, NotificationDTO, ServiceCategoryDTO } from '@/lib/types'
import {
  KpiCard, SectionCard, StatusChip, AvailDot, VerifiedBadge, AttentionRow, EmptyState, PrototypeNotice, RatingStars,
} from '../shared/ui-kit'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import {
  Activity, ArrowLeftRight, BadgeCheck, BarChart3, Bot, Building2, CalendarClock, Calculator, ChevronRight, ClipboardList,
  Download, FileWarning, Gauge, Gavel, GraduationCap, HandCoins, HeartHandshake, IndianRupee, Languages, Loader2, LayoutDashboard,
  MapPin, MoonStar, Percent, Phone, PiggyBank, RefreshCw, Scale, ScrollText, Search, ShieldCheck, ShoppingCart, Siren, SlidersHorizontal, Sparkles,
  Star, Timer, Trophy, Users, Wallet, Wrench, Zap,
} from 'lucide-react'
import { CoopReputationCard } from './coop-reputation'
import { CoopVerificationCard } from './coop-verification'
import { CoopProcurement } from './coop-procurement'
import { CoopEconomics } from './coop-economics'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store/app-store'
import { t } from '@/lib/i18n'
import { estimatePrice } from '@/lib/pricing'
import { useToast } from '@/hooks/use-toast'
import { DrillBanner } from '../hierarchy/taluka-district-kit'
import { csvRow, downloadCsv, slugify } from '../shared/csv'
import { useEdgeFades, EdgeFadeOverlays } from '../shared/scroll-fades'
import { useSkillLabel, useSkillScope } from '../shared/skill-label'

// ---------- Local API DTOs (mirror of GET /api/coop — kept local so shared types stay untouched) ----------

interface PricingPolicy {
  visitBaseByCategory: string
  urgencyMultiplier: Record<'NORMAL' | 'URGENT' | 'EMERGENCY', number>
  eveningSurchargePct: number
  negotiationFloorPct: number
  maxQuoteUpliftPct?: number
  welfareContributionPct: number
  coopCommissionPct: number
  platformFeePct: number
}

interface CoopProfile {
  id: string; name: string; regNo: string; societyType: string; sector: string
  repName: string; repRole: string; memberCount: number; workerCount: number
  status: string; verification: string; activeToday: number; jobsToday: number
  utilizationPct: number; welfareFundRs: number; emergencyPoolSize: number; earningsMonthRs: number
  pricingPolicy: PricingPolicy
}

interface CoopWorker {
  id: string; name: string; phone: string; primarySkill: string; secondarySkills: string[]
  experienceYears: number; certName: string; certStatus: string; certExpiry: string | null
  languages: string[]; serviceAreas: string[]; baseArea: string; completedJobs: number
  rating: number; completionRate: number; safetyValid: boolean
  availability: 'AVAILABLE' | 'BUSY' | 'OFFLINE'; emergencyPool: boolean; activeJobsToday: number
  earningsMonthRs: number; welfareBalanceRs: number; trainingsDone: number; skills: string[]; bioEn: string
}

// Phase 6 #58 — complaint register row (mirrors GET /api/complaints; superset of the /api/coop payload rows)
interface ComplaintRow {
  id: string; cooperativeId: string; workerId: string | null; bookingId: string | null
  customerName: string; subject: string; detail: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'SERIOUS'
  status: 'OPEN' | 'RESOLVING' | 'RESOLVED' | 'ESCALATED'
  resolutionNote: string | null; resolvedAt: string | null; createdAt: string
}

interface CoopData {
  ok: boolean
  cooperative: CoopProfile
  workers: CoopWorker[]
  bySkill: { skill: string; count: number; available: number; avgRating: number }[]
  certifications: { id: string; name: string; certName: string; certStatus: string; certExpiry: string | null }[]
  attention: {
    certExpiring: number; seriousComplaints: number; unavailable: number; needTraining: number
    items: { label: string; severity: string; action: string }[]
  }
  jobs: BookingDTO[]
  complaints: ComplaintRow[]
  exchange: ExchangeDTO[]
  earnings: { month: number; byDay: { date: string; total: number; jobs: number }[]; workerPayouts: { job: string; worker: string | null; amount: number }[] }
  emergencyPool: { id: string; name: string; skill: string; rating: number; availability: string }[]
  analytics: {
    utilization: number; jobsToday: number; activeToday: number
    demandMix: { skill: string; count: number; available: number }[]
    statusMix: { status: string; count: number }[]
  }
  notifications: NotificationDTO[]
}

// ---------- Active matching weights (Task 9 read-only mirror; mirrors MatchWeightsDTO minus meta fields) ----------

const WEIGHT_KEYS = ['skillMatch', 'certification', 'distance', 'availability', 'workload', 'serviceHistory'] as const
type WeightKey = (typeof WEIGHT_KEYS)[number]

interface WeightsResp {
  ok: boolean
  weights: MatchWeightsDTO
  meta: Array<{ key: string; label: string; desc: string }>
  defaults: Record<WeightKey, number>
}

// ---------- Constants & helpers ----------

const AMBER = '#f59e0b'
const EMERALD = '#10b981'
const ORANGE = '#fb923c'
const ZINC = '#a1a1aa'
const RED = '#ef4444'

const CHART_TIP = {
  contentStyle: {
    background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--foreground)',
  },
  cursor: { fill: 'color-mix(in oklab, var(--muted) 55%, transparent)' },
} as const

const SCROLL = 'max-h-96 space-y-2 overflow-y-auto pr-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 [&::-webkit-scrollbar]:w-1.5 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-700'

const ACTIVE_JOB_STATES = ['QUOTE_REQUESTED', 'QUOTED', 'NEGOTIATING', 'REQUESTED', 'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS']
const DONE_JOB_STATES = ['COMPLETED', 'PAID', 'REVIEWED']

// Canonical trade ordering for the emergency reserve-pool breakdown (any other trade is appended after)
const POOL_TRADES = ['electrician', 'plumber', 'carpenter', 'caregiver', 'driver', 'technician']

const ACTION_TAB: Record<string, string> = {
  certifications: 'certs',
  complaints: 'complaints',
  workers: 'workers',
  training: 'skills',
}

// Server attention items carry EN sentences; re-render them from structured fields in the active language.
const ATTENTION_KEYS: Record<string, { key: string; count: (d: CoopData) => number }> = {
  certifications: { key: 'attCerts', count: (d) => d.attention.certExpiring },
  complaints: { key: 'attComplaints', count: (d) => d.attention.seriousComplaints },
  workers: { key: 'attWorkers', count: (d) => d.attention.unavailable },
  training: { key: 'attTraining', count: (d) => d.attention.needTraining },
}

function attentionLabel(action: string, fallback: string, d: CoopData, lang: 'en' | 'mr' | 'hi'): string {
  const spec = ATTENTION_KEYS[action]
  if (!spec) return fallback
  return t(spec.key, lang).replace('{n}', String(spec.count(d)))
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// Segment width for the reserve-capacity bar: proportional to the reserve count, min 4% when non-zero
function segWidth(count: number, total: number): string {
  if (count <= 0 || total <= 0) return '0%'
  return `${Math.max(4, Math.round((count / total) * 100))}%`
}

// ---------- Snapshot export (client-side CSV via shared/csv helpers, no server round-trip) ----------

function buildSnapshotCsv(d: CoopData): string {
  const { cooperative: c, workers, certifications, complaints } = d
  const lines: string[] = []
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' IST'
  lines.push(csvRow(['GigSetu cooperative snapshot (SIH prototype — synthetic data)']))
  lines.push(csvRow(['Cooperative', c.name]))
  lines.push(csvRow(['Registration no.', c.regNo]))
  lines.push(csvRow(['Secretary', c.repName]))
  lines.push(csvRow(['Workers on rolls', c.workerCount, 'Digital records', workers.length]))
  lines.push(csvRow(['Jobs today', c.jobsToday, 'Active today', c.activeToday]))
  lines.push(csvRow(['Utilisation %', c.utilizationPct, 'Welfare fund (Rs)', c.welfareFundRs]))
  lines.push(csvRow(['Earnings this month (Rs)', c.earningsMonthRs, 'Emergency pool size', c.emergencyPoolSize]))
  lines.push(csvRow(['Generated at', stamp]))
  lines.push('')
  lines.push(csvRow(['--- WORKER REGISTER ---']))
  lines.push(csvRow(['Name', 'Primary skill', 'Experience (yrs)', 'Certification', 'Cert status', 'Cert expiry', 'Availability', 'Emergency pool', 'Base area', 'Service areas', 'Languages', 'Completed jobs', 'Rating', 'Completion %', 'Earnings month (Rs)', 'Welfare balance (Rs)', 'Trainings done', 'Phone']))
  for (const w of workers) {
    lines.push(csvRow([w.name, w.primarySkill, w.experienceYears, w.certName, w.certStatus, w.certExpiry ?? '—', w.availability, w.emergencyPool ? 'YES' : 'NO', w.baseArea, w.serviceAreas.join('; '), w.languages.join('; '), w.completedJobs, w.rating, w.completionRate, w.earningsMonthRs, w.welfareBalanceRs, w.trainingsDone, w.phone]))
  }
  lines.push('')
  lines.push(csvRow(['--- CERTIFICATION REVIEW QUEUE ---']))
  lines.push(csvRow(['Worker', 'Certification', 'Status', 'Expiry']))
  for (const cert of certifications) {
    lines.push(csvRow([cert.name, cert.certName, cert.certStatus, cert.certExpiry ?? '—']))
  }
  lines.push('')
  lines.push(csvRow(['--- COMPLAINT REGISTER ---']))
  lines.push(csvRow(['Customer', 'Subject', 'Severity', 'Status', 'Raised']))
  for (const comp of complaints) {
    lines.push(csvRow([comp.customerName, comp.subject, comp.severity, comp.status, comp.createdAt.slice(0, 10)]))
  }
  return lines.join('\n')
}


function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('')
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function dayLabel(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// ---------- Small presentational helpers ----------

function AvatarInitials({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-primary', className)}>
      {initials(name)}
    </span>
  )
}

function CertBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    VERIFIED: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
    EXPIRING: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
    PENDING: 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400',
  }
  return <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold', map[status] ?? map.PENDING)}>{status}</span>
}

function SevChip({ severity }: { severity: string }) {
  const map: Record<string, string> = {
    SERIOUS: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
    HIGH: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300',
    MEDIUM: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
    LOW: 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400',
  }
  return <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide', map[severity] ?? map.LOW)}>{severity}</span>
}

function ComplaintStatus({ status }: { status: string }) {
  // Phase 6 dispute ladder colors: OPEN amber · RESOLVING emerald outline · RESOLVED emerald · ESCALATED red
  const map: Record<string, string> = {
    OPEN: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
    RESOLVING: 'border-emerald-300 bg-emerald-50/40 text-emerald-700 dark:border-emerald-800 dark:bg-transparent dark:text-emerald-300',
    RESOLVED: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
    ESCALATED: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
  }
  return <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold', map[status] ?? map.OPEN)}>{status}</span>
}

function AvailLabel({ availability }: { availability: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium capitalize text-muted-foreground">
      <AvailDot availability={availability} /> {availability.toLowerCase()}
    </span>
  )
}

function LiveDot({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      {label}
    </span>
  )
}

function UtilGauge({ value }: { value: number }) {
  const color = value > 75 ? AMBER : EMERALD
  return (
    <div className="relative h-[150px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={[{ name: 'engaged', value }, { name: 'spare', value: Math.max(0, 100 - value) }]}
            dataKey="value" startAngle={90} endAngle={-270} innerRadius={52} outerRadius={70} strokeWidth={0}
          >
            <Cell fill={color} />
            <Cell fill="var(--muted)" />
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tabular-nums tracking-tight">{value}%</span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">utilisation</span>
      </div>
    </div>
  )
}

// ---------- Main component ----------

export function CoopApp({ user, focusCoopId }: { user: DemoUser; focusCoopId?: string }) {
  const clearFocus = useAppStore((s) => s.clearFocus)
  const lang = useAppStore((s) => s.lang)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('overview')
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null)
  const [wSearch, setWSearch] = useState('')
  const [wAvail, setWAvail] = useState('ALL')
  const [wSkill, setWSkill] = useState('ALL')
  const [jobFilter, setJobFilter] = useState('ACTIVE')
  const { ref: tabScrollerRef, fades: tabFades } = useEdgeFades<HTMLDivElement>()

  // Fair Pricing calculator state (Task 10) — client-side simulation of the cooperative rate card
  const [fpSkill, setFpSkill] = useState('electrician')
  const [fpUrgency, setFpUrgency] = useState<'NORMAL' | 'URGENT' | 'EMERGENCY'>('NORMAL')
  const [fpEvening, setFpEvening] = useState(false)
  const [fpMins, setFpMins] = useState(60)

  // Active matching weights (Task 9 read-only mirror) — shared cache key with the platform admin console
  const weightsQ = useQuery({
    queryKey: ['ai-weights'],
    queryFn: () => api.get<WeightsResp>('/api/ai/weights'),
    staleTime: 15000,
  })
  const catsQ = useQuery({
    queryKey: ['categories'],
    queryFn: () => api.get<{ ok: boolean; categories: ServiceCategoryDTO[] }>('/api/categories'),
    staleTime: 300000,
  })

  const orgId = focusCoopId || user.orgId
  const isDrillDown = !!focusCoopId && focusCoopId !== user.orgId
  const skillLabel = useSkillLabel()
  const skillScope = useSkillScope()

  // Coordination roles (taluka/district/platform) have no home cooperative —
  // the API falls back to the featured society so the dashboard still renders.
  const q = useQuery({
    queryKey: ['coop', orgId ?? 'featured'],
    queryFn: () => api.get<CoopData>(`/api/coop${orgId ? `?id=${encodeURIComponent(orgId)}` : ''}`),
    refetchInterval: 8000,
  })

  const d = q.data
  const coop = d?.cooperative
  const workers = useMemo(() => d?.workers ?? [], [d])
  const jobs = useMemo(() => d?.jobs ?? [], [d])

  // Phase 6 #58 — dedicated complaints register query (GET /api/complaints?cooperativeId=…).
  // Scoped to the resolved society (drill-down + featured fallback included); the /api/coop
  // payload rows act as the instant fallback while this query loads.
  const complaintsQ = useQuery({
    queryKey: ['coop-complaints', coop?.id ?? 'pending'],
    queryFn: () => api.get<{ ok: boolean; complaints: ComplaintRow[] }>(`/api/complaints?cooperativeId=${encodeURIComponent(coop?.id ?? '')}`),
    enabled: !!coop?.id,
    refetchInterval: 8000,
  })
  const complaints = useMemo(
    () => complaintsQ.data?.complaints ?? d?.complaints ?? [],
    [complaintsQ.data, d]
  )
  const bySkill = useMemo(() => d?.bySkill ?? [], [d])

  // ----- Emergency reserve pool grouped by trade (Task 17) -----
  const poolRows = useMemo(() => {
    const groups = new Map<string, { total: number; available: number; dispatched: number }>()
    for (const w of workers) {
      if (!w.emergencyPool) continue
      const g = groups.get(w.primarySkill) ?? { total: 0, available: 0, dispatched: 0 }
      g.total += 1
      if (w.availability === 'AVAILABLE') g.available += 1
      if (w.activeJobsToday > 0) g.dispatched += 1
      groups.set(w.primarySkill, g)
    }
    const keys = [...groups.keys()].sort((a, b) => {
      const ia = POOL_TRADES.indexOf(a)
      const ib = POOL_TRADES.indexOf(b)
      if (ia === -1 && ib === -1) return a.localeCompare(b)
      if (ia === -1) return 1
      if (ib === -1) return -1
      return ia - ib
    })
    return keys.map((skill) => ({ skill, ...(groups.get(skill) as { total: number; available: number; dispatched: number }) }))
  }, [workers])

  const poolTotals = useMemo(
    () => ({
      total: poolRows.reduce((s, r) => s + r.total, 0),
      available: poolRows.reduce((s, r) => s + r.available, 0),
      dispatched: poolRows.reduce((s, r) => s + r.dispatched, 0),
    }),
    [poolRows]
  )

  // ----- Fair price range calculator (Task 10) — mirrors lib/pricing.ts engine -----
  const fpCategory = useMemo(
    () => catsQ.data?.categories.find((c) => c.key === fpSkill) ?? catsQ.data?.categories[0] ?? null,
    [catsQ.data, fpSkill]
  )

  const fpBreakdown = useMemo(() => {
    if (!fpCategory) return null
    const scheduledAt = new Date()
    scheduledAt.setHours(fpEvening ? 19 : 11, 0, 0, 0)
    const mins = Number.isFinite(fpMins) && fpMins > 0 ? Math.round(fpMins) : undefined
    return estimatePrice(fpCategory, fpUrgency, scheduledAt, mins)
  }, [fpCategory, fpUrgency, fpEvening, fpMins])

  const availCounts = useMemo(() => {
    const c = { AVAILABLE: 0, BUSY: 0, OFFLINE: 0 } as Record<'AVAILABLE' | 'BUSY' | 'OFFLINE', number>
    workers.forEach((w) => { c[w.availability] += 1 })
    return c
  }, [workers])

  const verifiedCount = useMemo(() => workers.filter((w) => w.certStatus === 'VERIFIED').length, [workers])
  const seriousOpen = useMemo(() => complaints.filter((c) => c.severity === 'SERIOUS' && c.status !== 'RESOLVED').length, [complaints])

  // ----- Phase 6 #58 — committee actions on the complaint ladder -----
  // RESOLVE requires a ≥4-char note; ESCALATE accepts an optional note; ACK / REOPEN are one-click.
  const [actionDlg, setActionDlg] = useState<{ complaint: ComplaintRow; action: 'RESOLVE' | 'ESCALATE' } | null>(null)
  const [actionNote, setActionNote] = useState('')

  const complaintAction = useMutation({
    mutationFn: (p: { id: string; action: string; note?: string }) =>
      api.patch<{ ok: boolean; complaint: ComplaintRow }>('/api/complaints', { ...p, by: user.name }),
    onSuccess: (_res, p) => {
      queryClient.invalidateQueries({ queryKey: ['coop-complaints'] })
      queryClient.invalidateQueries({ queryKey: ['coop', orgId ?? 'featured'] })
      setActionDlg(null)
      setActionNote('')
      toast({
        title: p.action === 'RESOLVE' ? 'Complaint marked resolved'
          : p.action === 'ESCALATE' ? 'Complaint escalated'
          : p.action === 'REOPEN' ? 'Complaint reopened'
          : 'Complaint acknowledged',
        description: `Recorded by ${user.name} — audit-logged to the transparency trail.`,
      })
    },
    onError: (e) => {
      toast({ title: 'Action failed', description: e instanceof Error ? e.message : 'Try again', variant: 'destructive' })
    },
  })

  const submitComplaintAction = () => {
    if (!actionDlg) return
    const note = actionNote.trim()
    if (actionDlg.action === 'RESOLVE' && note.length < 4) return
    complaintAction.mutate({ id: actionDlg.complaint.id, action: actionDlg.action, ...(note ? { note } : {}) })
  }

  const insights = useMemo(() => {
    if (!d) return []
    const arr: string[] = []
    const busiest = [...d.analytics.demandMix].sort((a, b) => b.count - a.count)[0]
    if (busiest) arr.push(`${skillLabel(busiest.skill)} ${t('insBusiest', lang)} ${busiest.count} ${t('insDigital', lang)} ${busiest.available} ${t('insOnFloor', lang)}`)
    const u = d.analytics.utilization
    if (u > 75) arr.push(`${t('insUtilPrefix', lang)} ${u}% ${t('insUtilHigh', lang)}`)
    else if (u < 40) arr.push(`${t('insUtilPrefix', lang)} ${u}% ${t('insUtilLow', lang)}`)
    else arr.push(`${t('insUtilPrefix', lang)} ${u}% ${t('insUtilMid', lang)}`)
    const onFloor = workers.length - availCounts.OFFLINE
    arr.push(`${onFloor} ${t('insDispatchA', lang)} ${workers.length} ${t('insDispatchB', lang)} ${availCounts.OFFLINE} ${t('insOfflineTail', lang)}`)
    const top = [...workers].filter((w) => w.completedJobs >= 10).sort((a, b) => b.rating - a.rating)[0]
    if (top) arr.push(`${t('insTopPerformer', lang)} ${top.name} — ${top.rating.toFixed(2)} ★ ${t('insAcrossJobs', lang)} ${top.completedJobs} ${t('insJobsWord', lang)} ${top.completionRate}% ${t('completionWord', lang)}.`)
    if (seriousOpen > 0) arr.push(`${seriousOpen} ${t('insSeriousOpen', lang)}`)
    else arr.push(t('insNoSerious', lang))
    return arr
  }, [d, workers, availCounts, seriousOpen, lang, skillLabel])

  const selectedWorker = workers.find((w) => w.id === selectedWorkerId) ?? null

  // Worker-of-the-Month spotlight: best-rated digital record with a meaningful job history
  const spotlight = useMemo(
    () => [...workers].filter((w) => w.completedJobs >= 10).sort((a, b) => (b.rating - a.rating) || (b.completedJobs - a.completedJobs))[0] ?? null,
    [workers]
  )

  // ----- Loading / error states -----
  if (q.isLoading || (!d && !q.isError)) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Skeleton className="h-16 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-primary" /> {t('loadingCoop', lang)}
        </div>
      </div>
    )
  }

  if (q.isError || !d || !coop) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 py-10">
        {isDrillDown && (
          <DrillBanner
            label={t('drillUnavailable', lang)}
            sublabel={t('drillUnavailableSubCoop', lang)}
            onClear={() => clearFocus(['coop'])}
            clearLabel={t('drillClear', lang)}
          />
        )}
        <EmptyState
          icon={<FileWarning className="h-10 w-10" />}
          title="Could not load cooperative data"
          body={q.error instanceof Error ? q.error.message : 'The cooperative API did not respond. Check that the seed data is loaded.'}
          action={
            <Button size="sm" variant="outline" onClick={() => q.refetch()}><RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry</Button>
          }
        />
      </div>
    )
  }

  const policy = coop.pricingPolicy
  const workerSharePct = 100 - (policy.coopCommissionPct + policy.welfareContributionPct + policy.platformFeePct)

  const filteredWorkers = workers.filter((w) => {
    const s = wSearch.trim().toLowerCase()
    const matchesQ = !s || [w.name, w.primarySkill, w.baseArea, w.phone].some((v) => v?.toLowerCase().includes(s))
    const matchesA = wAvail === 'ALL' || w.availability === wAvail
    const matchesS = wSkill === 'ALL' || w.primarySkill === wSkill
    return matchesQ && matchesA && matchesS
  })

  const shownJobs = jobs.filter((b) =>
    jobFilter === 'ALL' ? true : jobFilter === 'ACTIVE' ? ACTIVE_JOB_STATES.includes(b.status) : DONE_JOB_STATES.includes(b.status)
  )

  const offlineWorkers = workers.filter((w) => w.availability === 'OFFLINE')
  const topWelfare = [...workers].sort((a, b) => b.welfareBalanceRs - a.welfareBalanceRs).slice(0, 8)
  const maxWelfare = topWelfare[0]?.welfareBalanceRs ?? 0
  const paidJobs = jobs.filter((b) => b.payment)
  const poolRecords = workers.filter((w) => w.emergencyPool).length

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* ---------- Drill-down context ---------- */}
      {isDrillDown && (
        <DrillBanner
          label={`${t('drillViewing', lang)} ${coop.name} · ${t('drillTag', lang)}`}
          sublabel={user.orgId ? t('drillSubCoopOwn', lang) : t('drillSubCoopInspect', lang)}
          onClear={() => clearFocus(['coop'])}
          clearLabel={user.orgId ? t('drillBackCoop', lang) : t('drillClearFocus', lang)}
        />
      )}

      {/* ---------- Header ---------- */}
      <header className="rounded-2xl border bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight sm:text-2xl">{coop.name}</h1>
              <VerifiedBadge status={coop.verification} />
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground sm:text-sm">
              <Building2 className="h-3.5 w-3.5" /> {coop.societyType} · Reg. No. {coop.regNo}
              {user.role === 'COOP_ADMIN'
                ? <> · Secretary {user.name}</>
                : <> · <span className="font-medium text-foreground">{isDrillDown ? 'Inspection view' : 'Network view'}</span> — {user.title || user.role.replace(/_/g, ' ').toLowerCase()} {user.name}</>}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1 border-primary/30 bg-accent text-primary capitalize">
              <Zap className="h-3 w-3" /> {coop.sector}
            </Badge>
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
              {coop.status}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 px-2.5 text-xs"
              onClick={() => {
                try {
                  downloadCsv(`gigsetu-snapshot-${slugify(coop.name).slice(0, 40)}.csv`, buildSnapshotCsv(d))
                  toast({
                    title: t('csvSnapshotToast', lang),
                    description: `${workers.length} ${t('workers', lang)} · ${complaints.length} ${t('complaints', lang)} — ${t('csvSnapshotToastSub', lang)}`,
                  })
                } catch {
                  toast({ title: t('csvExportFail', lang), description: t('csvExportFailSub', lang), variant: 'destructive' })
                }
              }}
            >
              <Download className="h-3.5 w-3.5" /> Snapshot CSV
            </Button>
          </div>
        </div>
        <PrototypeNotice className="mt-3" />
      </header>

      {/* ---------- Tabs ---------- */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="relative">
          <div ref={tabScrollerRef} className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
            <TabsList className="h-auto w-max justify-start gap-1">
              <TabsTrigger value="overview" className="gap-1.5 text-xs sm:text-sm"><LayoutDashboard className="h-3.5 w-3.5" /> {t('overview', lang)}</TabsTrigger>
              <TabsTrigger value="workers" className="gap-1.5 text-xs sm:text-sm"><Users className="h-3.5 w-3.5" /> {t('workers', lang)}</TabsTrigger>
              <TabsTrigger value="skills" className="gap-1.5 text-xs sm:text-sm"><Wrench className="h-3.5 w-3.5" /> {t('skills', lang)}</TabsTrigger>
              <TabsTrigger value="certs" className="gap-1.5 text-xs sm:text-sm"><BadgeCheck className="h-3.5 w-3.5" /> {t('certifications', lang)}</TabsTrigger>
              <TabsTrigger value="jobs" className="gap-1.5 text-xs sm:text-sm"><ClipboardList className="h-3.5 w-3.5" /> {t('jobs', lang)}</TabsTrigger>
              <TabsTrigger value="availability" className="gap-1.5 text-xs sm:text-sm"><Activity className="h-3.5 w-3.5" /> {t('availability', lang)}</TabsTrigger>
              <TabsTrigger value="welfare" className="gap-1.5 text-xs sm:text-sm"><PiggyBank className="h-3.5 w-3.5" /> {t('welfare', lang)}</TabsTrigger>
              <TabsTrigger value="complaints" className="gap-1.5 text-xs sm:text-sm"><FileWarning className="h-3.5 w-3.5" /> {t('complaints', lang)}</TabsTrigger>
              <TabsTrigger value="earnings" className="gap-1.5 text-xs sm:text-sm"><IndianRupee className="h-3.5 w-3.5" /> {t('earnings', lang)}</TabsTrigger>
              <TabsTrigger value="pricing" className="gap-1.5 text-xs sm:text-sm"><ScrollText className="h-3.5 w-3.5" /> {t('pricing', lang)}</TabsTrigger>
              <TabsTrigger value="procurement" className="gap-1.5 text-xs sm:text-sm"><ShoppingCart className="h-3.5 w-3.5" /> {t('prTab', lang)}</TabsTrigger>
              <TabsTrigger value="economics" className="gap-1.5 text-xs sm:text-sm"><HandCoins className="h-3.5 w-3.5" /> {t('ecTab', lang)}</TabsTrigger>
              <TabsTrigger value="pool" className="gap-1.5 text-xs sm:text-sm"><Siren className="h-3.5 w-3.5" /> {t('emergencyPool', lang)}</TabsTrigger>
              <TabsTrigger value="analytics" className="gap-1.5 text-xs sm:text-sm"><BarChart3 className="h-3.5 w-3.5" /> {t('analytics', lang)}</TabsTrigger>
            </TabsList>
          </div>
          <EdgeFadeOverlays fades={tabFades} />
        </div>

        {/* ================= OVERVIEW ================= */}
        <TabsContent value="overview" className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label={t('workers', lang)} value={coop.workerCount} icon={<Users className="h-4 w-4" />}
              sub={`${workers.length} ${t('kpiWorkersSub', lang)}`}
            />
            <KpiCard label={t('kpiActiveToday', lang)} value={coop.activeToday} icon={<Activity className="h-4 w-4" />} tone="success" sub={t('kpiActiveTodaySub', lang)} />
            <KpiCard label={t('kpiJobsToday', lang)} value={coop.jobsToday} icon={<ClipboardList className="h-4 w-4" />} tone="primary" sub={t('kpiJobsTodaySub', lang)} />
            <KpiCard
              label={t('kpiUtilisation', lang)} value={`${coop.utilizationPct}%`} icon={<Gauge className="h-4 w-4" />}
              tone={coop.utilizationPct > 75 ? 'warning' : 'success'}
              sub={coop.utilizationPct > 75 ? t('utilAbove75', lang) : t('utilHealthy', lang)}
            />
          </div>

          {/* Cooperative Reputation (#36) — Phase 5, single placement: Overview top */}
          <CoopReputationCard coopId={coop.id} onOpenComplaints={() => setTab('complaints')} />

          {/* Verification status (#44, coop side) — Phase 5, transparent criteria from live payload */}
          <CoopVerificationCard
            coopId={coop.id}
            coop={{
              regNo: coop.regNo, repName: coop.repName, repRole: coop.repRole, memberCount: coop.memberCount,
              workerCount: coop.workerCount, activeToday: coop.activeToday, utilizationPct: coop.utilizationPct,
              welfareFundRs: coop.welfareFundRs, emergencyPoolSize: coop.emergencyPoolSize,
            }}
            workers={workers}
            openComplaints={complaints.filter((c) => c.status !== 'RESOLVED').length}
            totalComplaints={complaints.length}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard
              title={t('attentionTitle', lang)} description={t('attentionDesc', lang)}
              actions={d.attention.items.length > 0 ? <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">{d.attention.items.length}</Badge> : undefined}
            >
              {d.attention.items.length === 0 ? (
                <EmptyState title={t('allClear', lang)} body={t('allClearBody', lang)} />
              ) : (
                <div className="space-y-0.5">
                  {d.attention.items.map((item) => {
                    const target = ACTION_TAB[item.action]
                    const label = attentionLabel(item.action, item.label, d, lang)
                    return target ? (
                      <button
                        key={item.label}
                        onClick={() => setTab(target)}
                        className="flex w-full items-center justify-between gap-2 rounded-md px-1 text-left transition hover:bg-accent/60"
                      >
                        <AttentionRow severity={item.severity} label={label} />
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                      </button>
                    ) : (
                      <AttentionRow key={item.label} severity={item.severity} label={label} />
                    )
                  })}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title={t('autoGovTitle', lang)}
              description={t('autoGovDesc', lang)}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold"><Bot className="h-3.5 w-3.5 text-primary" /> {t('automatedByPlatform', lang)}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[t('autoMatching', lang), t('autoScheduling', lang), t('notifications', lang), t('payments', lang), t('autoRatings', lang)].map((x) => (
                      <Badge key={x} variant="secondary" className="text-[10px] font-normal">{x}</Badge>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold"><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> {t('ownedByCoop', lang)}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[t('ownVerification', lang), t('ownGovernance', lang), t('welfare', lang), t('ownExceptions', lang), t('ownSerious', lang)].map((x) => (
                      <Badge key={x} variant="secondary" className="text-[10px] font-normal">{x}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label={t('kpiWelfareFund', lang)} value={inr(coop.welfareFundRs)} icon={<PiggyBank className="h-4 w-4" />} tone="success" sub={t('welfareFundSub', lang)} />
            <KpiCard label={t('emergencyPool', lang)} value={coop.emergencyPoolSize} icon={<Siren className="h-4 w-4" />} tone="danger" sub={t('poolMembersSub', lang)} />
            <KpiCard label={t('kpiMembers', lang)} value={coop.memberCount} icon={<Users className="h-4 w-4" />} sub={t('membersSub', lang)} />
            <KpiCard label={t('kpiEarningsMonth', lang)} value={inr(coop.earningsMonthRs)} icon={<Wallet className="h-4 w-4" />} tone="primary" sub={t('grossRoutedSub', lang)} />
          </div>

          {/* Worker of the Month — cooperative recognition (governance-owned, not platform-assigned) */}
          {spotlight && (
            <section aria-label="Worker of the month recognition">
              <div className="relative overflow-hidden rounded-xl border border-amber-300/70 bg-gradient-to-r from-amber-50 via-background to-background p-4 shadow-sm dark:border-amber-800/60 dark:from-amber-950/40 dark:via-background dark:to-background sm:p-5">
                <div aria-hidden className="pointer-events-none absolute -right-6 -top-8 select-none text-[92px] font-black leading-none text-amber-500/10">★</div>
                <div className="flex flex-wrap items-center gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-sm">
                    <Trophy className="h-6 w-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">{t('wotm', lang)}</p>
                    <p className="mt-0.5 truncate text-lg font-bold leading-tight">{spotlight.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {skillLabel(spotlight.primarySkill)} · {spotlight.baseArea} · {spotlight.completedJobs} {t('jobsCompletedWord', lang)} · {spotlight.completionRate}% {t('completionWord', lang)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 sm:gap-6">
                    <div className="text-center">
                      <RatingStars value={spotlight.rating} />
                      <p className="mt-0.5 text-xs font-semibold tabular-nums">{spotlight.rating.toFixed(2)} {t('memberRating', lang)}</p>
                    </div>
                    <div className="hidden text-center sm:block">
                      <p className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{inr(spotlight.earningsMonthRs)}</p>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('thisMonth', lang)}</p>
                    </div>
                  </div>
                </div>
                <p className="mt-3 border-t border-amber-200/60 pt-2 text-[11px] text-muted-foreground dark:border-amber-900/60">
                  {t('wotmFoot', lang)}
                </p>
              </div>
            </section>
          )}
        </TabsContent>

        {/* ================= WORKERS ================= */}
        <TabsContent value="workers" className="space-y-4 pt-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('searchWorkersPh', lang)} value={wSearch} onChange={(e) => setWSearch(e.target.value)}
                className="pl-9" aria-label="Search workers"
              />
            </div>
            <div className="flex gap-2">
              <Select value={wAvail} onValueChange={setWAvail}>
                <SelectTrigger className="h-9 w-[140px]" aria-label="Filter by availability"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t('allAvailability', lang)}</SelectItem>
                  <SelectItem value="AVAILABLE">{t('available', lang)}</SelectItem>
                  <SelectItem value="BUSY">{t('busy', lang)}</SelectItem>
                  <SelectItem value="OFFLINE">{t('offline', lang)}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={wSkill} onValueChange={setWSkill}>
                <SelectTrigger className="h-9 w-[150px]" aria-label="Filter by skill"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">{t('allSkills', lang)}</SelectItem>
                  {bySkill.map((s) => <SelectItem key={s.skill} value={s.skill}>{skillLabel(s.skill)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {t('showingWord', lang)} {filteredWorkers.length} {t('ofWord', lang)} {workers.length} {t('digitalRecords', lang)} ({coop.workerCount} {t('onCoopRolls', lang)})
          </p>

          {filteredWorkers.length === 0 ? (
            <EmptyState icon={<Users className="h-10 w-10" />} title={t('noWorkersTitle', lang)} body={t('noWorkersBody', lang)} />
          ) : (
            <div className={SCROLL}>
              {filteredWorkers.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setSelectedWorkerId(w.id)}
                  className="flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left transition hover:border-primary/40 hover:bg-accent/50"
                >
                  <AvatarInitials name={w.name} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                      {w.name}
                      {w.emergencyPool && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-500 text-amber-500" aria-label="Emergency pool member" />}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {skillLabel(w.primarySkill)} · {w.baseArea} · {w.completedJobs} {t('jobsWordShort', lang)}{w.activeJobsToday > 0 ? ` · ${w.activeJobsToday} ${t('activeWord', lang)}` : ''}
                    </p>
                    <div className="mt-1 sm:hidden"><CertBadge status={w.certStatus} /></div>
                  </div>
                  <div className="hidden shrink-0 items-center gap-3 sm:flex">
                    <CertBadge status={w.certStatus} />
                    <RatingStars value={w.rating} />
                  </div>
                  <div className="w-[86px] shrink-0 text-right">
                    <AvailLabel availability={w.availability} />
                    <p className="mt-0.5 text-[11px] text-muted-foreground sm:hidden">{w.rating.toFixed(2)} ★</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Star className="h-3 w-3 fill-amber-500 text-amber-500" /> {t('starNote', lang)}
          </p>
        </TabsContent>

        {/* ================= SKILLS ================= */}
        <TabsContent value="skills" className="space-y-4 pt-2">
          <SectionCard title={t('tradeComposition', lang)} description={t('tradeCompositionDesc', lang)}>
            {bySkill.length === 0 ? (
              <EmptyState title={t('noSkillData', lang)} />
            ) : (
              <>
                <div style={{ height: Math.max(140, bySkill.length * 64 + 36) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={bySkill} layout="vertical" margin={{ top: 4, right: 24, bottom: 0, left: 8 }}>
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="skill" width={92} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                      <RTooltip {...CHART_TIP} />
                      <Bar dataKey="count" name={t('recordsWord', lang)} fill={AMBER} radius={[0, 4, 4, 0]} barSize={12} />
                      <Bar dataKey="available" name={t('available', lang)} fill={EMERALD} radius={[0, 4, 4, 0]} barSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <Separator className="my-4" />
                <div className={SCROLL}>
                  {bySkill.map((s) => {
                    const coverage = Math.round((s.available / Math.max(1, s.count)) * 100)
                    return (
                      <div key={s.skill} className="flex items-center gap-3 rounded-lg border p-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold">{skillLabel(s.skill)}</p>
                            <RatingStars value={s.avgRating} />
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">{skillScope(s.skill) ?? `${t('avgRatingWord', lang)} · ${t('coverageWord', lang)} ${s.available}/${s.count} ${t('available', lang)} (${coverage}%)`}</p>
                          <Progress value={coverage} className="mt-2 h-1.5" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </SectionCard>
        </TabsContent>

        {/* ================= CERTIFICATIONS ================= */}
        <TabsContent value="certs" className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <KpiCard label={t('kpiFullyVerified', lang)} value={verifiedCount} icon={<ShieldCheck className="h-4 w-4" />} tone="success" sub={t('ofDigitalRecords', lang)} />
            <KpiCard
              label={t('kpiExpiring', lang)} value={d.attention.certExpiring} icon={<CalendarClock className="h-4 w-4" />}
              tone={d.attention.certExpiring > 0 ? 'warning' : 'default'} sub={t('expiryWithin', lang)}
            />
            <KpiCard label={t('kpiNeedsReview', lang)} value={d.certifications.length} icon={<BadgeCheck className="h-4 w-4" />} sub="EXPIRING / PENDING" />
          </div>

          <SectionCard
            title={t('certQueueTitle', lang)} description={t('certQueueDesc', lang)}
          >
            {d.certifications.length === 0 ? (
              <EmptyState icon={<BadgeCheck className="h-10 w-10" />} title={t('allCertsVerified', lang)} body={t('allCertsBody', lang)} />
            ) : (
              <div className={SCROLL}>
                {d.certifications.map((c) => {
                  const expired = c.certExpiry ? new Date(c.certExpiry).getTime() < Date.now() : false
                  return (
                    <div key={c.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <AvatarInitials name={c.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{c.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{c.certName}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <CertBadge status={c.certStatus} />
                        <p className={cn('mt-1 text-[11px]', expired ? 'font-medium text-red-600 dark:text-red-400' : 'text-muted-foreground')}>
                          {expired ? t('expiredWord', lang) : t('validTill', lang)} · {fmtDate(c.certExpiry)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>
        </TabsContent>

        {/* ================= JOBS ================= */}
        <TabsContent value="jobs" className="space-y-4 pt-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <LiveDot label={t('liveAutoRefresh', lang)} />
              <span className="text-xs text-muted-foreground">{jobs.length} {t('recentJobsRouted', lang)}</span>
            </div>
            <Select value={jobFilter} onValueChange={setJobFilter}>
              <SelectTrigger className="h-9 w-[150px]" aria-label="Filter jobs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">{t('inFlight', lang)}</SelectItem>
                <SelectItem value="DONE">{t('completed', lang)}</SelectItem>
                <SelectItem value="ALL">{t('allJobs', lang)}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-dashed px-3 py-2 text-[11px] text-muted-foreground">
            <Timer className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>{t('demoNoteJobs', lang)}</span>
          </div>

          {shownJobs.length === 0 ? (
            <EmptyState icon={<ClipboardList className="h-10 w-10" />} title={t('noJobsTitle', lang)} body={t('noJobsBody', lang)} />
          ) : (
            <div className={SCROLL}>
              {shownJobs.map((b) => (
                <div key={b.id} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="truncate text-sm font-semibold">{b.title}</p>
                      {b.urgency === 'EMERGENCY' && <Badge variant="destructive" className="h-4 px-1 text-[9px]">SOS</Badge>}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {b.refCode} · {b.workerName ?? t('matchingWorkers', lang)} → {b.customerName ?? t('customer', lang)} · <MapPin className="mb-0.5 inline h-3 w-3" />{b.area} · {timeAgo(b.createdAt)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <StatusChip status={b.status} />
                    {(b.finalPrice || b.estimatedPrice) && (
                      <p className="mt-1 text-xs font-semibold tabular-nums">{inr(b.finalPrice ?? b.estimatedPrice)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ================= AVAILABILITY ================= */}
        <TabsContent value="availability" className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label={t('kpiAvailableNow', lang)} value={availCounts.AVAILABLE} tone="success" icon={<Activity className="h-4 w-4" />} />
            <KpiCard label={t('kpiBusyJobs', lang)} value={availCounts.BUSY} tone="warning" />
            <KpiCard label={t('offline', lang)} value={availCounts.OFFLINE} />
            <KpiCard
              label={t('kpiFloorReadiness', lang)} value={`${Math.round(((availCounts.AVAILABLE + availCounts.BUSY) / Math.max(1, workers.length)) * 100)}%`}
              sub={t('recordsOnFloor', lang)} tone="primary"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title={t('availSplitTitle', lang)} description={t('availSplitDesc', lang)}>
              <div className="relative h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: t('available', lang), value: availCounts.AVAILABLE },
                        { name: t('busy', lang), value: availCounts.BUSY },
                        { name: t('offline', lang), value: availCounts.OFFLINE },
                      ].filter((x) => x.value > 0)}
                      dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={2} strokeWidth={0}
                    >
                      <Cell fill={EMERALD} /><Cell fill={AMBER} /><Cell fill={ZINC} />
                    </Pie>
                    <RTooltip {...CHART_TIP} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold tabular-nums">{workers.length}</span>
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{t('recordsWord', lang).toLowerCase()}</span>
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> {t('available', lang)} {availCounts.AVAILABLE}</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> {t('busy', lang)} {availCounts.BUSY}</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-zinc-400" /> {t('offline', lang)} {availCounts.OFFLINE}</span>
                </div>
              </div>
            </SectionCard>

            <SectionCard title={t('offlineTodayTitle', lang)} description={t('offlineTodayDesc', lang)}>
              {offlineWorkers.length === 0 ? (
                <EmptyState icon={<Activity className="h-10 w-10" />} title={t('everyoneOnFloor', lang)} body={t('everyoneOnFloorBody', lang)} />
              ) : (
                <div className={SCROLL}>
                  {offlineWorkers.map((w) => (
                    <div key={w.id} className="flex items-center gap-3 rounded-lg border p-3">
                      <AvatarInitials name={w.name} className="opacity-70" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{w.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{skillLabel(w.primarySkill)} · {w.baseArea}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <AvailLabel availability={w.availability} />
                        <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-muted-foreground"><Phone className="h-3 w-3" /> {w.phone}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </TabsContent>

        {/* ================= WELFARE ================= */}
        <TabsContent value="welfare" className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label={t('kpiWelfareFund', lang)} value={inr(coop.welfareFundRs)} tone="success" icon={<PiggyBank className="h-4 w-4" />} sub={t('welfareFundSub', lang)} />
            <KpiCard
              label={t('kpiAvgLedger', lang)}
              value={inr(workers.length ? Math.round(workers.reduce((s, w) => s + w.welfareBalanceRs, 0) / workers.length) : 0)}
              sub={t('perRecord', lang)}
            />
            <KpiCard label={t('kpiTopLedger', lang)} value={inr(maxWelfare)} sub={t('highestMember', lang)} />
            <KpiCard label={t('kpiContributionRate', lang)} value={`${policy.welfareContributionPct}%`} tone="primary" sub={t('ofEveryPayment', lang)} />
          </div>

          <SectionCard
            title={t('welfareBalancesTitle', lang)}
            description={`${policy.welfareContributionPct}% ${t('ofEveryPayment', lang)} — no manual collection, fully audited. Balances below are individual entitlement ledgers.`}
          >
            {topWelfare.length === 0 ? (
              <EmptyState title={t('noWelfareYet', lang)} />
            ) : (
              <div className={SCROLL}>
                {topWelfare.map((w, i) => (
                  <div key={w.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <span className="w-6 shrink-0 text-center text-xs font-bold tabular-nums text-muted-foreground">#{i + 1}</span>
                    <AvatarInitials name={w.name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold">{w.name}</p>
                        <p className="shrink-0 text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{inr(w.welfareBalanceRs)}</p>
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{skillLabel(w.primarySkill)} · {w.trainingsDone} {t('trainingsDoneShort', lang)}</p>
                      <Progress value={Math.round((w.welfareBalanceRs / Math.max(1, maxWelfare)) * 100)} className="mt-2 h-1.5" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <div className="flex items-start gap-2 rounded-lg border border-dashed px-3 py-2 text-[11px] text-muted-foreground">
            <HeartHandshake className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>{t('welfareNote', lang)}</span>
          </div>
        </TabsContent>

        {/* ================= COMPLAINTS ================= */}
        <TabsContent value="complaints" className="space-y-4 pt-2">
          {seriousOpen > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
              <Gavel className="mt-0.5 h-4 w-4 shrink-0" />
              <span><span className="font-bold">{seriousOpen} SERIOUS</span> {t('seriousBanner', lang)}</span>
            </div>
          )}

          {/* Phase 6 #58 — full dispute ladder: OPEN → RESOLVING → RESOLVED, with ESCALATED beside them */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label={t('pending', lang)} value={complaints.filter((c) => c.status === 'OPEN').length} tone={seriousOpen > 0 ? 'danger' : 'warning'} />
            <KpiCard label="Under review" value={complaints.filter((c) => c.status === 'RESOLVING').length} tone="warning" sub="RESOLVING" />
            <KpiCard label={t('kpiResolved', lang)} value={complaints.filter((c) => c.status === 'RESOLVED').length} tone="success" />
            <KpiCard label="Escalated" value={complaints.filter((c) => c.status === 'ESCALATED').length} tone={complaints.some((c) => c.status === 'ESCALATED') ? 'danger' : 'default'} sub="district review" />
          </div>

          <SectionCard title={t('complaintRegister', lang)} description={t('complaintRegisterDesc', lang)}>
            {complaints.length === 0 ? (
              <EmptyState icon={<FileWarning className="h-10 w-10" />} title={t('noComplaintsTitle', lang)} body={t('noComplaintsBody', lang)} />
            ) : (
              <div className={SCROLL}>
                {complaints.map((c) => (
                  <div key={c.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <SevChip severity={c.severity} />
                        <p className="truncate text-sm font-semibold">{c.subject}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <ComplaintStatus status={c.status} />
                        <span className="text-[11px] text-muted-foreground">{timeAgo(c.createdAt)}</span>
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{c.detail}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{t('customer', lang)}: {c.customerName}{c.workerId ? ` · ${t('linkedWorker', lang)}` : ''}</p>

                    {/* Lifecycle actions per status — every click PATCHes /api/complaints and is audit-logged */}
                    {c.status === 'RESOLVED' && c.resolutionNote ? (
                      <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50/60 px-2.5 py-1.5 text-[11px] leading-relaxed text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
                        <span className="font-semibold">{t('kpiResolved', lang)}{c.resolvedAt ? ` · ${timeAgo(c.resolvedAt)}` : ''}:</span> {c.resolutionNote}
                      </div>
                    ) : (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {c.status === 'OPEN' && (
                          <>
                            <Button size="sm" className="h-8 gap-1.5" disabled={complaintAction.isPending} onClick={() => complaintAction.mutate({ id: c.id, action: 'ACK' })}>
                              <BadgeCheck className="h-3.5 w-3.5" /> Acknowledge
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 gap-1.5 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950" disabled={complaintAction.isPending} onClick={() => { setActionDlg({ complaint: c, action: 'ESCALATE' }); setActionNote('') }}>
                              <Gavel className="h-3.5 w-3.5" /> Escalate
                            </Button>
                          </>
                        )}
                        {c.status === 'RESOLVING' && (
                          <>
                            <Button size="sm" className="h-8 gap-1.5" disabled={complaintAction.isPending} onClick={() => { setActionDlg({ complaint: c, action: 'RESOLVE' }); setActionNote('') }}>
                              <BadgeCheck className="h-3.5 w-3.5" /> Resolve…
                            </Button>
                            <Button size="sm" variant="outline" className="h-8 gap-1.5 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950" disabled={complaintAction.isPending} onClick={() => { setActionDlg({ complaint: c, action: 'ESCALATE' }); setActionNote('') }}>
                              <Gavel className="h-3.5 w-3.5" /> Escalate
                            </Button>
                          </>
                        )}
                        {c.status === 'ESCALATED' && (
                          <>
                            <Button size="sm" variant="outline" className="h-8 gap-1.5" disabled={complaintAction.isPending} onClick={() => complaintAction.mutate({ id: c.id, action: 'REOPEN' })}>
                              <RefreshCw className="h-3.5 w-3.5" /> Reopen
                            </Button>
                            <Button size="sm" className="h-8 gap-1.5" disabled={complaintAction.isPending} onClick={() => { setActionDlg({ complaint: c, action: 'RESOLVE' }); setActionNote('') }}>
                              <BadgeCheck className="h-3.5 w-3.5" /> Resolve…
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Resolve / Escalate note dialog (Phase 6 #58) */}
          <Dialog open={!!actionDlg} onOpenChange={(o) => { if (!o) { setActionDlg(null); setActionNote('') } }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{actionDlg?.action === 'ESCALATE' ? 'Escalate complaint' : 'Resolve complaint'}</DialogTitle>
                <DialogDescription>
                  {actionDlg?.action === 'ESCALATE'
                    ? 'Push this dispute to higher-level review. The cooperative keeps ownership; an optional note is attached to the record and the audit log.'
                    : 'A short resolution note is required — the customer sees it and the action enters the audit trail.'}
                </DialogDescription>
              </DialogHeader>
              {actionDlg && (
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="flex items-center gap-2">
                    <SevChip severity={actionDlg.complaint.severity} />
                    <p className="truncate text-sm font-semibold">{actionDlg.complaint.subject}</p>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{actionDlg.complaint.detail}</p>
                </div>
              )}
              <Textarea
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder={actionDlg?.action === 'ESCALATE' ? 'Optional escalation note…' : 'Resolution note (required, min 4 characters)…'}
                rows={3}
                aria-label="Committee note"
              />
              <DialogFooter className="gap-2">
                <Button variant="ghost" className="min-h-9" onClick={() => { setActionDlg(null); setActionNote('') }}>Cancel</Button>
                <Button
                  className="min-h-9 gap-1.5"
                  disabled={complaintAction.isPending || (actionDlg?.action === 'RESOLVE' && actionNote.trim().length < 4)}
                  onClick={submitComplaintAction}
                >
                  {complaintAction.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Gavel className="h-4 w-4" />}
                  {actionDlg?.action === 'ESCALATE' ? 'Escalate' : 'Mark resolved'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <div className="flex items-start gap-2 rounded-lg border border-dashed px-3 py-2 text-[11px] text-muted-foreground">
            <ScrollText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>
              Complaint lifecycle is handled by the cooperative committee — audit-logged. Prototype data.
              {' '}Worker-side trust reports continue to be tracked in the Reputation tab.
            </span>
          </div>
        </TabsContent>

        {/* ================= EARNINGS ================= */}
        <TabsContent value="earnings" className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label={t('kpiGrossMonth', lang)} value={inr(d.earnings.month)} tone="success" icon={<Wallet className="h-4 w-4" />} sub={t('allSettlements', lang)} />
            <KpiCard label={t('kpiPaidSettlements', lang)} value={paidJobs.length} sub={t('inRecentWindow', lang)} />
            <KpiCard
              label={t('kpiAvgSettlement', lang)}
              value={inr(paidJobs.length ? Math.round(paidJobs.reduce((s, b) => s + (b.payment?.amount ?? 0), 0) / paidJobs.length) : 0)}
              sub={t('perPaidJob', lang)}
            />
            <KpiCard label={t('kpiActiveDays', lang)} value={d.earnings.byDay.length} sub={t('daysWithSettlements', lang)} />
          </div>

          <SectionCard title={t('dailyFlowTitle', lang)} description={t('dailyFlowDesc', lang)}>
            {d.earnings.byDay.length === 0 ? (
              <EmptyState title={t('noSettlements', lang)} />
            ) : (
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={d.earnings.byDay.map((x) => ({ ...x, label: dayLabel(x.date) }))} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => `₹${v}`} />
                    <RTooltip {...CHART_TIP} formatter={(v) => [inr(Number(v)), t('collected', lang)]} />
                    <Bar dataKey="total" name={t('collected', lang)} fill={AMBER} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>

          <SectionCard title={t('payoutsTitle', lang)} description={t('payoutsDesc', lang)}>
            {d.earnings.workerPayouts.length === 0 ? (
              <EmptyState title={t('noPayouts', lang)} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('jobs', lang)}</TableHead>
                    <TableHead>{t('worker', lang)}</TableHead>
                    <TableHead className="text-right">{t('thWorkerShare', lang)}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.earnings.workerPayouts.map((p, i) => (
                    <TableRow key={`${p.job}-${i}`}>
                      <TableCell className="font-mono text-xs">{p.job}</TableCell>
                      <TableCell className="text-sm">{p.worker ?? '—'}</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{inr(p.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </SectionCard>
        </TabsContent>

        {/* ================= PRICING POLICY ================= */}
        <TabsContent value="pricing" className="space-y-4 pt-2">
          <SectionCard
            title={t('pricingTitle', lang)}
            description={`${t('rateCardSource', lang)}: ${policy.visitBaseByCategory}`}
            actions={<Badge variant="outline" className="gap-1 border-primary/30 bg-accent text-primary"><ScrollText className="h-3 w-3" /> {t('policyPanel', lang)}</Badge>}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('urgencyMultipliers', lang)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                    NORMAL ×{policy.urgencyMultiplier.NORMAL}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                    URGENT ×{policy.urgencyMultiplier.URGENT}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
                    EMERGENCY ×{policy.urgencyMultiplier.EMERGENCY}
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">{t('surgeCapped', lang)}</p>
              </div>

              <div className="space-y-2 rounded-lg border p-3 text-sm">
                <p className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2"><MoonStar className="h-4 w-4 text-primary" /> {t('eveningSurcharge', lang)}</span>
                  <span className="font-bold tabular-nums">+{policy.eveningSurchargePct}%</span>
                </p>
                <Separator />
                <p className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2"><Scale className="h-4 w-4 text-primary" /> {t('negotiationFloor', lang)}</span>
                  <span className="font-bold tabular-nums">{policy.negotiationFloorPct}%</span>
                </p>
                <p className="text-[11px] text-muted-foreground">{t('floorProtects', lang)} {policy.negotiationFloorPct}% {t('floorOfEstimate', lang)}</p>
                {typeof policy.maxQuoteUpliftPct === 'number' && (
                  <p className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-2"><Percent className="h-3.5 w-3.5" /> {t('quoteUpliftCap', lang)}</span>
                    <span className="font-bold tabular-nums">+{policy.maxQuoteUpliftPct}%</span>
                  </p>
                )}
              </div>
            </div>

            <Separator className="my-4" />

            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('where100', lang)}</p>
            <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-muted" role="img" aria-label="Payment split">
              <div className="bg-emerald-500" style={{ width: `${workerSharePct}%` }} />
              <div className="bg-amber-500" style={{ width: `${policy.coopCommissionPct}%` }} />
              <div className="bg-amber-300" style={{ width: `${policy.welfareContributionPct}%` }} />
              <div className="bg-zinc-400" style={{ width: `${policy.platformFeePct}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500" />{t('thWorkerShare', lang)} <span className="font-bold tabular-nums">{workerSharePct}%</span></div>
              <div><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber-500" />{t('coopCommission', lang)} <span className="font-bold tabular-nums">{policy.coopCommissionPct}%</span></div>
              <div><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber-300" />{t('kpiWelfareFund', lang)} <span className="font-bold tabular-nums">{policy.welfareContributionPct}%</span></div>
              <div><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-zinc-400" />{t('platformFee', lang)} <span className="font-bold tabular-nums">{policy.platformFeePct}%</span></div>
            </div>

            <PrototypeNotice className="mt-4">
              Prototype / Designed for Authorized Integration — this panel mirrors the cooperative&apos;s current policy snapshot; live values are synced from the federation rate card at every settlement cycle.
            </PrototypeNotice>
          </SectionCard>

          {/* Fair price range calculator (Task 10) */}
          <SectionCard
            title={t('fpTitle', lang)}
            description={t('fpDesc', lang)}
            actions={<Badge variant="outline" className="gap-1 border-primary/30 bg-accent text-primary"><Calculator className="h-3 w-3" /> {t('fpMinutes', lang)} · ×2.5</Badge>}
          >
            {!fpBreakdown ? (
              <Skeleton className="h-48 rounded-lg" />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {/* Inputs */}
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground" htmlFor="fp-skill">{t('fpSkill', lang)}</label>
                      <Select
                        value={fpCategory?.key ?? fpSkill}
                        onValueChange={(v) => {
                          const cat = catsQ.data?.categories.find((c) => c.key === v)
                          setFpSkill(v)
                          if (cat) setFpMins(cat.avgDurationMin)
                        }}
                      >
                        <SelectTrigger id="fp-skill" className="h-10 w-full" aria-label={t('fpSkill', lang)}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(catsQ.data?.categories ?? []).map((c) => (
                            <SelectItem key={c.key} value={c.key}>{skillLabel(c.key)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground" htmlFor="fp-urgency">{t('fpUrgency', lang)}</label>
                      <Select value={fpUrgency} onValueChange={(v) => setFpUrgency(v as 'NORMAL' | 'URGENT' | 'EMERGENCY')}>
                        <SelectTrigger id="fp-urgency" className="h-10 w-full" aria-label={t('fpUrgency', lang)}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NORMAL">{t('fpUrNormal', lang)}</SelectItem>
                          <SelectItem value="URGENT">{t('fpUrUrgent', lang)}</SelectItem>
                          <SelectItem value="EMERGENCY">{t('fpUrEmergency', lang)}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground" htmlFor="fp-mins">{t('fpMinutes', lang)}</label>
                    <Input
                      id="fp-mins"
                      type="number"
                      inputMode="numeric"
                      min={15}
                      max={600}
                      step={5}
                      className="h-10"
                      value={fpMins}
                      onChange={(e) => setFpMins(e.target.value === '' ? 0 : Number(e.target.value))}
                      aria-label={t('fpMinutes', lang)}
                    />
                    <p className="text-[11px] text-muted-foreground">{t('fpMinutesHint', lang)}</p>
                  </div>

                  <label htmlFor="fp-evening" className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg border p-3 text-sm transition hover:bg-accent/50">
                    <Checkbox id="fp-evening" checked={fpEvening} onCheckedChange={(v) => setFpEvening(v === true)} />
                    <MoonStar className="h-4 w-4 shrink-0 text-primary" />
                    {t('fpEvening', lang)}
                  </label>
                </div>

                {/* Breakdown + range */}
                <div className="space-y-2 rounded-lg border bg-muted/20 p-3 text-sm">
                  <p className="flex items-center justify-between gap-2">
                    <span>{t('fpLabourBase', lang)} <span className="text-xs text-muted-foreground">· {fpBreakdown.estimatedMinutes} min</span></span>
                    <span className="font-semibold tabular-nums">{inr(fpBreakdown.base)}</span>
                  </p>
                  <p className="flex items-center justify-between gap-2 text-muted-foreground">
                    <span>{t('urgencySurcharge', lang)}</span>
                    <span className="tabular-nums">+{inr(fpBreakdown.urgencySurcharge)}</span>
                  </p>
                  <p className="flex items-center justify-between gap-2 text-muted-foreground">
                    <span>{t('eveningSurcharge', lang)}</span>
                    <span className="tabular-nums">+{inr(fpBreakdown.eveningSurcharge)}</span>
                  </p>

                  <Separator />

                  <div className="rounded-lg border border-primary/30 bg-accent/60 p-3 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t('fpRange', lang)}</p>
                    <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-primary">
                      {inr(fpBreakdown.floor)} – {inr(fpBreakdown.ceiling)}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {t('negotiationFloor', lang)} {policy.negotiationFloorPct}% · {t('quoteUpliftCap', lang)} +{policy.maxQuoteUpliftPct ?? 25}%
                    </p>
                  </div>

                  <div className="flex items-start gap-2 rounded-lg border border-dashed px-3 py-2 text-[11px] text-muted-foreground">
                    <Scale className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>{t('fpRangeNote', lang)}</span>
                  </div>

                  <div className="grid gap-1.5 text-[11px] text-muted-foreground">
                    <p className="flex items-start gap-1.5"><HeartHandshake className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> {t('fpWelfareLine', lang)}</p>
                    <p className="flex items-start gap-1.5"><ScrollText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> {t('fpPolicyLine', lang)}</p>
                  </div>
                </div>
              </div>
            )}
          </SectionCard>

          {/* Active matching weights — read-only mirror (Task 9) */}
          <SectionCard
            title={t('fpReadonlyTitle', lang)}
            description={t('fpReadonlyDesc', lang)}
            actions={<Badge variant="outline" className="gap-1 border-primary/30 bg-accent text-primary"><Sparkles className="h-3 w-3" /> {t('aiAssisted', lang)}</Badge>}
          >
            {weightsQ.data ? (
              <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
                {(weightsQ.data.meta ?? [])
                  .filter((m) => (WEIGHT_KEYS as readonly string[]).includes(m.key))
                  .map((m) => {
                    const k = m.key as WeightKey
                    const val = weightsQ.data ? weightsQ.data.weights[k] : 0
                    const lbl = t(`mwF${m.key}`, lang)
                    const label = lbl.startsWith('mwF') ? m.label : lbl
                    return (
                      <div key={m.key}>
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate">{label}</span>
                          <span className="font-bold tabular-nums text-primary">{val}</span>
                        </div>
                        <Progress value={val} className="mt-1 h-1.5" aria-label={`${label}: ${val}`} />
                      </div>
                    )
                  })}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-8 rounded-md" />)}
              </div>
            )}
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <SlidersHorizontal className="h-3 w-3 shrink-0 text-primary" /> {t('mwConfiguredBy', lang)}
            </p>
          </SectionCard>
        </TabsContent>

        {/* ================= PROCUREMENT (#37, Phase 5) ================= */}
        <TabsContent value="procurement" className="space-y-4 pt-2">
          <CoopProcurement />
        </TabsContent>

        {/* ================= ECONOMICS (#40, Phase 5) ================= */}
        <TabsContent value="economics" className="space-y-4 pt-2">
          <CoopEconomics user={user} />
        </TabsContent>

        {/* ================= EMERGENCY POOL ================= */}
        <TabsContent value="pool" className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <KpiCard label={t('kpiPoolSize', lang)} value={coop.emergencyPoolSize} tone="danger" icon={<Siren className="h-4 w-4" />} sub={t('rosteredDispatch', lang)} />
            <KpiCard label={t('onDigitalPlatform', lang)} value={poolRecords} sub={t('poolRecordsHere', lang)} />
          </div>

          {/* Reserve capacity summary (Task 17) */}
          <div className="grid grid-cols-3 gap-3">
            <KpiCard label={t('rpKpiReserve', lang)} value={poolTotals.total} tone="danger" icon={<Siren className="h-4 w-4" />} />
            <KpiCard label={t('rpKpiAvailable', lang)} value={poolTotals.available} tone="success" icon={<Activity className="h-4 w-4" />} />
            <KpiCard label={t('rpKpiDispatched', lang)} value={poolTotals.dispatched} tone="warning" icon={<ClipboardList className="h-4 w-4" />} />
          </div>

          {/* Reserve capacity by skill (Task 17) */}
          <SectionCard title={t('rpTitle', lang)} description={t('rpDesc', lang)}>
            {poolRows.length === 0 ? (
              <EmptyState icon={<Siren className="h-10 w-10" />} title={t('rpNoPoolTitle', lang)} body={t('rpNoPoolBody', lang)} />
            ) : (
              <div className="space-y-2">
                {poolRows.map((row) => {
                  const idle = Math.max(0, row.total - row.available - row.dispatched)
                  return (
                    <div key={row.skill} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold">{skillLabel(row.skill)}</p>
                        <Badge variant="outline" className="tabular-nums border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                          {row.total} {t('rpReserveWord', lang)}
                        </Badge>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-md border bg-emerald-50 p-1.5 dark:bg-emerald-950/40">
                          <p className="text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-300">{row.available}</p>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('rpAvailable', lang)}</p>
                        </div>
                        <div className="rounded-md border bg-amber-50 p-1.5 dark:bg-amber-950/40">
                          <p className="text-base font-bold tabular-nums text-amber-700 dark:text-amber-300">{row.dispatched}</p>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('rpDispatched', lang)}</p>
                        </div>
                        <div className="rounded-md border p-1.5">
                          <p className="text-base font-bold tabular-nums">{row.total}</p>
                          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('rpReserveWord', lang)}</p>
                        </div>
                      </div>
                      <div
                        className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-muted"
                        role="img"
                        aria-label={t('rpBarAria', lang).replace('{a}', String(row.available)).replace('{d}', String(row.dispatched)).replace('{t}', String(row.total))}
                      >
                        <div className="bg-emerald-500" style={{ width: segWidth(row.available, row.total) }} />
                        <div className="bg-amber-500" style={{ width: segWidth(row.dispatched, row.total) }} />
                        <div className="bg-zinc-400" style={{ width: segWidth(idle, row.total) }} />
                      </div>
                    </div>
                  )
                })}
                <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" /> {t('rpAvailable', lang)}</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" /> {t('rpDispatched', lang)}</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-zinc-400" /> {t('rpIdle', lang)}</span>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title={t('protocolTitle', lang)} description={t('protocolDesc', lang)}>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li className="flex gap-2"><Zap className="mt-0.5 h-4 w-4 shrink-0 text-red-500" /> {t('protocol1', lang)}</li>
              <li className="flex gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {t('protocol2', lang)}</li>
              <li className="flex gap-2"><Scale className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {t('protocol3', lang)}{policy.urgencyMultiplier.EMERGENCY}{t('protocol3Tail', lang)}</li>
              <li className="flex gap-2"><Users className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {t('protocol4', lang)}</li>
            </ul>
          </SectionCard>

          <SectionCard title={t('poolRoster', lang)} description={t('poolRosterDesc', lang)}>
            {d.emergencyPool.length === 0 ? (
              <EmptyState icon={<Siren className="h-10 w-10" />} title={t('noPoolTitle', lang)} body={t('noPoolBody', lang)} />
            ) : (
              <div className={SCROLL}>
                {d.emergencyPool.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <AvatarInitials name={p.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{p.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{skillLabel(p.skill)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <RatingStars value={p.rating} />
                      <div className="mt-1 flex justify-end"><AvailLabel availability={p.availability} /></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </TabsContent>

        {/* ================= ANALYTICS ================= */}
        <TabsContent value="analytics" className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              label={t('kpiUtilisation', lang)} value={`${d.analytics.utilization}%`} tone={d.analytics.utilization > 75 ? 'warning' : 'success'}
              icon={<Gauge className="h-4 w-4" />} sub={t('kpiUtilSub2', lang)}
            />
            <KpiCard label={t('kpiJobsToday', lang)} value={d.analytics.jobsToday} tone="primary" icon={<ClipboardList className="h-4 w-4" />} />
            <KpiCard label={t('kpiActiveToday', lang)} value={d.analytics.activeToday} tone="success" icon={<Activity className="h-4 w-4" />} />
            <KpiCard label={t('kpiDigitalRecords', lang)} value={workers.length} sub={`${coop.workerCount} ${t('onCoopRolls', lang)}`} icon={<Users className="h-4 w-4" />} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard title={t('statusMixTitle', lang)} description={t('statusMixDesc', lang)}>
              <div className="h-[210px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={d.analytics.statusMix.filter((x) => x.count > 0)}
                      dataKey="count" nameKey="status" innerRadius={48} outerRadius={76} paddingAngle={2} strokeWidth={0}
                    >
                      {d.analytics.statusMix.filter((x) => x.count > 0).map((x) => (
                        <Cell key={x.status} fill={x.status === 'Completed' ? EMERALD : x.status === 'In flight' ? AMBER : x.status === 'Cancelled' ? ZINC : ORANGE} />
                      ))}
                    </Pie>
                    <RTooltip {...CHART_TIP} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
                  {d.analytics.statusMix.map((x) => (
                    <span key={x.status} className="flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: x.status === 'Completed' ? EMERALD : x.status === 'In flight' ? AMBER : x.status === 'Cancelled' ? ZINC : ORANGE }}
                      />
                      {x.status} · {x.count}
                    </span>
                  ))}
                </div>
              </div>
            </SectionCard>

            <SectionCard title={t('utilDemandTitle', lang)} description={t('utilDemandDesc', lang)}>
              <UtilGauge value={d.analytics.utilization} />
              {d.analytics.demandMix.length > 0 && (
                <div className="mt-2" style={{ height: Math.max(120, d.analytics.demandMix.length * 52) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={d.analytics.demandMix} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
                      <XAxis type="number" allowDecimals={false} hide />
                      <YAxis type="category" dataKey="skill" width={92} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                      <RTooltip {...CHART_TIP} />
                      <Bar dataKey="count" name="Records" fill={AMBER} radius={[0, 4, 4, 0]} barSize={10} />
                      <Bar dataKey="available" name="Available" fill={EMERALD} radius={[0, 4, 4, 0]} barSize={10} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </SectionCard>
          </div>

          <SectionCard
            title={t('insightsTitle', lang)}
            description={t('insightsDesc', lang)}
            actions={<Badge variant="outline" className="gap-1 border-primary/30 bg-accent text-primary"><Sparkles className="h-3 w-3" /> {t('aiAssisted', lang)}</Badge>}
          >
            <ul className="space-y-2">
              {insights.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /> {s}
                </li>
              ))}
            </ul>
          </SectionCard>

          {d.exchange.length > 0 && (
            <SectionCard title={t('exchangeTitle', lang)} description={t('exchangeDesc', lang)}>
              <div className={SCROLL}>
                {d.exchange.map((e) => {
                  const inbound = e.toCoopId === coop.id
                  return (
                    <div key={e.id} className="rounded-lg border p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                          <ArrowLeftRight className={cn('h-4 w-4 shrink-0', inbound ? 'text-emerald-600' : 'text-primary')} />
                          {inbound ? t('inbound', lang) : t('outbound', lang)} · {e.workerCount} {skillLabel(e.skill)}{lang === 'en' && e.workerCount > 1 ? 's' : ''}
                        </p>
                        <span className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold',
                          e.status === 'APPROVED'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300'
                        )}>
                          {e.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {inbound ? `${t('fromWord', lang)} ${e.fromCoopName}` : `${t('toWord', lang)} ${e.toCoopName}`} · {e.districtName} · {e.distanceKm} km · {e.durationDays} days · {t('expectedDemand', lang)} {e.expectedDemand}
                      </p>
                      <p className="mt-1 text-xs italic text-muted-foreground">“{e.rationale}”{e.approvedBy ? ` — ${e.approvedBy}` : ''}</p>
                    </div>
                  )
                })}
              </div>
            </SectionCard>
          )}
        </TabsContent>
      </Tabs>

      {/* ---------- Worker profile dialog ---------- */}
      <Dialog open={Boolean(selectedWorker)} onOpenChange={(open) => { if (!open) setSelectedWorkerId(null) }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {selectedWorker && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <AvatarInitials name={selectedWorker.name} className="h-12 w-12 text-sm" />
                  <div className="min-w-0">
                    <DialogTitle className="flex items-center gap-1.5 text-left">
                      {selectedWorker.name}
                      {selectedWorker.emergencyPool && <Star className="h-4 w-4 fill-amber-500 text-amber-500" />}
                    </DialogTitle>
                    <DialogDescription className="text-left">
                      {skillLabel(selectedWorker.primarySkill)} · {selectedWorker.experienceYears} yrs experience · <AvailDot availability={selectedWorker.availability} /> {selectedWorker.availability.toLowerCase()}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <div className="rounded-lg border p-2.5"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('ratings', lang)}</p><RatingStars value={selectedWorker.rating} className="mt-0.5" /></div>
                  <div className="rounded-lg border p-2.5"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('completedJobsLabel', lang)}</p><p className="mt-0.5 font-bold tabular-nums">{selectedWorker.completedJobs}</p></div>
                  <div className="rounded-lg border p-2.5"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('completionRate', lang)}</p><p className="mt-0.5 font-bold tabular-nums">{selectedWorker.completionRate}%</p></div>
                  <div className="rounded-lg border p-2.5"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('kpiActiveToday', lang)}</p><p className="mt-0.5 font-bold tabular-nums">{selectedWorker.activeJobsToday}</p></div>
                  <div className="rounded-lg border p-2.5"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('dialogEarningsMonth', lang)}</p><p className="mt-0.5 font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{inr(selectedWorker.earningsMonthRs)}</p></div>
                  <div className="rounded-lg border p-2.5"><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{t('dialogWelfareBalance', lang)}</p><p className="mt-0.5 font-bold tabular-nums text-primary">{inr(selectedWorker.welfareBalanceRs)}</p></div>
                </div>

                <div>
                  <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><Wrench className="h-3.5 w-3.5" /> {t('skillPassport', lang)}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedWorker.skills.map((s) => (
                      <Badge key={s} variant="secondary" className="text-[11px]">{skillLabel(s)}</Badge>
                    ))}
                    {selectedWorker.secondarySkills.map((s) => (
                      <Badge key={s} variant="outline" className="text-[11px] font-normal text-muted-foreground">+ {skillLabel(s)}</Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <p className="flex items-center gap-2"><Languages className="h-3.5 w-3.5 text-primary" /> {selectedWorker.languages.join(' · ')}</p>
                  <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 text-primary" /> {t('baseWord', lang)} {selectedWorker.baseArea} · {t('servesWord', lang)} {selectedWorker.serviceAreas.join(', ')}</p>
                  <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 text-primary" /> {selectedWorker.phone}</p>
                  <p className="flex items-center gap-2"><GraduationCap className="h-3.5 w-3.5 text-primary" /> {selectedWorker.trainingsDone} {t('coopTrainingsDone', lang)}</p>
                  <p className="flex items-center gap-2">
                    {selectedWorker.safetyValid
                      ? <><ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> <span className="text-emerald-700 dark:text-emerald-400">{t('safetyValid', lang)}</span></>
                      : <><FileWarning className="h-3.5 w-3.5 text-amber-600" /> <span className="text-amber-700 dark:text-amber-400">{t('safetyRenew', lang)}</span></>}
                  </p>
                </div>

                <Separator />

                <div className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold">{selectedWorker.certName}</p>
                    <CertBadge status={selectedWorker.certStatus} />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{t('validTill', lang)} {fmtDate(selectedWorker.certExpiry)}</p>
                </div>

                <p className="border-l-2 border-accent pl-3 text-xs italic text-muted-foreground">“{selectedWorker.bioEn}”</p>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
