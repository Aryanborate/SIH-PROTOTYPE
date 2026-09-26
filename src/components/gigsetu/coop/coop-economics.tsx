'use client'

// Task 14-d — #40 Cooperative Economics (cooperative-surface Phase 5)
// Contracts: GET/PUT /api/economics · GET /api/payments (settlement split config)
// Editable by COOP_ADMIN / PLATFORM_ADMIN; everyone else gets a read-only view.

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, fmtDateTime, inr } from '@/lib/api-client'
import type { DemoUser, EconomicsDTO, FeeConfigDTO } from '@/lib/types'
import { SectionCard, PrototypeNotice } from '../shared/ui-kit'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/hooks/use-toast'
import { t } from '@/lib/i18n'
import { useAppStore } from '@/store/app-store'
import { cn } from '@/lib/utils'
import { Eye, Info, PiggyBank, RefreshCw, Save, Wallet } from 'lucide-react'

type EconomicsResp = { ok: boolean } & EconomicsDTO
type PaymentsResp = { ok: boolean; config: FeeConfigDTO }

type SourceDraft = { priceRs: number; active: boolean }
type DraftMap = Record<string, SourceDraft>

function tr(key: string, lang: 'en' | 'mr' | 'hi', vars: Record<string, string | number>): string {
  let s = t(key, lang)
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v))
  return s
}

// Mirrors src/lib/economics.ts getEconomics() projection so edits preview live
// before saving (same synthetic baseline volumes, same per-source formulas).
function projectLocal(sources: { key: string; priceRs: number; active: boolean }[]): number {
  return Math.round(
    sources.filter((s) => s.active).reduce((acc, s) => {
      switch (s.key) {
        case 'household_fee': return acc + 9000 * 450 * (s.priceRs / 100)
        case 'institutional_sub': return acc + 40 * s.priceRs
        case 'amc': return acc + 25 * 42000 * (s.priceRs / 100)
        case 'tech_subscription': return acc + 60 * s.priceRs
        case 'federation_analytics': return acc + s.priceRs / 12
        case 'training': return acc + 350 * s.priceRs
        case 'procurement': return acc + 8 * 900000 * (s.priceRs / 100)
        default: return acc
      }
    }, 0)
  )
}

export function CoopEconomics({ user }: { user: DemoUser }) {
  const lang = useAppStore((s) => s.lang)
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const canEdit = user.role === 'COOP_ADMIN' || user.role === 'PLATFORM_ADMIN'

  const q = useQuery({
    queryKey: ['economics'],
    queryFn: () => api.get<EconomicsResp>('/api/economics'),
    staleTime: 15000,
  })
  const payQ = useQuery({
    queryKey: ['payments'],
    queryFn: () => api.get<PaymentsResp>('/api/payments'),
    staleTime: 60000,
  })

  // Draft edits are stamped with the server revision they were made against.
  // When the server data changes (e.g. after a save), the stamp no longer matches
  // and the effective draft falls back to the fresh server values — no effect needed.
  const [draft, setDraft] = useState<{ stamp: string; map: DraftMap } | null>(null)
  const stamp = q.data ? `${q.data.updatedAt}|${q.data.sources.map((s) => s.key).join(',')}` : ''

  const fromSources = (sources: EconomicsDTO['sources']): DraftMap =>
    Object.fromEntries(sources.map((s) => [s.key, { priceRs: s.priceRs, active: s.active }]))

  const effDraft: DraftMap | null = q.data
    ? (draft && draft.stamp === stamp ? draft.map : fromSources(q.data.sources))
    : null

  const setEdit = (key: string, patch: Partial<SourceDraft>) => {
    const base = effDraft?.[key] ?? { priceRs: 0, active: false }
    setDraft({ stamp, map: { ...(effDraft ?? {}), [key]: { ...base, ...patch } } })
  }

  const sources = useMemo(
    () => (q.data?.sources ?? []).map((s) => ({
      ...s,
      priceRs: effDraft?.[s.key]?.priceRs ?? s.priceRs,
      active: effDraft?.[s.key]?.active ?? s.active,
    })),
    [q.data, effDraft]
  )

  const projected = useMemo(() => projectLocal(sources), [sources])
  const topSources = useMemo(() => {
    const contrib = sources
      .filter((s) => s.active)
      .map((s) => ({ label: s.label, amount: projectLocal([s]) }))
      .filter((s) => s.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 3)
    const total = contrib.reduce((acc, s) => acc + s.amount, 0)
    return contrib.map((s) => ({ ...s, pct: total ? Math.round((s.amount / total) * 100) : 0 }))
  }, [sources])

  const dirty = useMemo(() => {
    if (!q.data || !effDraft) return false
    return q.data.sources.some((s) => {
      const d = effDraft[s.key]
      return d ? d.priceRs !== s.priceRs || d.active !== s.active : false
    })
  }, [q.data, effDraft])

  const saveM = useMutation({
    mutationFn: async (payload: EconomicsDTO['sources']) => {
      const res = await fetch('/api/economics', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sources: payload, updatedBy: user.name }),
      })
      const data = await res.json()
      if (!res.ok || data?.ok === false) throw new Error(data?.error ?? `Request failed: ${res.status}`)
      return data as EconomicsResp
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['economics'], data)
      queryClient.invalidateQueries({ queryKey: ['economics'] })
      setDraft(null) // server stamp changed → effective draft re-derives from the saved payload
      toast({ title: t('ecSavedToast', lang), description: t('ecSavedToastSub', lang) })
    },
    onError: () => {
      toast({ title: t('ecSaveFail', lang), description: t('ecSaveFailSub', lang), variant: 'destructive' })
    },
  })

  const config = payQ.data?.config

  if (q.isLoading || (!q.data && !q.isError)) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <div className="space-y-2">
          {[0, 1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      </div>
    )
  }

  if (q.isError || !q.data) {
    return (
      <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        <span className="flex items-center gap-2"><Info className="h-4 w-4 text-amber-500" /> Economics API unavailable</span>
        <Button size="sm" variant="outline" onClick={() => q.refetch()}><RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry</Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ---------- Header + honest note banner ---------- */}
      <SectionCard
        title={<span className="flex items-center gap-2"><Wallet className="h-4 w-4 text-primary" /> {t('ecTitle', lang)}</span>}
        description={t('ecSub', lang)}
        actions={
          canEdit ? (
            <Button
              size="sm"
              className="h-9 gap-1.5"
              disabled={!dirty || saveM.isPending}
              onClick={() => saveM.mutate(sources.map(({ key, label, unit, note, priceRs, active }) => ({ key, label, unit, note, priceRs, active })))}
            >
              {saveM.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {t('ecSave', lang)}
            </Button>
          ) : (
            <Badge variant="outline" className="gap-1 border-zinc-300 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              <Eye className="h-3 w-3" /> {t('ecViewOnly', lang)}
            </Badge>
          )
        }
      >
        <div className="flex items-start gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/60 px-3 py-2 text-[11px] leading-relaxed text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{t('ecNote', lang)}</span>
        </div>
        {!canEdit && <p className="mt-2 text-[11px] text-muted-foreground">{t('ecReadOnly', lang)}</p>}
      </SectionCard>

      {/* ---------- Projected monthly ---------- */}
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-primary/30 bg-accent/50 p-4 lg:col-span-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <PiggyBank className="h-3.5 w-3.5 text-primary" /> {t('ecProjected', lang)}
          </p>
          <p className="mt-1 text-3xl font-bold tabular-nums tracking-tight text-primary">{inr(projected)}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{t('ecProjectedSub', lang)}</p>
        </div>
        <div className="rounded-xl border p-4 lg:col-span-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('ecTopSources', lang)}</p>
          <div className="mt-2 space-y-2">
            {topSources.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              topSources.map((s) => (
                <div key={s.label} className="flex items-center gap-3">
                  <p className="w-44 min-w-0 flex-1 truncate text-sm">{s.label}</p>
                  <p className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums">{inr(s.amount)}</p>
                  <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-muted sm:w-40">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${s.pct}%` }} />
                  </div>
                  <span className="w-20 shrink-0 text-right text-[11px] tabular-nums text-muted-foreground">{tr('ecShare', lang, { n: s.pct })}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ---------- Revenue source rows ---------- */}
      <div className="overflow-hidden rounded-xl border">
        {sources.map((s, i) => {
          const isPlanned = s.key === 'federation_analytics'
          const editLocked = !canEdit || isPlanned
          return (
            <div key={s.key} className={cn('flex flex-col gap-3 p-3 sm:flex-row sm:items-center', i > 0 && 'border-t')}>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  {s.label}
                  {isPlanned && (
                    <Badge variant="outline" className="border-zinc-300 px-1.5 py-0 text-[10px] uppercase tracking-wide text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                      {t('ecPlanned', lang)}
                    </Badge>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.note}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                <Badge variant="secondary" className="whitespace-nowrap text-[10px]">{s.unit}</Badge>
                <label className="sr-only" htmlFor={`ec-price-${s.key}`}>{t('ecPrice', lang)} — {s.label}</label>
                <Input
                  id={`ec-price-${s.key}`}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  className="h-11 w-28 tabular-nums disabled:opacity-60"
                  value={s.priceRs}
                  disabled={editLocked}
                  onChange={(e) => {
                    const v = e.target.value === '' ? 0 : Number(e.target.value)
                    setEdit(s.key, { priceRs: Math.max(0, v) })
                  }}
                  aria-label={`${t('ecPrice', lang)} — ${s.label}`}
                />
                <label className="sr-only" htmlFor={`ec-active-${s.key}`}>{t('ecActive', lang)} — {s.label}</label>
                <Switch
                  id={`ec-active-${s.key}`}
                  className="disabled:cursor-not-allowed disabled:opacity-50"
                  checked={isPlanned ? false : s.active}
                  disabled={editLocked}
                  onCheckedChange={(v) => setEdit(s.key, { active: v === true })}
                />
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">{tr('ecUpdated', lang, { by: q.data.updatedBy, when: fmtDateTime(q.data.updatedAt) })}</p>

      {/* ---------- Settlement split strip ---------- */}
      {config && (
        <SectionCard
          title={t('ecSplitTitle', lang)}
          description={t('ecSplitSub', lang)}
          actions={<Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">{config.workerSharePct + config.coopPct + config.welfarePct + config.platformPct}%</Badge>}
        >
          <div
            className="flex h-4 w-full overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`${t('ecSplitWorker', lang)} ${config.workerSharePct}% · ${t('ecSplitCoop', lang)} ${config.coopPct}% · ${t('ecSplitWelfare', lang)} ${config.welfarePct}% · ${t('ecSplitPlatform', lang)} ${config.platformPct}%`}
          >
            <div className="bg-emerald-500" style={{ width: `${config.workerSharePct}%` }} />
            <div className="bg-amber-500" style={{ width: `${config.coopPct}%` }} />
            <div className="bg-amber-300" style={{ width: `${config.welfarePct}%` }} />
            <div className="bg-zinc-400" style={{ width: `${config.platformPct}%` }} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500" />{t('ecSplitWorker', lang)} <span className="font-bold tabular-nums">{config.workerSharePct}%</span></div>
            <div><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber-500" />{t('ecSplitCoop', lang)} <span className="font-bold tabular-nums">{config.coopPct}%</span></div>
            <div><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-amber-300" />{t('ecSplitWelfare', lang)} <span className="font-bold tabular-nums">{config.welfarePct}%</span></div>
            <div><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-zinc-400" />{t('ecSplitPlatform', lang)} <span className="font-bold tabular-nums">{config.platformPct}%</span></div>
          </div>
          <p className="mt-3 text-[11px] italic text-muted-foreground">{config.note}</p>
        </SectionCard>
      )}

      <PrototypeNotice>{t('ecNote', lang)}</PrototypeNotice>
    </div>
  )
}
