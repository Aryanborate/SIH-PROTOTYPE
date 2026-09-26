'use client'

// Task 14-d — #44 Verification System (cooperative side)
// Transparent badge criteria built client-side from live /api/coop data —
// thresholds mirror the server lib (src/lib/verify.ts). The dedicated
// /api/verify endpoint is not exposed for the coop surface yet (contract gap,
// documented in worklog); earned state comes from GET /api/reputation.

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { CoopReputationDTO } from '@/lib/types'
import { SectionCard } from '../shared/ui-kit'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { t } from '@/lib/i18n'
import { useAppStore } from '@/store/app-store'
import { cn } from '@/lib/utils'
import { CheckCircle2, ShieldCheck, XCircle } from 'lucide-react'

// ---------- Props (structural subset of coop-app's local DTOs) ----------

interface VerificationCoop {
  regNo: string
  repName: string
  repRole: string
  memberCount: number
  workerCount: number
  activeToday: number
  utilizationPct: number
  welfareFundRs: number
  emergencyPoolSize: number
}

interface VerificationCheck {
  key: string
  labelKey: string
  basisKey: string
  basisVars: Record<string, string | number>
  pass: boolean
}

interface VerificationBadgeSpec {
  key: string
  emoji: string
  labelKey: string
  ring: string // earned border + tint
  checks: VerificationCheck[]
}

type ReputationResp = { ok: boolean } & CoopReputationDTO

// ---------- Transparent criteria (mirrors src/lib/verify.ts thresholds) ----------

function buildBadgeSpecs(coop: VerificationCoop, workers: { certStatus: string; safetyValid: boolean }[], openComplaints: number, totalComplaints: number): VerificationBadgeSpec[] {
  const total = workers.length || 1
  const verifiedPct = Math.round((workers.filter((w) => w.certStatus === 'VERIFIED').length / total) * 100)
  const safetyPct = Math.round((workers.filter((w) => w.safetyValid).length / total) * 100)
  const activePct = coop.workerCount ? coop.activeToday / coop.workerCount : 0
  const inrAmt = coop.welfareFundRs.toLocaleString('en-IN')

  return [
    {
      key: 'ORG_VERIFIED', emoji: '🟢', labelKey: 'rp2BadgeOrg',
      ring: 'border-emerald-300 bg-emerald-50/60 dark:border-emerald-800 dark:bg-emerald-950/30',
      checks: [
        { key: 'reg', labelKey: 'vbChkReg', basisKey: 'vbBasisReg', basisVars: { reg: coop.regNo }, pass: !!coop.regNo },
        { key: 'rep', labelKey: 'vbChkRep', basisKey: 'vbBasisRep', basisVars: { name: coop.repName, role: coop.repRole }, pass: !!coop.repName },
        { key: 'members', labelKey: 'vbChkMembers', basisKey: 'vbBasisMembers', basisVars: { n: coop.memberCount }, pass: coop.memberCount > 0 },
      ],
    },
    {
      key: 'SERVICE_READY', emoji: '🔵', labelKey: 'rp2BadgeService',
      ring: 'border-amber-300 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/30',
      checks: [
        { key: 'active', labelKey: 'vbChkActive', basisKey: 'vbBasisActive', basisVars: { a: coop.activeToday, t: coop.workerCount }, pass: activePct >= 0.2 },
        { key: 'util', labelKey: 'vbChkUtil', basisKey: 'vbBasisUtil', basisVars: { n: coop.utilizationPct }, pass: coop.utilizationPct >= 50 },
        { key: 'skills', labelKey: 'vbChkSkills', basisKey: 'vbBasisSkills', basisVars: { n: coop.workerCount }, pass: coop.workerCount >= 20 },
      ],
    },
    {
      key: 'WELFARE_READY', emoji: '🟣', labelKey: 'rp2BadgeWelfare',
      ring: 'border-violet-300 bg-violet-50/60 dark:border-violet-800 dark:bg-violet-950/30',
      checks: [
        { key: 'fund', labelKey: 'vbChkFund', basisKey: 'vbBasisFund', basisVars: { amt: inrAmt }, pass: coop.welfareFundRs > 0 },
        { key: 'safety', labelKey: 'vbChkSafety', basisKey: 'vbBasisSafety', basisVars: { n: safetyPct }, pass: safetyPct >= 80 },
        { key: 'ledger', labelKey: 'vbChkLedger', basisKey: 'vbBasisLedger', basisVars: {}, pass: coop.welfareFundRs > 50000 },
      ],
    },
    {
      key: 'OPERATIONALLY_TRUSTED', emoji: '⭐', labelKey: 'rp2BadgeTrusted',
      ring: 'border-primary/50 bg-accent/60',
      checks: [
        { key: 'cert', labelKey: 'vbChkCert', basisKey: 'vbBasisCert', basisVars: { n: verifiedPct }, pass: verifiedPct >= 90 },
        { key: 'complaints', labelKey: 'vbChkComplaints', basisKey: 'vbBasisComplaints', basisVars: { o: openComplaints, t: totalComplaints }, pass: openComplaints <= 3 },
        { key: 'pool', labelKey: 'vbChkPool', basisKey: 'vbBasisPool', basisVars: { n: coop.emergencyPoolSize }, pass: coop.emergencyPoolSize >= 10 },
      ],
    },
  ]
}

function tr(key: string, lang: 'en' | 'mr' | 'hi', vars: Record<string, string | number>): string {
  let s = t(key, lang)
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v))
  return s
}

// ---------- Main card ----------

export function CoopVerificationCard({
  coopId, coop, workers, openComplaints, totalComplaints,
}: {
  coopId: string
  coop: VerificationCoop
  workers: { certStatus: string; safetyValid: boolean }[]
  openComplaints: number
  totalComplaints: number
}) {
  const lang = useAppStore((s) => s.lang)

  // Shares the ['coop-reputation', coopId] cache with the reputation card — no extra request.
  const repQ = useQuery({
    queryKey: ['coop-reputation', coopId],
    queryFn: () => api.get<ReputationResp>(`/api/reputation?coopId=${encodeURIComponent(coopId)}`),
    staleTime: 30000,
  })

  const specs = buildBadgeSpecs(coop, workers, openComplaints, totalComplaints)
  const allChecks = specs.flatMap((b) => b.checks)
  const passedCount = allChecks.filter((c) => c.pass).length
  const overallPct = Math.round((passedCount / allChecks.length) * 100)

  return (
    <SectionCard
      title={<span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> {t('vbTitle', lang)}</span>}
      description={t('vbSub', lang)}
      actions={
        <Badge variant="outline" className="shrink-0 border-primary/30 bg-accent text-primary tabular-nums">
          {tr('vbOverall', lang, { n: overallPct })}
        </Badge>
      }
    >
      {repQ.isLoading && <Skeleton className="mb-3 h-6 w-40 rounded-full" />}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {specs.map((badge) => {
          const computedEarned = badge.checks.every((c) => c.pass)
          const earned = repQ.data ? repQ.data.verificationBadges.includes(badge.key) : computedEarned
          return (
            <div
              key={badge.key}
              aria-label={`${badge.emoji} ${t(badge.labelKey, lang)} — ${earned ? t('vbEarned', lang) : t('vbNotEarned', lang)}`}
              className={cn(
                'flex flex-col rounded-xl border p-3',
                earned
                  ? badge.ring
                  : 'border-dashed border-zinc-300 bg-transparent dark:border-zinc-700'
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="flex min-w-0 items-center gap-1.5 text-sm font-bold leading-tight">
                  <span aria-hidden className="text-base">{badge.emoji}</span>
                  <span className="truncate">{t(badge.labelKey, lang)}</span>
                </p>
                {earned ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label={t('vbEarned', lang)} />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-600" aria-label={t('vbNotEarned', lang)} />
                )}
              </div>
              <p className={cn('mt-0.5 text-[10px] font-bold uppercase tracking-widest', earned ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400 dark:text-zinc-600')}>
                {earned ? t('vbEarned', lang) : t('vbNotEarned', lang)}
              </p>

              <ul className="mt-2 space-y-1.5 border-t pt-2">
                {badge.checks.map((c) => {
                  const label = t(c.labelKey, lang)
                  const basis = tr(c.basisKey, lang, c.basisVars)
                  return (
                    <li key={c.key} className="flex items-start gap-1.5">
                      {c.pass ? (
                        <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-zinc-400 dark:text-zinc-600" />
                      )}
                      <span className="min-w-0">
                        <span className={cn('block text-[11px] font-medium leading-tight', c.pass ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
                        <span className="block text-[10px] leading-snug text-muted-foreground">{basis}</span>
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
    </SectionCard>
  )
}
