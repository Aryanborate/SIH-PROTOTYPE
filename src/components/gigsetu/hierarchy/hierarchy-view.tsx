'use client'

// Configurable Cooperative Hierarchy — the ladder is DB configuration (levels 0–6),
// the org tree is live network data (federations → districts → talukas → cooperatives).

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import { SectionCard, EmptyState } from '../shared/ui-kit'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { useAppStore, ROLE_VIEWS } from '@/store/app-store'
import type { DemoUser } from '@/lib/types'
import type { HierarchyTreeResponse, HierarchyLevel, FederationNode } from './api-types'
import {
  Network, MapPin, Users, Building2, ChevronRight, RefreshCw, SlidersHorizontal,
  Home, Building, GraduationCap, Hospital, BedDouble, Store, Landmark, HeartHandshake,
  ArrowUpRight,
} from 'lucide-react'

// ---------- Level ladder ----------

function LevelRow({ lvl }: { lvl: HierarchyLevel }) {
  const external = lvl.level === 0
  return (
    <div className={cn(
      'flex items-start gap-3 rounded-lg border p-3',
      external
        ? 'border-dashed border-amber-400 bg-amber-50/60 dark:border-amber-700 dark:bg-amber-950/30'
        : 'border-border bg-card'
    )}>
      <div className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums',
        external ? 'border-2 border-amber-400 text-amber-700 dark:text-amber-400' : 'bg-secondary text-secondary-foreground'
      )}>
        {lvl.level}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px] font-semibold">{lvl.code}</Badge>
          <span className="text-sm font-semibold">{lvl.nameEn}</span>
          <span className="text-xs text-muted-foreground">{lvl.nameMr}</span>
          {external && (
            <span className="rounded border border-dashed border-amber-400 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              External ecosystem
            </span>
          )}
          {!lvl.active && <span className="text-[10px] uppercase tracking-wide text-muted-foreground">inactive</span>}
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{lvl.descriptionEn}</p>
      </div>
    </div>
  )
}

// ---------- Live org tree ----------

function TreeRow({
  expanded, onToggle, icon, children, meta, depth,
}: {
  expanded: boolean
  onToggle: () => void
  icon: React.ReactNode
  children: React.ReactNode
  meta?: React.ReactNode
  depth: number
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted/70',
        depth === 0 && 'bg-muted/30'
      )}
    >
      <ChevronRight className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-90')} />
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="min-w-0 flex-1 truncate text-sm">{children}</span>
      {meta}
    </button>
  )
}

function OrgTree({ tree, user }: { tree: FederationNode[]; user: DemoUser }) {
  const drillTo = useAppStore((s) => s.drillTo)
  const canDrillCoop = ROLE_VIEWS[user.role].includes('coop')
  // Federations default open; districts & talukas default collapsed. User toggles override.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const isOpen = (key: string, defaultOpen: boolean) => expanded[key] ?? defaultOpen
  const toggle = (key: string, defaultOpen: boolean) =>
    setExpanded((prev) => ({ ...prev, [key]: !(prev[key] ?? defaultOpen) }))

  return (
    <div className="max-h-[480px] overflow-y-auto rounded-lg border bg-card">
      <div className="divide-y p-2">
        {tree.map((fed) => {
          const fedKey = `f:${fed.id}`
          const fedOpen = isOpen(fedKey, true)
          return (
            <div key={fed.id} className="py-1">
              <TreeRow
                expanded={fedOpen}
                onToggle={() => toggle(fedKey, true)}
                depth={0}
                icon={<Network className="h-4 w-4 text-primary" />}
                meta={
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge variant={fed.type === 'NATIONAL' ? 'default' : 'secondary'} className="text-[10px]">{fed.type}</Badge>
                    <span className="hidden text-[11px] tabular-nums text-muted-foreground sm:inline">{fed.region}</span>
                  </span>
                }
              >
                <span className="font-semibold">{fed.name}</span>
                <span className="ml-1 text-xs text-muted-foreground">· {fed.districts.length} districts</span>
              </TreeRow>
              {fedOpen && (
                <div className="ml-6 border-l pl-2">
                  {fed.districts.map((d) => {
                    const dKey = `d:${d.id}`
                    const dOpen = isOpen(dKey, false)
                    return (
                      <div key={d.id}>
                        <TreeRow
                          expanded={dOpen}
                          onToggle={() => toggle(dKey, false)}
                          depth={1}
                          icon={<MapPin className="h-4 w-4" />}
                          meta={
                            <span className="flex shrink-0 items-center gap-2">
                              <span className="hidden text-[11px] text-muted-foreground md:inline">{d.coordinator}</span>
                              <span className="flex items-center gap-1 text-[11px] tabular-nums text-muted-foreground"><Users className="h-3 w-3" />{d.workers}</span>
                            </span>
                          }
                        >
                          {d.name} <span className="text-xs text-muted-foreground">district</span>
                        </TreeRow>
                        {dOpen && (
                          <div className="ml-7 border-l pl-2">
                            {d.talukas.map((t) => {
                              const tKey = `t:${t.id}`
                              const tOpen = isOpen(tKey, false)
                              return (
                                <div key={t.id}>
                                  <TreeRow
                                    expanded={tOpen}
                                    onToggle={() => toggle(tKey, false)}
                                    depth={2}
                                    icon={<MapPin className="h-3.5 w-3.5" />}
                                    meta={<span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{t.cooperatives.length} coops</span>}
                                  >
                                    {t.name}
                                  </TreeRow>
                                  {tOpen && (
                                    <div className="ml-7 border-l pl-3">
                                      {t.cooperatives.map((c) => (
                                        <div key={c.id} className="group flex items-center gap-2 rounded-md py-1 pl-2 pr-1 transition-colors hover:bg-muted/60">
                                          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                          <span className="min-w-0 flex-1 truncate text-xs font-medium">{c.name}</span>
                                          <Badge variant="secondary" className="shrink-0 text-[9px] capitalize">{c.sector}</Badge>
                                          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{c.workerCount} workers</span>
                                          {canDrillCoop && c.id !== user.orgId && (
                                            <button
                                              type="button"
                                              onClick={() => drillTo('coop', { coop: c.id })}
                                              aria-label={`Open ${c.name} dashboard`}
                                              title="Open cooperative dashboard"
                                              className="shrink-0 rounded-md border border-transparent p-1 text-primary/70 transition hover:border-primary/30 hover:bg-accent hover:text-primary"
                                            >
                                              <ArrowUpRight className="h-3.5 w-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      ))}
                                      {t.cooperatives.length === 0 && <p className="py-1 pl-2 text-[11px] text-muted-foreground">No cooperatives registered here yet.</p>}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                            {d.talukas.length === 0 && <p className="py-1 pl-2 text-[11px] text-muted-foreground">No talukas mapped.</p>}
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {fed.districts.length === 0 && <p className="py-2 pl-2 text-[11px] text-muted-foreground">No districts mapped to this federation in the demo dataset.</p>}
                </div>
              )}
            </div>
          )
        })}
        {tree.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Network tree is empty.</p>}
      </div>
    </div>
  )
}

// ---------- Customers across the network ----------

const CUSTOMER_KINDS = [
  { icon: <Home className="h-4 w-4" />, label: 'Households' },
  { icon: <Building className="h-4 w-4" />, label: 'Housing Societies' },
  { icon: <GraduationCap className="h-4 w-4" />, label: 'Schools' },
  { icon: <Hospital className="h-4 w-4" />, label: 'Hospitals' },
  { icon: <BedDouble className="h-4 w-4" />, label: 'Hostels' },
  { icon: <Store className="h-4 w-4" />, label: 'Businesses' },
  { icon: <Landmark className="h-4 w-4" />, label: 'Govt / Community Institutions' },
]

// ---------- View ----------

export function HierarchyView({ user }: { user: DemoUser }) {
  const drillTo = useAppStore((s) => s.drillTo)
  const canDrillCoop = ROLE_VIEWS[user.role].includes('coop')
  const q = useQuery({
    queryKey: ['hierarchy-tree'],
    queryFn: () => api.get<HierarchyTreeResponse>('/api/hierarchy'),
    // Live: every governance dashboard must reflect a booking as it happens.
    staleTime: 15_000,
    refetchInterval: 20_000,
  })

  if (q.isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-5">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-72 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    )
  }

  if (q.isError || !q.data?.ok) {
    return (
      <div className="mx-auto max-w-5xl">
        <EmptyState
          icon={<Network className="h-8 w-8" />}
          title="Hierarchy engine unavailable"
          body={q.isError ? (q.error as Error).message : 'Unexpected response from the hierarchy service.'}
          action={<Button variant="outline" size="sm" onClick={() => q.refetch()}><RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry</Button>}
        />
      </div>
    )
  }

  const { levels, tree } = q.data
  const sorted = [...levels].sort((a, b) => a.orderIndex - b.orderIndex)
  const totalWorkers = tree.reduce((s, f) => s + f.districts.reduce((sd, d) => sd + d.workers, 0), 0)

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-primary/10 p-2 text-primary"><SlidersHorizontal className="h-5 w-5" /></div>
          <h1 className="text-xl font-bold tracking-tight">Cooperative hierarchy engine</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Levels are configuration, not hard-coded structure — add, rename or reorder them without touching code.
        </p>
      </div>

      {/* Level ladder */}
      <SectionCard
        title="Level ladder (0–6)"
        description="Stored in the database — every level carries English, Marathi and Hindi names."
      >
        <div className="space-y-2">
          {sorted.map((l) => <LevelRow key={l.id} lvl={l} />)}
        </div>
      </SectionCard>

      {/* Live org tree */}
      <SectionCard
        title="Live network tree"
        description={`Federations → districts → talukas → cooperatives · ${totalWorkers.toLocaleString('en-IN')} workers tracked across ${tree.length} federation(s).`}
      >
        <OrgTree tree={tree} user={user} />
      </SectionCard>

      {/* Customers note */}
      <SectionCard
        title={<span className="flex items-center gap-2"><HeartHandshake className="h-4 w-4 text-primary" /> Demand comes from the whole economy</span>}
        description="Customers exist across the network — not on any single gig app."
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {CUSTOMER_KINDS.map((k) => (
            <div key={k.label} className="flex flex-col items-center gap-1.5 rounded-lg border bg-card px-2 py-3 text-center">
              <span className="text-primary">{k.icon}</span>
              <span className="text-[11px] font-medium leading-tight text-muted-foreground">{k.label}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] italic text-muted-foreground">
          Households, Housing Societies, Schools, Hospitals, Hostels, Businesses and Government/Community Institutions — every one of them is a potential demand node on GigSetu.
        </p>
      </SectionCard>
    </div>
  )
}
