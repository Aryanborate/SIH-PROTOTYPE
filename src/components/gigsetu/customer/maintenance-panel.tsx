'use client'

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, inr } from '@/lib/api-client'
import { t } from '@/lib/i18n'
import { useAppStore } from '@/store/app-store'
import { cn } from '@/lib/utils'
import { SectionCard, EmptyState } from '../shared/ui-kit'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import type { MaintenanceProfile, MaintenanceSignal } from '@/lib/types'
import {
  ClipboardCheck, TrendingUp, TrendingDown, Minus, CalendarClock, RefreshCw, Building2, Wrench,
} from 'lucide-react'

/** Health gauge — SVG ring, amber when the score drops below 75. */
function HealthGauge({ score }: { score: number }) {
  const langKey = useAppStore((s) => s.lang)
  const r = 30
  const c = 2 * Math.PI * r
  const filled = (Math.max(0, Math.min(100, score)) / 100) * c
  const ring = score >= 75 ? 'stroke-emerald-500' : 'stroke-amber-500'
  return (
    <div className="relative h-20 w-20 shrink-0" role="img" aria-label={`${t('pmHealth', langKey)}: ${score}/100`}>
      <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90" aria-hidden>
        <circle cx="40" cy="40" r={r} className="fill-none stroke-zinc-200 dark:stroke-zinc-800" strokeWidth="8" />
        <circle cx="40" cy="40" r={r} className={cn('fill-none transition-all', ring)} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${filled} ${c}`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold tabular-nums leading-none">{score}</span>
        <span className="text-[9px] text-muted-foreground">/100</span>
      </div>
    </div>
  )
}

const TREND_META: Record<MaintenanceSignal['trend'], { Icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  up: { Icon: TrendingUp, cls: 'text-red-500 dark:text-red-400' },
  down: { Icon: TrendingDown, cls: 'text-emerald-600 dark:text-emerald-400' },
  flat: { Icon: Minus, cls: 'text-muted-foreground' },
  warn: { Icon: TrendingUp, cls: 'text-amber-600 dark:text-amber-400' },
}

const SEV_CHIP: Record<string, string> = {
  HIGH: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300',
  MEDIUM: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
  LOW: 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400',
}

function ProfileCard({ profile }: { profile: MaintenanceProfile }) {
  const { toast } = useToast()
  const langKey = useAppStore((s) => s.lang)
  const customerId = useAppStore((s) => s.user?.customerId)
  const qc = useQueryClient()
  const [scheduled, setScheduled] = useState<string[]>([])

  /**
   * FIX: "Schedule maintenance" used to raise a toast and change nothing — a
   * primary action with no effect, which spec §84 forbids. It now files a real
   * institutional maintenance request (spec §31) that lands in the contract /
   * work-order list and is audit-logged.
   */
  const schedule = useMutation({
    mutationFn: async (rec: MaintenanceProfile['recommendations'][number]) => {
      if (!customerId) throw new Error('Sign in as an institution to schedule preventive maintenance.')
      const due = new Date(Date.now() + 7 * 86400000)
      due.setHours(10, 0, 0, 0)
      return api.post<{ ok: boolean; request: { id: string } }>('/api/institution', {
        customerId,
        type: 'MAINTENANCE',
        categoryKey: rec.categoryKey ?? 'technician',
        title: rec.title,
        detail: `${rec.detail} Action: ${rec.action}. Suggested window: ${rec.suggestedWindow}.`,
        area: profile.area,
        headcount: 1,
        scheduledAt: due.toISOString(),
      })
    },
    onSuccess: (_d, rec) => {
      setScheduled((s) => (s.includes(rec.id) ? s : [...s, rec.id]))
      void qc.invalidateQueries({ queryKey: ['institution-portal'] })
      toast({
        title: t('pmSchedule', langKey),
        description: `${rec.title} — work order created and added to the maintenance schedule for ${profile.name}.`,
      })
    },
    onError: (e) => toast({ title: t('pmSchedule', langKey), description: (e as Error).message, variant: 'destructive' }),
  })
  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-primary"><Building2 className="h-4 w-4" /></span>
          {profile.name}
        </span>
      }
      description={`${profile.type} · ${profile.area} · ${profile.units} units`}
      actions={<HealthGauge score={profile.healthScore} />}
    >
      <div className="space-y-4">
        {/* condition signals */}
        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t('pmSignals', langKey)}</p>
          <div className="overflow-hidden rounded-lg border">
            {profile.signals.map((sig, i) => {
              const { Icon, cls } = TREND_META[sig.trend] ?? TREND_META.flat
              return (
                <div key={sig.key} className={cn('flex items-center justify-between gap-3 px-3 py-2', i > 0 && 'border-t')}>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{sig.label}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{sig.note}</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 text-xs font-bold tabular-nums">
                    <Icon className={cn('h-3.5 w-3.5', cls)} />
                    {sig.value}
                  </span>
                </div>
              )
            })}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {t('pmLastInspection', langKey)}: {t('pmMonthsAgo', langKey).replace('{n}', String(profile.lastInspectionMonthsAgo))}
          </p>
        </div>

        {/* preventive recommendations */}
        <div>
          <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">{t('pmRecommendations', langKey)}</p>
          {profile.recommendations.length === 0 ? (
            <p className="rounded-lg border border-dashed px-3 py-3 text-xs text-muted-foreground">{t('pmNoRecs', langKey)}</p>
          ) : (
            <div className="space-y-2">
              {profile.recommendations.map((rec) => (
                <div key={rec.id} className="rounded-lg border p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide', SEV_CHIP[rec.severity] ?? SEV_CHIP.LOW)}>
                      {rec.severity}
                    </span>
                    <p className="text-sm font-bold">{rec.title}</p>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{rec.detail}</p>
                  <p className="mt-1 text-xs"><span className="font-semibold">{rec.action}</span></p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-dashed pt-2">
                    <div className="text-[11px] text-muted-foreground">
                      <p className="flex items-center gap-1"><CalendarClock className="h-3 w-3" /> {t('pmWindow', langKey)}: {rec.suggestedWindow}</p>
                      <p className="mt-0.5">{t('pmCost', langKey)}: <span className="font-bold text-foreground">{inr(rec.estCostRange?.[0] ?? 0)} – {inr(rec.estCostRange?.[1] ?? 0)}</span></p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 shrink-0 gap-1.5 text-xs"
                      disabled={schedule.isPending || scheduled.includes(rec.id)}
                      onClick={() => schedule.mutate(rec)}
                    >
                      {scheduled.includes(rec.id) ? <ClipboardCheck className="h-3.5 w-3.5" /> : <Wrench className="h-3.5 w-3.5" />}
                      {scheduled.includes(rec.id) ? t('pmScheduled', langKey) : t('pmSchedule', langKey)}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="border-t border-dashed pt-2 text-[10px] leading-snug text-muted-foreground/80">{profile.disclaimer}</p>
      </div>
    </SectionCard>
  )
}

/** Preventive Maintenance intelligence (Task 31) — institution-only tab. Mock module, real API shape. */
export function MaintenancePanel() {
  const langKey = useAppStore((s) => s.lang)
  const q = useQuery({
    queryKey: ['maintenance'],
    queryFn: () => api.get<{ ok: boolean; profiles: MaintenanceProfile[] }>('/api/ai/maintenance'),
    staleTime: 60000,
  })

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-primary/30 bg-accent px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-bold"><ClipboardCheck className="h-4 w-4 text-primary" /> {t('pmTitle', langKey)}</p>
        <p className="text-xs text-muted-foreground">{t('pmSubtitle', langKey)}</p>
      </div>

      {q.isLoading && (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-6 w-64" />
          <Skeleton className="h-56 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
      )}

      {q.isError && (
        <EmptyState
          icon={<ClipboardCheck className="h-8 w-8" />}
          title={t('pmFailed', langKey)}
          action={(
            <Button variant="outline" size="sm" className="mt-1 gap-1.5" onClick={() => q.refetch()}>
              <RefreshCw className={cn('h-3.5 w-3.5', q.isFetching && 'animate-spin')} /> {t('escRetry', langKey)}
            </Button>
          )}
        />
      )}

      {q.data &&
        (q.data.profiles?.length ? (
          q.data.profiles.map((p) => <ProfileCard key={p.id} profile={p} />)
        ) : (
          <EmptyState
            icon={<ClipboardCheck className="h-8 w-8" />}
            title={t('pmNoProfiles', langKey)}
            body={t('pmNoProfilesBody', langKey)}
          />
        ))}
    </div>
  )
}
