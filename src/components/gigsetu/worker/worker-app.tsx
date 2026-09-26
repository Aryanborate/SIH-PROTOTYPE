'use client'

// WORKER APP — GigSetu cooperative worker experience
// Tabs: Home · Jobs · Skill Passport · Earnings · Welfare · Training · Ratings

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, inr, timeAgo } from '@/lib/api-client'
import { t } from '@/lib/i18n'
import { useAppStore } from '@/store/app-store'
import { KpiCard, SectionCard, AvailDot, EmptyState } from '../shared/ui-kit'
import { JobActionCard, isActiveJob, useJobActions } from './job-card'
import { SkillPassport } from './skill-passport'
import { VerificationCard } from './verification-card'
import { JobsSection, EarningsSection, WelfareSection, TrainingSection, RatingsSection, LoadingBlock, LoadError } from './worker-sections'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Availability, BookingDTO, DemoUser, NotificationDTO, WorkerDTO } from '@/lib/types'
import { cn } from '@/lib/utils'
import {
  BadgeCheck, Bell, Briefcase, Building2, CalendarCheck, CheckCircle2, GraduationCap, HeartPulse,
  Home as HomeIcon, IndianRupee, Info, Loader2, MapPin, Phone, ShieldCheck, Siren, Star as StarIcon,
  TrendingUp, Wallet,
} from 'lucide-react'

interface HomeData {
  ok: boolean
  worker: WorkerDTO
  cooperative: { id: string; name: string; sector: string }
  todayJobs: BookingDTO[]
  todayEarnings: number
  weekEarnings: number
  notifications: NotificationDTO[]
  stats: { completedJobs: number; rating: number; completionRate: number; monthEarnings: number; welfare: number }
}

function dayPart(): 'morning' | 'afternoon' | 'evening' {
  const h = new Date().getHours()
  if (h < 12) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

const AVAIL_OPTIONS: Array<{ value: Availability; label: string; sub: string; dot: string; activeCls: string }> = [
  { value: 'AVAILABLE', label: 'Available', sub: 'Accepting jobs', dot: 'bg-emerald-500', activeCls: 'border-emerald-500 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-950/40' },
  { value: 'BUSY', label: 'Busy', sub: 'On a job', dot: 'bg-amber-500', activeCls: 'border-amber-500 bg-amber-50 dark:border-amber-400 dark:bg-amber-950/40' },
  { value: 'OFFLINE', label: 'Offline', sub: 'Off duty', dot: 'bg-zinc-400', activeCls: 'border-zinc-400 bg-muted' },
]

// ============================================================
// HOME TAB
// ============================================================

function StatusRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <span className="mt-0.5 text-primary">{icon}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function NotificationRow({ n }: { n: NotificationDTO }) {
  const Icon = n.type === 'SUCCESS' ? CheckCircle2 : n.type === 'WARNING' || n.type === 'EMERGENCY' ? Bell : Info
  const color = n.type === 'SUCCESS' ? 'text-emerald-500' : n.type === 'WARNING' || n.type === 'EMERGENCY' ? 'text-amber-500' : 'text-muted-foreground'
  return (
    <div className="flex gap-2.5 border-b py-2.5 last:border-0">
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', color)} />
      <div className="min-w-0">
        <p className="text-xs font-semibold leading-snug">{n.title}</p>
        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
        <p className="mt-1 text-[10px] text-muted-foreground/70">{timeAgo(n.createdAt)}</p>
      </div>
    </div>
  )
}

function HomeTab({ user, home }: { user: DemoUser; home: HomeData }) {
  const wid = user.workerId ?? ''
  const qc = useQueryClient()
  const actions = useJobActions(wid)
  const homeKey = ['worker-home', wid] as const
  const { worker, cooperative, stats } = home

  // Optimistic availability toggle
  const availMut = useMutation({
    mutationFn: (v: Availability) => api.patch<{ ok: boolean }>('/api/worker', { id: wid, action: 'availability', value: v }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: homeKey })
      const prev = qc.getQueryData<HomeData>(homeKey)
      qc.setQueryData<HomeData>(homeKey, (old) => (old ? { ...old, worker: { ...old.worker, availability: v } } : old))
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(homeKey, ctx.prev)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: homeKey })
    },
  })

  const todayActive = home.todayJobs.filter(isActiveJob)
  const todayDone = home.todayJobs.filter((b) => !isActiveJob(b))
  const firstName = user.name.split(' ')[0]

  return (
    <div className="space-y-4">
      {/* Greeting banner */}
      <div className="rounded-2xl bg-gradient-to-br from-primary to-amber-500 p-5 text-primary-foreground shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-widest opacity-90">
              Good {dayPart()} · {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h2 className="mt-1 text-xl font-bold leading-snug sm:text-2xl">Namaskar, {firstName} 👋</h2>
            <p className="mt-1 truncate text-sm capitalize opacity-90">{worker.primarySkill} · {cooperative.name}</p>
            {worker.emergencyPool && (
              <Badge className="mt-2.5 border-white/30 bg-white/15 text-[10px] font-semibold text-primary-foreground" variant="outline">
                <Siren className="mr-1 h-3 w-3" /> Emergency pool member — priority dispatch
              </Badge>
            )}
          </div>
          <div className="shrink-0 rounded-xl bg-primary-foreground/15 px-3 py-2 text-right backdrop-blur">
            <p className="text-[10px] uppercase tracking-wide opacity-90">Rating</p>
            <p className="text-lg font-bold tabular-nums">{stats.rating.toFixed(2)} <span className="text-sm">★</span></p>
            <p className="text-[10px] opacity-90 tabular-nums">{stats.completionRate}% completion</p>
          </div>
        </div>
      </div>

      {/* Transparent verification (#44) — same auditable 5 checks coops see */}
      <VerificationCard worker={worker} coopName={cooperative.name} />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Today's jobs" value={home.todayJobs.length} icon={<CalendarCheck className="h-4 w-4" />} sub={`${worker.activeJobsToday} active now`} />
        <KpiCard label="Today's earnings" value={inr(home.todayEarnings)} tone="success" icon={<IndianRupee className="h-4 w-4" />} sub="Net worker share" />
        <KpiCard label="This week" value={inr(home.weekEarnings)} icon={<Wallet className="h-4 w-4" />} />
        <KpiCard label="This month" value={inr(stats.monthEarnings)} tone="primary" icon={<TrendingUp className="h-4 w-4" />} sub={`Welfare wallet ${inr(stats.welfare)}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: availability + today's jobs */}
        <div className="space-y-4 lg:col-span-2">
          <SectionCard
            title="Your availability"
            description="Cooperative dispatch sends jobs based on this status — set it before you start or end work"
            actions={<span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"><AvailDot availability={worker.availability} /> {worker.availability}</span>}
          >
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Set availability">
              {AVAIL_OPTIONS.map((o) => {
                const selected = worker.availability === o.value
                return (
                  <button
                    key={o.value}
                    aria-pressed={selected}
                    disabled={availMut.isPending}
                    onClick={() => availMut.mutate(o.value)}
                    className={cn(
                      'flex min-h-[64px] flex-col items-start justify-center gap-0.5 rounded-xl border-2 bg-card p-3 text-left transition hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-70',
                      selected ? o.activeCls : 'border-border',
                    )}
                  >
                    <span className="flex items-center gap-1.5 text-sm font-semibold">
                      {selected && availMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className={cn('inline-block h-2 w-2 rounded-full', o.dot)} />}
                      {o.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{o.sub}</span>
                  </button>
                )
              })}
            </div>
          </SectionCard>

          <SectionCard
            title={`Today's jobs (${home.todayJobs.length})`}
            description="Accept and advance your jobs — customers see each update live"
          >
            {home.todayJobs.length === 0 ? (
              <EmptyState
                icon={<CalendarCheck className="h-8 w-8" />}
                title="No jobs scheduled today"
                body="Stay AVAILABLE — the cooperative matcher assigns jobs automatically through the day."
              />
            ) : (
              <div className="space-y-3">
                {todayActive.map((b) => <JobActionCard key={b.id} b={b} actions={actions} />)}
                {todayDone.map((b) => <JobActionCard key={b.id} b={b} actions={actions} />)}
              </div>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              ⏱ Demo note: in this prototype job status also advances automatically (time-accelerated simulation) — your manual updates apply instantly.
            </p>
          </SectionCard>
        </div>

        {/* Right: status + notifications */}
        <div className="space-y-4">
          <SectionCard title="Current status" description="Live on the GigSetu cooperative network">
            <div className="space-y-2.5">
              <StatusRow icon={<AvailDot availability={worker.availability} />}>
                <span className="font-medium">{worker.availability.charAt(0) + worker.availability.slice(1).toLowerCase()}</span>
                <span className="text-muted-foreground"> · {worker.activeJobsToday} active job{worker.activeJobsToday === 1 ? '' : 's'} today</span>
              </StatusRow>
              <StatusRow icon={<Building2 className="h-4 w-4" />}>
                <span className="block truncate font-medium">{cooperative.name}</span>
                <span className="text-xs capitalize text-muted-foreground">{cooperative.sector} cooperative</span>
              </StatusRow>
              {worker.emergencyPool && (
                <StatusRow icon={<Siren className="h-4 w-4" />}>
                  <span className="text-xs font-medium">Emergency pool member — priority dispatch with +2% bonus per emergency job</span>
                </StatusRow>
              )}
              <StatusRow icon={<ShieldCheck className="h-4 w-4" />}>
                <span className={cn('text-sm', worker.safetyValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive')}>
                  Safety training {worker.safetyValid ? 'valid' : 'lapsed'}
                </span>
              </StatusRow>
              <StatusRow icon={<MapPin className="h-4 w-4" />}>
                <span className="text-sm">{worker.baseArea} <span className="text-xs text-muted-foreground">· base area</span></span>
              </StatusRow>
              <StatusRow icon={<Phone className="h-4 w-4" />}>
                <span className="text-sm tabular-nums">{worker.phone}</span>
              </StatusRow>
            </div>
          </SectionCard>

          <SectionCard title="Notifications" description="Dispatch alerts, welfare and network updates">
            {home.notifications.length === 0 ? (
              <EmptyState title="No notifications" />
            ) : (
              <div className="max-h-72 overflow-y-auto pr-1 [scrollbar-width:thin]">
                {home.notifications.map((n) => <NotificationRow key={n.id} n={n} />)}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// PASSPORT TAB (data fetch + showcase component)
// ============================================================

function PassportTab({ user }: { user: DemoUser }) {
  const wid = user.workerId ?? ''
  const q = useQuery({
    queryKey: ['worker-passport', wid],
    queryFn: () => api.get<{ ok: boolean; worker: WorkerDTO; cooperative: { name: string; regNo: string }; portable: { note: string; portableFields: string[] } }>(`/api/worker?id=${wid}&section=passport`),
    enabled: !!wid,
  })
  if (q.isLoading) return <LoadingBlock />
  if (q.isError || !q.data) return <LoadError onRetry={() => void q.refetch()} />
  return <SkillPassport worker={q.data.worker} cooperative={q.data.cooperative} portable={q.data.portable} />
}

// ============================================================
// APP SHELL
// ============================================================

export function WorkerApp({ user }: { user: DemoUser }) {
  const lang = useAppStore((s) => s.lang)
  const wid = user.workerId ?? ''
  const [tab, setTab] = useState('home')
  // Notification deep-link: forced tab wins over local state until the user navigates manually
  const forcedTab = useAppStore((s) => s.focusWorkerTab)
  const clearFocusWorkerTab = useAppStore((s) => s.clearFocusWorkerTab)
  const homeQ = useQuery({
    queryKey: ['worker-home', wid],
    queryFn: () => api.get<HomeData>(`/api/worker?id=${wid}&section=home`),
    enabled: !!wid,
    refetchInterval: 6000, // live auto-progression of jobs (time-accelerated demo)
  })

  if (!wid) {
    return <EmptyState title="No worker profile linked" body="This demo login is not linked to a worker record. Switch to the Worker role from the header." />
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Tabs
        value={forcedTab ?? tab}
        onValueChange={(v) => {
          setTab(v)
          if (forcedTab) clearFocusWorkerTab()
        }}
      >
        <TabsList className="grid h-auto w-full grid-cols-4 gap-1 py-1 sm:grid-cols-7">
          <TabsTrigger value="home" className="gap-1.5 text-xs"><HomeIcon className="h-3.5 w-3.5" /> {t('home', lang)}</TabsTrigger>
          <TabsTrigger value="jobs" className="gap-1.5 text-xs"><Briefcase className="h-3.5 w-3.5" /> {t('jobs', lang)}</TabsTrigger>
          <TabsTrigger value="passport" className="gap-1.5 text-xs"><BadgeCheck className="h-3.5 w-3.5" /> {t('skillPassport', lang)}</TabsTrigger>
          <TabsTrigger value="earnings" className="gap-1.5 text-xs"><Wallet className="h-3.5 w-3.5" /> {t('earnings', lang)}</TabsTrigger>
          <TabsTrigger value="welfare" className="gap-1.5 text-xs"><HeartPulse className="h-3.5 w-3.5" /> {t('welfare', lang)}</TabsTrigger>
          <TabsTrigger value="training" className="gap-1.5 text-xs"><GraduationCap className="h-3.5 w-3.5" /> {t('training', lang)}</TabsTrigger>
          <TabsTrigger value="ratings" className="gap-1.5 text-xs"><StarIcon className="h-3.5 w-3.5" /> {t('ratings', lang)}</TabsTrigger>
        </TabsList>

        <TabsContent value="home" className="pt-2">
          {homeQ.isLoading ? <LoadingBlock /> : homeQ.isError || !homeQ.data ? <LoadError onRetry={() => void homeQ.refetch()} /> : <HomeTab user={user} home={homeQ.data} />}
        </TabsContent>

        <TabsContent value="jobs" className="pt-2">
          <JobsSection user={user} />
        </TabsContent>

        <TabsContent value="passport" className="pt-2">
          <PassportTab user={user} />
        </TabsContent>

        <TabsContent value="earnings" className="pt-2">
          <EarningsSection user={user} />
        </TabsContent>

        <TabsContent value="welfare" className="pt-2">
          <WelfareSection user={user} />
        </TabsContent>

        <TabsContent value="training" className="pt-2">
          <TrainingSection user={user} />
        </TabsContent>

        <TabsContent value="ratings" className="pt-2">
          <RatingsSection user={user} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
