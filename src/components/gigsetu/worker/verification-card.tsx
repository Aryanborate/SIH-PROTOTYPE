'use client'

// Transparent verification (#44, worker side) — the same 5 auditable checks coops see,
// computed client-side from the worker's own home data. No hidden scores.

import { t } from '@/lib/i18n'
import { useAppStore } from '@/store/app-store'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { CheckCircle2, Circle } from 'lucide-react'
import type { WorkerDTO } from '@/lib/types'

interface Check {
  key: string
  labelKey: string
  basis: string
  pass: boolean
}

export function VerificationCard({ worker, coopName }: { worker: WorkerDTO; coopName: string }) {
  const lang = useAppStore((s) => s.lang)

  const checks: Check[] = [
    {
      key: 'identity',
      labelKey: 'vcIdentity',
      basis: t('vcIdentityBasis', lang),
      pass: !!worker.phone && worker.phone.trim().length > 0,
    },
    {
      key: 'coop',
      labelKey: 'vcCoop',
      basis: t('vcCoopBasis', lang).replace('{coop}', coopName),
      pass: !!coopName,
    },
    {
      key: 'skill',
      labelKey: 'vcSkill',
      basis: t('vcSkillBasis', lang).replace('{n}', String(worker.completedJobs)),
      pass: worker.completedJobs >= 10,
    },
    {
      key: 'cert',
      labelKey: 'vcCert',
      basis: t('vcCertBasis', lang),
      pass: worker.certStatus.startsWith('VERIFIED'),
    },
    {
      key: 'safety',
      labelKey: 'vcSafety',
      basis: t('vcSafetyBasis', lang),
      pass: !!worker.safetyValid,
    },
  ]

  const passed = checks.filter((c) => c.pass).length
  const all = checks.length

  return (
    <section
      aria-label={t('vcTitle', lang)}
      className="rounded-2xl border bg-card p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold uppercase tracking-wide">{t('vcTitle', lang)}</h3>
          <Badge
            variant="outline"
            className={cn(
              passed === all
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
                : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
            )}
          >
            {t('vcProgress', lang).replace('{n}', String(passed)).replace('{m}', String(all))}
          </Badge>
        </div>
        <div className="hidden h-1.5 flex-1 sm:mx-3 sm:block" aria-hidden>
          <div
            className="h-full rounded-full bg-emerald-500/80 transition-all"
            style={{ width: `${Math.round((passed / all) * 100)}%` }}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">{t('vcNote', lang)}</p>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" role="list" aria-label={t('vcChecksAria', lang)}>
        {checks.map((c) => (
          <div
            key={c.key}
            role="listitem"
            className={cn(
              'rounded-xl border p-3 transition',
              c.pass
                ? 'border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-900/70 dark:bg-emerald-950/25'
                : 'border-border bg-muted/40',
            )}
          >
            <div className="flex items-center gap-1.5">
              {c.pass ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden />
              )}
              <p className="truncate text-xs font-semibold">{t(c.labelKey, lang)}</p>
            </div>
            <p className={cn('mt-1 text-[10px] font-bold uppercase tracking-widest', c.pass ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')}>
              {c.pass ? t('vcVerified', lang) : t('vcPending', lang)}
            </p>
            <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{c.basis}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
