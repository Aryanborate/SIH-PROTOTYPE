'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { t } from '@/lib/i18n'
import { useAppStore } from '@/store/app-store'
import { cn } from '@/lib/utils'
import { EmptyState } from '../shared/ui-kit'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import type { EmergencyEscalationResponse } from '@/lib/types'
import { Users, Siren, ShieldAlert, Globe, RefreshCw, Star, Clock3, MapPin } from 'lucide-react'

/** Per-level semantic icons: local coop → taluka → district → federation pool. */
const LEVEL_ICONS = [Users, Siren, ShieldAlert, Globe]

/**
 * Emergency escalation ladder (Task 16) — visualises how an SOS cascades
 * cooperative → taluka → district → federation, and where dispatch actually happened.
 * Data: POST /api/ai/emergency { categoryKey, area }.
 */
export function EmergencyEscalationPanel({ categoryKey, area, compact }: {
  categoryKey: string
  area: string
  compact?: boolean
}) {
  const lang = useAppStore((s) => s.lang)
  const q = useQuery({
    queryKey: ['emergency', categoryKey, area],
    queryFn: () => api.post<EmergencyEscalationResponse>('/api/ai/emergency', { categoryKey, area }),
    staleTime: 30000,
  })

  if (q.isLoading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label={t('escTitle', lang)}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <Skeleton className={cn('flex-1', compact ? 'h-10' : 'h-14')} />
          </div>
        ))}
      </div>
    )
  }

  if (q.isError || !q.data?.ladder?.length) {
    return (
      <EmptyState
        icon={<Siren className="h-8 w-8" />}
        title={t('escFailed', lang)}
        body={t('escSubtitle', lang)}
        action={(
          <Button variant="outline" size="sm" className="mt-1 gap-1.5" onClick={() => q.refetch()}>
            <RefreshCw className={cn('h-3.5 w-3.5', q.isFetching && 'animate-spin')} /> {t('escRetry', lang)}
          </Button>
        )}
      />
    )
  }

  const data = q.data

  return (
    <div className="space-y-1">
      {!compact && (
        <div className="mb-2">
          <p className="text-sm font-bold">{t('escTitle', lang)}</p>
          <p className="text-[11px] text-muted-foreground">{t('escSubtitle', lang)}</p>
        </div>
      )}

      <ol className="relative space-y-0" aria-label={`${t('escTitle', lang)} — ${data.categoryKey} · ${data.area}`}>
        {data.ladder.map((lvl, i) => {
          const Icon = LEVEL_ICONS[lvl.level] ?? Users
          const isLast = i === data.ladder.length - 1
          return (
            <li key={lvl.level} className="flex gap-3">
              {/* icon + connector */}
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border',
                    lvl.active
                      ? 'border-emerald-300 bg-emerald-500 text-white dark:border-emerald-700'
                      : 'border-zinc-200 bg-muted/60 text-muted-foreground dark:border-zinc-800'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {lvl.active && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-emerald-400/40 motion-reduce:animate-none" />}
                </span>
                {!isLast && <span aria-hidden className={cn('w-px flex-1 min-h-8', lvl.active ? 'bg-emerald-300 dark:bg-emerald-800' : 'bg-border')} />}
              </div>

              {/* row body */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.12, duration: 0.3, ease: 'easeOut' }}
                className={cn(
                  'mb-2.5 min-w-0 flex-1 rounded-xl border p-2.5',
                  lvl.active
                    ? 'border-emerald-300 bg-emerald-50/70 shadow-sm dark:border-emerald-800 dark:bg-emerald-950/40'
                    : 'border-zinc-200 bg-card dark:border-zinc-800'
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                  <p className={cn('text-sm font-bold leading-tight', !lvl.active && 'text-muted-foreground')}>{lvl.name}</p>
                  {lvl.active ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-white">
                      {t('escDispatchedHere', lang)}
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-dashed px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground/70">
                      {t('escStandby', lang)}
                    </span>
                  )}
                </div>
                {!compact && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{lvl.detail}</p>}

                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className={cn('inline-flex items-center gap-1 text-[11px] font-semibold', lvl.active ? 'text-emerald-800 dark:text-emerald-300' : 'text-muted-foreground')}>
                    <Users className="h-3 w-3" /> {lvl.workersFound} {t('escWorkersFound', lang)}
                  </span>

                  {lvl.active && lvl.dispatched ? (
                    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-full border border-emerald-300 bg-white px-2.5 py-1 text-[11px] font-medium shadow-sm dark:border-emerald-700 dark:bg-emerald-950/60">
                      <span className="font-bold text-emerald-900 dark:text-emerald-200">{lvl.dispatched.name}</span>
                      <span className="text-muted-foreground">· {lvl.dispatched.coopName}</span>
                      <span className="inline-flex items-center gap-0.5 text-amber-600 dark:text-amber-400"><Star className="h-3 w-3 fill-amber-500 text-amber-500" />{lvl.dispatched.rating.toFixed(1)}</span>
                      <span className="inline-flex items-center gap-0.5 font-semibold text-primary"><Clock3 className="h-3 w-3" />{t('escEta', lang)} ~{lvl.dispatched.etaMin} {t('escMin', lang)}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60"><MapPin className="h-3 w-3" /> {t('escStandby', lang)}</span>
                  )}
                </div>
              </motion.div>
            </li>
          )
        })}
      </ol>

      {data.totalEtaMin !== null && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          {data.totalEtaMin !== null ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
              <Clock3 className="h-3.5 w-3.5" /> {t('escFastest', lang)}: ~{data.totalEtaMin} {t('escMin', lang)}
            </span>
          ) : <span />}
          <p className="max-w-sm text-right text-[10px] leading-snug text-muted-foreground/80">{data.disclaimer}</p>
        </div>
      )}
    </div>
  )
}
