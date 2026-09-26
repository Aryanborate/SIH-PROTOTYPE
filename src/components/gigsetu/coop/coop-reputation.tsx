'use client'

// Task 14-d — #36 Cooperative Reputation (cooperative-surface Phase 5)
// Cooperative-level service performance + transparent trust rollup.
// Contracts: GET /api/reputation?coopId=… · GET /api/trust?coopId=…

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { CoopReputationDTO } from '@/lib/types'
import { SectionCard, PrototypeNotice } from '../shared/ui-kit'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { t } from '@/lib/i18n'
import { useAppStore } from '@/store/app-store'
import { cn } from '@/lib/utils'
import {
  BadgeCheck, CheckCircle2, ClipboardList, FileWarning, HandHeart, PackageCheck, RefreshCw, ShieldCheck, Star, Timer,
} from 'lucide-react'

// ---------- Local API shapes (mirror the live routes; kept local like coop-app's DTOs) ----------

type ReputationResp = { ok: boolean } & CoopReputationDTO

interface CoopTrustResp {
  ok: boolean
  factors: { key: string; avg: number }[]
  workerReports: { category: string; count: number; resolved: number }[]
  openComplaints: number
  totalComplaints: number
  note: string
}

// ---------- Badge registry (same 4 keys as the verification system) ----------

const BADGE_KEYS = ['ORG_VERIFIED', 'SERVICE_READY', 'WELFARE_READY', 'OPERATIONALLY_TRUSTED'] as const

const BADGE_STYLE: Record<(typeof BADGE_KEYS)[number], { emoji: string; labelKey: string; chip: string }> = {
  ORG_VERIFIED: {
    emoji: '🟢', labelKey: 'rp2BadgeOrg',
    chip: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300',
  },
  SERVICE_READY: {
    emoji: '🔵', labelKey: 'rp2BadgeService',
    chip: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
  },
  WELFARE_READY: {
    emoji: '🟣', labelKey: 'rp2BadgeWelfare',
    chip: 'border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-300',
  },
  OPERATIONALLY_TRUSTED: {
    emoji: '⭐', labelKey: 'rp2BadgeTrusted',
    chip: 'border-primary/50 bg-accent text-primary',
  },
}

// ---------- Small presentational helpers ----------

function MiniStat({
  label, value, icon, tone = 'default',
}: {
  label: string
  value: string
  icon?: React.ReactNode
  tone?: 'default' | 'emerald' | 'amber'
}) {
  const toneCls = tone === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'amber' ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'
  return (
    <div className="rounded-lg border bg-card p-2.5">
      <p className="flex items-center justify-between gap-1 text-[10px] font-medium uppercase leading-tight tracking-wide text-muted-foreground">
        <span className="truncate">{label}</span>
        <span className={cn('shrink-0 opacity-80', toneCls)}>{icon}</span>
      </p>
      <p className={cn('mt-1 text-xl font-bold tabular-nums tracking-tight sm:text-2xl', toneCls)}>{value}</p>
    </div>
  )
}

function tr(key: string, lang: 'en' | 'mr' | 'hi', vars: Record<string, string | number>): string {
  let s = t(key, lang)
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v))
  return s
}

// ---------- Main card ----------

export function CoopReputationCard({ coopId, onOpenComplaints }: { coopId: string; onOpenComplaints?: () => void }) {
  const lang = useAppStore((s) => s.lang)

  const repQ = useQuery({
    queryKey: ['coop-reputation', coopId],
    queryFn: () => api.get<ReputationResp>(`/api/reputation?coopId=${encodeURIComponent(coopId)}`),
    staleTime: 30000,
  })
  const trustQ = useQuery({
    queryKey: ['coop-trust', coopId],
    queryFn: () => api.get<CoopTrustResp>(`/api/trust?coopId=${encodeURIComponent(coopId)}`),
    staleTime: 30000,
  })

  const rep = repQ.data
  const trust = trustQ.data

  const factorLabel: Record<string, string> = {
    quality: t('rp2FactorQuality', lang),
    timeliness: t('rp2FactorTimeliness', lang),
    behaviour: t('rp2FactorBehaviour', lang),
    communication: t('rp2FactorCommunication', lang),
  }

  const reportLabel = (category: string): string => {
    const key = `rp2Cat${category}`
    const label = t(key, lang)
    return label === key ? t('rp2CatOther', lang) : label
  }

  return (
    <SectionCard
      title={<span className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-primary" /> {t('rp2Title', lang)}</span>}
      description={t('rp2Sub', lang)}
    >
      {repQ.isLoading || (repQ.isError && !rep) ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
          <Skeleton className="h-10 rounded-lg" />
        </div>
      ) : repQ.isError || !rep ? (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-2"><FileWarning className="h-4 w-4 text-amber-500" /> Reputation API unavailable</span>
          <Button size="sm" variant="outline" className="h-8" onClick={() => repQ.refetch()}>
            <RefreshCw className="mr-1.5 h-3 w-3" /> Retry
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* ----- 6 KPI mini-cards ----- */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <MiniStat label={t('rp2Jobs', lang)} value={rep.jobsCompleted.toLocaleString('en-IN')} icon={<ClipboardList className="h-3.5 w-3.5" />} />
            <MiniStat label={t('rp2OnTime', lang)} value={`${rep.onTimePct}%`} tone="emerald" icon={<Timer className="h-3.5 w-3.5" />} />
            <MiniStat
              label={t('rp2ComplaintRate', lang)} value={`${rep.complaintRatePct}%`}
              tone={rep.complaintRatePct <= 1 ? 'emerald' : 'amber'} icon={<FileWarning className="h-3.5 w-3.5" />}
            />
            <MiniStat label={t('rp2AvgRating', lang)} value={rep.avgRating.toFixed(2)} tone="amber" icon={<Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />} />
            <MiniStat label={t('rp2Verified', lang)} value={`${rep.verifiedWorkersPct}%`} icon={<ShieldCheck className="h-3.5 w-3.5" />} />
            <MiniStat label={t('rp2Response', lang)} value={`${rep.emergencyResponseMin}`} icon={<Timer className="h-3.5 w-3.5" />} />
          </div>

          {/* ----- Repeat customers + badges row ----- */}
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold">
                <PackageCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> {t('rp2Repeat', lang)}
              </p>
              <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-emerald-600 dark:text-emerald-400">{rep.repeatCustomerPct}%</p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{t('rp2RepeatSub', lang)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-xs font-semibold">{t('rp2Badges', lang)}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {BADGE_KEYS.map((key) => {
                  const earned = rep.verificationBadges.includes(key)
                  const spec = BADGE_STYLE[key]
                  return (
                    <span
                      key={key}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                        earned ? spec.chip : 'border-dashed border-zinc-300 bg-transparent text-zinc-400 dark:border-zinc-700 dark:text-zinc-600'
                      )}
                      aria-label={`${spec.emoji} ${t(spec.labelKey, lang)} — ${earned ? t('vbEarned', lang) : t('vbNotEarned', lang)}`}
                    >
                      <span aria-hidden>{spec.emoji}</span> {t(spec.labelKey, lang)}
                      {earned && <CheckCircle2 className="h-3 w-3" />}
                    </span>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ----- Trust rollup (from /api/trust) ----- */}
          {trust && (
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-lg border p-3">
                <p className="text-xs font-semibold">{t('rp2TrustTitle', lang)}</p>
                <div className="mt-2.5 space-y-2.5">
                  {trust.factors.map((f) => (
                    <div key={f.key}>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate">{factorLabel[f.key] ?? f.key}</span>
                        <span className="shrink-0 font-semibold tabular-nums">
                          {f.avg.toFixed(1)} <span className="font-normal text-muted-foreground">/ 5</span>
                        </span>
                      </div>
                      <Progress value={(f.avg / 5) * 100} className="mt-1 h-1.5" aria-label={`${factorLabel[f.key] ?? f.key}: ${f.avg.toFixed(1)} ${t('rp2Scale5', lang)}`} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <p className="text-xs font-semibold">{t('rp2IssuesTitle', lang)}</p>
                {trust.workerReports.length === 0 ? (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" /> {t('rp2AllResolved', lang)}
                  </p>
                ) : (
                  <div className="mt-2 space-y-1.5">
                    {trust.workerReports.map((r) => {
                      const open = Math.max(0, r.count - r.resolved)
                      return (
                        <div key={r.category} className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5 text-xs">
                          <span className="min-w-0 truncate">{reportLabel(r.category)}</span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            <span className="tabular-nums text-muted-foreground">×{r.count}</span>
                            {open === 0 ? (
                              <span className="inline-flex items-center gap-0.5 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                                <CheckCircle2 className="h-2.5 w-2.5" /> {t('rp2AllResolved', lang)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                                {tr('rp2Open', lang, { n: open })}
                              </span>
                            )}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t pt-2.5">
                  <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <HandHeart className="h-3.5 w-3.5 shrink-0 text-primary" />
                    {tr('rp2OpenComplaints', lang, { n: trust.openComplaints })}
                  </p>
                  {onOpenComplaints && (
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 px-2.5 text-[11px]" onClick={onOpenComplaints}>
                      {t('rp2OpenComplaintsBtn', lang)}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          <PrototypeNotice>{rep.note}</PrototypeNotice>
        </div>
      )}

      {/* Trust-API failure never blocks the reputation card — render a quiet inline note */}
      {trustQ.isError && !trust && (
        <Badge variant="outline" className="mt-3 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
          {t('rp2TrustTitle', lang)} — API unavailable
        </Badge>
      )}
    </SectionCard>
  )
}
