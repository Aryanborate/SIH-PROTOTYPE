'use client'

// Task 14-d — #37 Collective Procurement (cooperative-surface Phase 5)
// Contract: GET /api/procurement?district=Pune → ProcurementDTO

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, inr } from '@/lib/api-client'
import type { ProcurementDTO } from '@/lib/types'
import { SectionCard, PrototypeNotice, KpiCard, EmptyState } from '../shared/ui-kit'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { t } from '@/lib/i18n'
import { useAppStore } from '@/store/app-store'
import { useSkillLabel } from '../shared/skill-label'
import { cn } from '@/lib/utils'
import { Building2, Handshake, PackageSearch, PiggyBank, RefreshCw, TrendingDown } from 'lucide-react'

type ProcurementResp = { ok: boolean } & ProcurementDTO

function tr(key: string, lang: 'en' | 'mr' | 'hi', vars: Record<string, string | number>): string {
  let s = t(key, lang)
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v))
  return s
}

export function CoopProcurement({ district }: { district?: string }) {
  const lang = useAppStore((s) => s.lang)
  const coopId = useAppStore((s) => s.user?.cooperativeId ?? s.user?.orgId ?? '')
  const { toast } = useToast()
  const qc = useQueryClient()
  const skillLabel = useSkillLabel()
  // FIX: the district was hardcoded to 'Pune' for every cooperative because the
  // only call site passed no prop. Resolve it from the signed-in cooperative.
  const distQ = useQuery({
    queryKey: ['coop-district', coopId],
    queryFn: async () => {
      if (!coopId) return ''
      const c = await api.get<{ ok: boolean; location?: { district: string } }>(`/api/cooperatives/${coopId}`)
      return c.location?.district ?? ''
    },
    enabled: !district && !!coopId,
    staleTime: 300000,
  })
  const effectiveDistrict = district || distQ.data || 'Pune'

  // FIX: "Raise with federation" used to only show a toast. It now creates a
  // real capacity-exchange recommendation that a district/federation approver
  // can act on, and is audited.
  const raise = useMutation({
    mutationFn: async (input: { skill: string; workerCount: number; kitName: string; savingRs: number }) =>
      api.post<{ ok: boolean; recommendation: { id: string } }>('/api/exchange', {
        skill: input.skill,
        fromCoopId: coopId || 'unknown',
        fromCoopName: coopId || 'This cooperative',
        toCoopId: 'federation-procurement-pool',
        toCoopName: 'Federation procurement pool',
        districtName: effectiveDistrict,
        workerCount: input.workerCount,
        expectedDemand: input.workerCount,
        durationDays: 30,
        rationale: `Collective procurement raised: ${input.kitName} · projected saving ₹${input.savingRs.toLocaleString('en-IN')}`,
      }),
    onSuccess: (_d, v) => {
      void qc.invalidateQueries({ queryKey: ['exchange'] })
      toast({ title: t('prRaiseToast', lang), description: `${v.kitName} · ${v.workerCount} members · federated procurement request created and pending approval.` })
    },
    onError: (e) => toast({ title: t('prRaiseToast', lang), description: (e as Error).message, variant: 'destructive' }),
  })

  const q = useQuery({
    queryKey: ['procurement', effectiveDistrict],
    queryFn: () => api.get<ProcurementResp>(`/api/procurement?district=${encodeURIComponent(effectiveDistrict)}`),
    staleTime: 60000,
  })

  const d = q.data

  if (q.isLoading || (!d && !q.isError)) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 rounded-xl" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (q.isError || !d) {
    return (
      <EmptyState
        icon={<PackageSearch className="h-10 w-10" />}
        title="Could not load procurement data"
        body={q.error instanceof Error ? q.error.message : 'The procurement API did not respond.'}
        action={
          <Button size="sm" variant="outline" onClick={() => q.refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry
          </Button>
        }
      />
    )
  }

  // Headline is a server EN string — keep it verbatim for EN, use the localized
  // template (same numbers) for MR/HI so the banner is fully translated.
  const headline = lang === 'en' ? d.headline : tr('prHeadline', lang, { amt: d.totalSavingRs.toLocaleString('en-IN') })

  return (
    <div className="space-y-4">
      {/* ---------- Headline banner ---------- */}
      <section
        aria-label={t('prTitle', lang)}
        className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-background to-background p-4 dark:border-emerald-900 dark:from-emerald-950/40 dark:via-background dark:to-background sm:p-5"
      >
        <p className="flex items-start gap-2.5 text-sm font-semibold leading-snug sm:text-base">
          <TrendingDown className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{headline}</span>
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-7 text-xs text-muted-foreground">
          <Building2 className="h-3.5 w-3.5 shrink-0" /> {tr('prScanned', lang, { n: d.cooperativesScanned })} · {d.district}
        </p>
      </section>

      {/* ---------- Summary ---------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <KpiCard label={t('prTotalSaving', lang)} value={inr(d.totalSavingRs)} tone="success" icon={<PiggyBank className="h-4 w-4" />} sub={t('prThisQuarter', lang)} />
        <KpiCard label={t('prScannedShort', lang)} value={d.cooperativesScanned} icon={<Building2 className="h-4 w-4" />} sub={tr('prScanned', lang, { n: d.cooperativesScanned })} />
        <KpiCard label={t('prKits', lang)} value={d.opportunities.length} icon={<PackageSearch className="h-4 w-4" />} sub={d.district} className="col-span-2 lg:col-span-1" />
      </div>

      {/* ---------- Opportunity cards ---------- */}
      {d.opportunities.length === 0 ? (
        <EmptyState icon={<PackageSearch className="h-10 w-10" />} title={t('prTitle', lang)} body={t('prSub', lang)} />
      ) : (
        d.opportunities.map((opp) => (
          <SectionCard
            key={opp.skill}
            title={opp.kitName}
            description={tr('prWorkersNeed', lang, { n: opp.workerCount, skill: skillLabel(opp.skill) })}
            actions={
              <Badge className="gap-1 border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" variant="outline">
                <TrendingDown className="h-3 w-3" /> −{opp.savingPct}%
              </Badge>
            }
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('prItem', lang)}</TableHead>
                    <TableHead className="w-[90px]">{t('prUnit', lang)}</TableHead>
                    <TableHead className="w-[110px] text-right">{t('prRetail', lang)}</TableHead>
                    <TableHead className="w-[110px] text-right text-emerald-700 dark:text-emerald-400">{t('prBulk', lang)}</TableHead>
                    <TableHead className="w-[100px] text-right">{t('prSaveUnit', lang)}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {opp.items.map((item) => {
                    const save = item.unitCostRs - item.bulkUnitCostRs
                    return (
                      <TableRow key={item.item}>
                        <TableCell className="font-medium">{item.item}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.unit}</TableCell>
                        <TableCell className="text-right tabular-nums">{inr(item.unitCostRs)}</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{inr(item.bulkUnitCostRs)}</TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">−{inr(save)}</TableCell>
                      </TableRow>
                    )
                  })}
                  {/* Totals row */}
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableCell colSpan={2} className="font-bold">{t('prRetailTotal', lang)} → {t('prBulkTotal', lang)}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">{inr(opp.retailTotalRs)}</TableCell>
                    <TableCell className="text-right font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{inr(opp.bulkTotalRs)}</TableCell>
                    <TableCell className="text-right font-bold tabular-nums text-emerald-600 dark:text-emerald-400">−{inr(opp.savingRs)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className="mt-3 flex flex-col gap-3 rounded-lg border border-emerald-200/70 bg-emerald-50/50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">{t('prBenefit', lang)}</p>
                <p className="mt-0.5 truncate text-xs italic text-muted-foreground">{opp.federationNote}</p>
              </div>
              <Button
                size="sm"
                className="h-11 shrink-0 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 sm:h-9"
                disabled={raise.isPending}
                onClick={() => raise.mutate({ skill: opp.skill, workerCount: opp.workerCount, kitName: opp.kitName, savingRs: opp.savingRs })}
              >
                <Handshake className="h-3.5 w-3.5" /> {t('prRaise', lang)}
              </Button>
            </div>
          </SectionCard>
        ))
      )}

      <PrototypeNotice>{d.prototypeNote}</PrototypeNotice>
    </div>
  )
}
