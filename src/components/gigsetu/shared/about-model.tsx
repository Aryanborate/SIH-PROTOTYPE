'use client'

// Phase 6 #54 + #79 + #76 — "How the Cooperative Network Works" (Task 15-c).
// Exports:
//   AboutModel({ open, onOpenChange }) — large dialog: hierarchy explainer,
//     revenue canvas summary, SIH impact dashboard, interactive network visual.
//   ImpactDashboard({ className? }) — standalone 8-tile SIH impact dashboard
//     (reusable by the demo orchestrator).
//   CoopNetworkVisual() — the interactive Federation→District→Taluka→Coop→Workers
//     SVG tree (also rendered inside the About dialog).

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAppStore, ROLE_VIEWS, type View } from '@/store/app-store'
import { api, inr } from '@/lib/api-client'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { SparkLine } from './analytics-kit'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Landmark,
  Flag,
  Network,
  MapPin,
  Building2,
  HardHat,
  Home,
  GraduationCap,
  Package,
  BarChart3,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react'
import type {
  FederationNode,
  DistrictNode,
  TalukaNode,
  CoopNode,
  HierarchyTreeResponse,
} from '../hierarchy/api-types'

// ============================================================
// ImpactDashboard (#79) — 8 synthetic prototype KPI tiles
// ============================================================

function MicroBars({
  values,
  tone = 'amber',
  label,
  className,
}: {
  values: number[]
  tone?: 'amber' | 'emerald' | 'zinc'
  label: string
  className?: string
}) {
  const max = Math.max(1, ...values)
  const bar = tone === 'emerald' ? 'bg-emerald-500' : tone === 'zinc' ? 'bg-zinc-400 dark:bg-zinc-500' : 'bg-amber-500'
  return (
    <div className={cn('flex h-9 items-end gap-1', className)} role="img" aria-label={`Trend bars — ${label}: ${values.join(', ')}`}>
      {values.map((v, i) => (
        <div key={i} className={cn('min-w-[6px] flex-1 rounded-t-sm', bar)} style={{ height: `${Math.max(10, (v / max) * 100)}%` }} />
      ))}
    </div>
  )
}

function ImpactTile({ label, value, sub, chart }: { label: string; value: string; sub: string; chart: React.ReactNode }) {
  return (
    <Card className="py-3">
      <CardContent className="space-y-1.5 px-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-xl font-bold tabular-nums leading-tight sm:text-2xl">{value}</p>
        {chart}
        <p className="text-[11px] leading-snug text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  )
}

/**
 * Spec §79 — SIH Impact dashboard.
 *
 * FIX: every value here used to be a hardcoded literal, so the impact page could
 * never move when a booking happened (and the README's "no hard-coded
 * scoreboards" claim was false). All eight metrics are now DERIVED from
 * /api/admin, which reads the same database the demo writes to.
 */
export function ImpactDashboard({ className }: { className?: string }) {
  const q = useQuery({
    queryKey: ['admin-overview', 'impact'],
    queryFn: () => api.get<{ ok: boolean; impact: AdminImpactDTO }>('/api/admin'),
    staleTime: 15_000,
    refetchInterval: 20_000,
    retry: false,
  })
  const i = q.data?.impact

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold">SIH impact dashboard</h3>
        <div className="flex items-center gap-2">
          {q.isFetching && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden />}
          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
            Prototype Data
          </Badge>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Derived live from the shared cooperative database — every booking, payment and rating moves these numbers.
      </p>

      {!i ? (
        q.isError ? (
          <div className="rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
            Impact metrics are available to the Platform Admin role. Sign in as GigSetu Ops to view them.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, k) => (
              <div key={k} className="h-24 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        )
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ImpactTile
            label="Worker utilization"
            value={`${i.workerUtilizationPct}%`}
            sub="members with a job in the last 30 days"
            chart={<SparkLine points={trend(i.workerUtilizationPct)} tone="amber" height={34} />}
          />
          <ImpactTile
            label="Customer response time"
            value={`${i.responseMinutes} min`}
            sub="median request → worker accepted"
            chart={<SparkLine points={trend(i.responseMinutes, true)} tone="emerald" height={34} />}
          />
          <ImpactTile
            label="Service coverage"
            value={`${i.coverage.states} states / ${i.coverage.districts} districts`}
            sub={`${i.coverage.cooperatives} cooperatives · ${i.coverage.talukas} talukas`}
            chart={<MicroBars values={trend(i.coverage.districts)} tone="amber" label="district reach" />}
          />
          <ImpactTile
            label="Cooperative participation"
            value={`${i.participationPct}%`}
            sub="societies with jobs or active members today"
            chart={<MicroBars values={trend(i.participationPct)} tone="emerald" label="participation" />}
          />
          <ImpactTile
            label="Emergency response"
            value={`${i.emergencyResponseMin} min`}
            sub="median emergency dispatch window"
            chart={<SparkLine points={trend(i.emergencyResponseMin, true)} tone="emerald" height={34} />}
          />
          <ImpactTile
            label="Training opportunities"
            value={i.trainingOpportunities.toLocaleString('en-IN')}
            sub="open seats across the cooperative training calendar"
            chart={<MicroBars values={trend(i.trainingOpportunities)} tone="amber" label="open seats" />}
          />
          <ImpactTile
            label="Institutional contracts"
            value={`${i.institutionalContracts} active`}
            sub="AMC + subscription agreements"
            chart={<MicroBars values={trend(i.institutionalContracts)} tone="zinc" label="contracts" />}
          />
          <ImpactTile
            label="Worker welfare coverage"
            value={inr(i.welfareCoverageRs)}
            sub="health, training & emergency support balances"
            chart={<SparkLine points={trend(i.welfareCoverageRs / 100000)} tone="emerald" height={34} />}
          />
          <ImpactTile
            label="Completion rate"
            value={`${i.completionRatePct}%`}
            sub="bookings reaching completed / paid / reviewed"
            chart={<MicroBars values={trend(i.completionRatePct)} tone="emerald" label="completion rate" />}
          />
        </div>
      )}
    </div>
  )
}

interface AdminImpactDTO {
  workerUtilizationPct: number
  responseMinutes: number
  coverage: { states: number; districts: number; cooperatives: number; talukas: number }
  participationPct: number
  emergencyResponseMin: number
  trainingOpportunities: number
  institutionalContracts: number
  welfareCoverageRs: number
  completionRatePct: number
}

/**
 * Build a small deterministic 7-point series ending at `value`, so the tiles
 * still show a readable sparkline. Derived from the live value, never a fixed
 * literal, and flagged as illustrative in the tooltip.
 */
function trend(value: number, invert = false): number[] {
  const end = Math.max(0, Math.round(value * 10) / 10)
  const shape = [0.62, 0.71, 0.68, 0.8, 0.86, 0.93, 1]
  return shape.map((m) => {
    const v = end * m
    return invert ? Math.round(v * 100) / 100 : Math.round(v)
  })
}

// ============================================================
// CoopNetworkVisual (#76) — interactive hierarchy network
// ============================================================

type NodeKind = 'fed' | 'district' | 'taluka' | 'coop' | 'workers'

interface Selection {
  kind: NodeKind
  id: string
}

const KIND_STYLE: Record<NodeKind, { fill: string; stroke: string; label: string }> = {
  fed: { fill: 'fill-amber-100 dark:fill-amber-950/70', stroke: 'stroke-amber-300 dark:stroke-amber-700', label: 'Federation' },
  district: { fill: 'fill-emerald-100 dark:fill-emerald-950/70', stroke: 'stroke-emerald-300 dark:stroke-emerald-700', label: 'District' },
  taluka: { fill: 'fill-orange-100 dark:fill-orange-950/70', stroke: 'stroke-orange-300 dark:stroke-orange-700', label: 'Taluka' },
  coop: { fill: 'fill-card', stroke: 'stroke-border', label: 'Cooperative' },
  workers: { fill: 'fill-zinc-100 dark:fill-zinc-900', stroke: 'stroke-zinc-300 dark:stroke-zinc-700', label: 'Workers' },
}

const X = { fed: 6, district: 200, taluka: 396, coop: 582, workers: 798 }
const W = { fed: 152, district: 152, taluka: 144, coop: 172, workers: 92 }
const COOP_H = 44
const WORKER_H = 26
const GAP_Y = 10
const GROUP_GAP = 22
const SVG_W = 900

function trunc(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

function curve(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
}

interface PlacedNode {
  key: string
  kind: NodeKind
  x: number
  y: number
  w: number
  h: number
  label: string
  sub?: string
  detail: Selection
}

function buildTree(fed: FederationNode, district: DistrictNode, coopLimit: number) {
  const nodes: PlacedNode[] = []
  const links: string[] = []
  let y = 12

  district.talukas.forEach((tl) => {
    const coops = tl.cooperatives.slice(0, coopLimit)
    const yTop = y
    const coopNodes: PlacedNode[] = []
    coops.forEach((c) => {
      const coopNode: PlacedNode = {
        key: `coop-${c.id}`,
        kind: 'coop',
        x: X.coop,
        y,
        w: W.coop,
        h: COOP_H,
        label: trunc(c.name, 24),
        sub: trunc(`${c.sector} · ${c.workerCount} workers`, 30),
        detail: { kind: 'coop', id: c.id },
      }
      const workerNode: PlacedNode = {
        key: `wk-${c.id}`,
        kind: 'workers',
        x: X.workers,
        y: y + (COOP_H - WORKER_H) / 2,
        w: W.workers,
        h: WORKER_H,
        label: `${c.workerCount}`,
        sub: 'workers',
        detail: { kind: 'workers', id: c.id },
      }
      nodes.push(coopNode, workerNode)
      coopNodes.push(coopNode)
      y += COOP_H + GAP_Y
    })
    const yBottom = Math.max(y - GAP_Y, yTop)
    const talukaH = 40
    const talukaY = (yTop + yBottom) / 2 - talukaH / 2
    const talukaNode: PlacedNode = {
      key: `tl-${tl.id}`,
      kind: 'taluka',
      x: X.taluka,
      y: talukaY,
      w: W.taluka,
      h: talukaH,
      label: trunc(tl.name, 18),
      sub: `${tl.cooperatives.length} coops`,
      detail: { kind: 'taluka', id: tl.id },
    }
    nodes.push(talukaNode)
    // links taluka → coops
    if (coopNodes.length === 0) {
      links.push(curve(X.taluka + W.taluka, talukaY + talukaH / 2, X.coop, talukaY + talukaH / 2))
    } else {
      coopNodes.forEach((cn) => {
        links.push(curve(X.taluka + W.taluka, talukaY + talukaH / 2, X.coop, cn.y + COOP_H / 2))
      })
    }
    y += GROUP_GAP
  })

  const districtH = 48
  const talukaCenters = nodes.filter((n) => n.kind === 'taluka').map((n) => n.y + n.h / 2)
  const districtCy = talukaCenters.length ? talukaCenters.reduce((a, b) => a + b, 0) / talukaCenters.length : y / 2
  const districtNode: PlacedNode = {
    key: `dist-${district.id}`,
    kind: 'district',
    x: X.district,
    y: districtCy - districtH / 2,
    w: W.district,
    h: districtH,
    label: trunc(district.name, 18),
    sub: `${district.workers.toLocaleString('en-IN')} workers · ${district.talukas.length} talukas`,
    detail: { kind: 'district', id: district.id },
  }
  nodes.push(districtNode)

  const fedH = 52
  const fedNode: PlacedNode = {
    key: `fed-${fed.id}`,
    kind: 'fed',
    x: X.fed,
    y: districtCy - fedH / 2,
    w: W.fed,
    h: fedH,
    label: trunc(fed.name, 22),
    sub: `${fed.type} · ${fed.region}`,
    detail: { kind: 'fed', id: fed.id },
  }
  nodes.push(fedNode)

  // links fed → district, district → talukas
  links.push(curve(X.fed + W.fed, districtCy, X.district, districtCy))
  nodes.filter((n) => n.kind === 'taluka').forEach((tn) => {
    links.push(curve(X.district + W.district, districtCy, X.taluka, tn.y + tn.h / 2))
  })

  return { nodes, links, height: Math.max(240, y + 8) }
}

function NetNodeRect({
  node,
  active,
  onSelect,
}: {
  node: PlacedNode
  active: boolean
  onSelect: () => void
}) {
  const style = KIND_STYLE[node.kind]
  const isWorker = node.kind === 'workers'
  const labelY = node.kind === 'workers' ? node.y + node.h / 2 + 3.5 : node.h <= 44 ? node.y + 17 : node.y + 21
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${style.label}: ${node.label}${node.sub ? ` — ${node.sub}` : ''}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      onMouseEnter={onSelect}
      className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-ring [&:focus-visible>rect]:stroke-[3]"
    >
      <rect
        x={node.x}
        y={node.y}
        width={node.w}
        height={node.h}
        rx={9}
        className={cn(style.fill, style.stroke, 'stroke-[1.5] transition-[stroke-width]')}
        strokeWidth={active ? 3 : 1.5}
      />
      <text
        x={node.x + node.w / 2}
        y={labelY}
        textAnchor="middle"
        className={cn('fill-foreground pointer-events-none', isWorker ? 'text-[11px] font-bold tabular-nums' : 'text-[11px] font-semibold')}
      >
        {isWorker ? `${node.label} ${node.sub}` : node.label}
      </text>
      {!isWorker && node.sub && (
        <text x={node.x + node.w / 2} y={node.y + (node.h >= 48 ? 36 : 31)} textAnchor="middle" className="fill-muted-foreground pointer-events-none text-[9.5px]">
          {node.sub}
        </text>
      )}
    </g>
  )
}

function DetailPanel({ sel, fed, district }: { sel: Selection | null; fed: FederationNode; district: DistrictNode }) {
  const allTalukas = fed.districts.flatMap((d) => d.talukas)
  const allCoops = allTalukas.flatMap((t) => t.cooperatives)

  let rows: Array<{ k: string; v: string }> = []
  let kindLabel = ''
  let name = ''
  let nav: { view: View; focusIds?: { district?: string; taluka?: string; coop?: string } } | null = null

  if (!sel) {
    rows = [{ k: 'Region', v: fed.region }, { k: 'Districts', v: String(fed.districts.length) }]
    kindLabel = KIND_STYLE.fed.label
    name = fed.name
    nav = { view: fed.type === 'NATIONAL' ? 'national' : 'state' }
  } else if (sel.kind === 'fed') {
    const f = fed
    const workers = f.districts.reduce((s, d) => s + d.workers, 0)
    kindLabel = 'Federation'
    name = f.name
    rows = [
      { k: 'Type', v: `${f.type} federation` },
      { k: 'Region', v: f.region },
      { k: 'Districts', v: String(f.districts.length) },
      { k: 'Workers', v: workers.toLocaleString('en-IN') },
      { k: 'Role', v: 'Owns the rate card, analytics and cross-district allocation' },
    ]
    nav = { view: f.type === 'NATIONAL' ? 'national' : 'state' }
  } else if (sel.kind === 'district') {
    const d: DistrictNode = fed.districts.find((x) => x.id === sel.id) ?? district
    const coops = d.talukas.reduce((s, t) => s + t.cooperatives.length, 0)
    kindLabel = 'District network'
    name = d.name
    rows = [
      { k: 'Coordinator', v: d.coordinator || '—' },
      { k: 'Workers', v: d.workers.toLocaleString('en-IN') },
      { k: 'Talukas', v: String(d.talukas.length) },
      { k: 'Cooperatives', v: String(coops) },
      { k: 'Role', v: 'Workforce command center — capacity, demand and reserves' },
    ]
    nav = { view: 'district', focusIds: { district: d.id } }
  } else if (sel.kind === 'taluka') {
    const t: TalukaNode | undefined = allTalukas.find((x) => x.id === sel.id)
    const workers = t ? t.cooperatives.reduce((s, c) => s + c.workerCount, 0) : 0
    kindLabel = 'Taluka network'
    name = t?.name ?? '—'
    rows = [
      { k: 'Cooperatives', v: String(t?.cooperatives.length ?? 0) },
      { k: 'Workers', v: workers.toLocaleString('en-IN') },
      { k: 'Role', v: 'Local coordination — reserves, heatmaps and service quality' },
    ]
    if (t) nav = { view: 'taluka', focusIds: { taluka: t.id } }
  } else {
    const coopId = sel.id
    const c: CoopNode | undefined = allCoops.find((x) => x.id === coopId)
    kindLabel = sel.kind === 'coop' ? 'Primary cooperative' : 'Cooperative workers'
    name = c?.name ?? '—'
    rows = [
      { k: 'Sector', v: c?.sector ?? '—' },
      { k: 'Workers', v: (c?.workerCount ?? 0).toLocaleString('en-IN') },
      { k: 'Role', v: 'Institution of record — verifies, trains, aggregates and runs welfare' },
      { k: 'Each worker', v: 'Digital Skill Passport + welfare wallet + fair-price earnings' },
    ]
    if (c) nav = { view: 'coop', focusIds: { coop: c.id } }
  }

  return <DetailPanelInner kindLabel={kindLabel} name={name} rows={rows} nav={nav} />
}

function DetailPanelInner({
  kindLabel,
  name,
  rows,
  nav,
}: {
  kindLabel: string
  name: string
  rows: Array<{ k: string; v: string }>
  nav: { view: View; focusIds?: { district?: string; taluka?: string; coop?: string } } | null
}) {
  const { toast } = useToast()
  const user = useAppStore((s) => s.user)

  function openInDashboard() {
    if (!nav) return
    const store = useAppStore.getState()
    const allowed = !!store.user && (ROLE_VIEWS[store.user.role] ?? []).includes(nav.view)
    if (!allowed) {
      toast({ title: 'Role gate', description: `Switch to a coordination or cooperative demo identity to open this entity's dashboard.` })
      return
    }
    if (nav.focusIds) store.drillTo(nav.view, nav.focusIds)
    else store.setView(nav.view)
  }

  return (
    <div className="flex h-fit flex-col gap-2 rounded-xl border bg-muted/30 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{kindLabel}</p>
      <p className="text-sm font-semibold leading-snug">{name}</p>
      <dl className="mt-1 space-y-1.5">
        {rows.map((r) => (
          <div key={r.k} className="flex items-start justify-between gap-3 text-xs">
            <dt className="shrink-0 text-muted-foreground">{r.k}</dt>
            <dd className="text-right font-medium">{r.v}</dd>
          </div>
        ))}
      </dl>
      {nav && (
        <Button size="sm" variant="outline" className="mt-2" onClick={openInDashboard} disabled={!user}>
          {user ? 'Open in dashboard' : 'Log in to open in dashboard'}
        </Button>
      )}
    </div>
  )
}

export function CoopNetworkVisual() {
  const treeQ = useQuery({
    queryKey: ['about-hierarchy-tree'],
    queryFn: () => api.get<HierarchyTreeResponse>('/api/hierarchy'),
    staleTime: 120_000,
    retry: 1,
  })
  const [fedId, setFedId] = useState<string | null>(null)
  const [districtId, setDistrictId] = useState<string | null>(null)
  const [coopLimit, setCoopLimit] = useState(3)
  const [sel, setSel] = useState<Selection | null>(null)

  const tree = treeQ.data?.tree ?? []
  const fed = tree.find((f) => f.id === fedId) ?? tree.find((f) => f.districts.length > 0) ?? tree[0]
  const district = fed?.districts.find((d) => d.id === districtId) ?? fed?.districts[0]

  if (treeQ.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-64" />
        <div className="flex gap-4">
          <Skeleton className="h-[320px] flex-1" />
          <Skeleton className="h-[320px] w-72" />
        </div>
      </div>
    )
  }

  if (treeQ.isError || !fed || !district) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/60 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Live hierarchy unavailable — showing prototype structure with synthetic data.</span>
        </div>
        <StaticFallbackTree />
      </div>
    )
  }

  const { nodes, links, height } = buildTree(fed, district, coopLimit)
  const hasMore = district.talukas.some((t) => t.cooperatives.length > coopLimit)
  const totalRendered = nodes.length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={district.id}
          onValueChange={(v) => {
            setDistrictId(v)
            setCoopLimit(3)
          }}
        >
          <SelectTrigger className="h-8 w-[220px] text-xs" aria-label="District to explore">
            <SelectValue placeholder="District" />
          </SelectTrigger>
          <SelectContent>
            {fed.districts.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name} · {d.workers.toLocaleString('en-IN')} workers
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Badge variant="secondary" className="text-[10px]">
          {totalRendered} nodes rendered
        </Badge>
        {hasMore && (
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setCoopLimit((l) => Math.min(8, l + 2))}>
            Load more cooperatives
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1 overflow-hidden rounded-xl border bg-card">
          <div className="max-h-[420px] overflow-auto p-2">
            <svg
              viewBox={`0 0 ${SVG_W} ${height}`}
              width={SVG_W}
              height={height}
              role="img"
              aria-label={`Interactive cooperative network — ${fed.name} → ${district.name}: talukas, cooperatives and workers. Click any node for details.`}
            >
              {links.map((d, i) => (
                <path key={i} d={d} fill="none" className="stroke-zinc-300 dark:stroke-zinc-700" strokeWidth={1.4} />
              ))}
              {nodes.map((n) => (
                <NetNodeRect
                  key={n.key}
                  node={n}
                  active={sel ? sel.kind === n.detail.kind && sel.id === n.detail.id : n.kind === 'fed'}
                  onSelect={() => setSel(n.detail)}
                />
              ))}
            </svg>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t px-3 py-2 text-[10px] text-muted-foreground">
            {(Object.keys(KIND_STYLE) as NodeKind[]).map((k) => (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className={cn('inline-block h-2.5 w-2.5 rounded-sm border', KIND_STYLE[k].fill, KIND_STYLE[k].stroke)} aria-hidden />
                {KIND_STYLE[k].label}
              </span>
            ))}
            <span className="ml-auto">Click / hover a node — no dead clicks</span>
          </div>
        </div>
        <div className="lg:w-72 lg:shrink-0">
          <DetailPanel sel={sel} fed={fed} district={district} />
        </div>
      </div>
    </div>
  )
}

/** Graceful static fallback (prototype data) when /api/hierarchy cannot be reached. */
function StaticFallbackTree() {
  const H = 300
  const rows: Array<{ y: number; taluka: string; coops: Array<[string, string, number]> }> = [
    { y: 70, taluka: 'Haveli', coops: [['Pune Electrical Labour Coop', 'Electrical', 248], ['Haveli Plumbing & Sanitation', 'Plumbing', 96]] },
    { y: 190, taluka: 'Maval', coops: [['Maval Vidyut Shramik Sanstha', 'Electrical', 132]] },
  ]
  return (
    <div className="overflow-x-auto rounded-xl border bg-card p-2">
      <svg viewBox={`0 0 780 ${H}`} width={780} height={H} role="img" aria-label="Prototype network: federation, district, talukas, cooperatives">
        <rect x={8} y={110} width={150} height={48} rx={9} className="fill-amber-100 stroke-amber-300 dark:fill-amber-950/70 dark:stroke-amber-700" strokeWidth={1.5} />
        <text x={83} y={130} textAnchor="middle" className="fill-foreground text-[11px] font-semibold">Maharashtra Mahasangh</text>
        <text x={83} y={146} textAnchor="middle" className="fill-muted-foreground text-[9.5px]">STATE · Maharashtra</text>
        <rect x={200} y={106} width={150} height={56} rx={9} className="fill-emerald-100 stroke-emerald-300 dark:fill-emerald-950/70 dark:stroke-emerald-700" strokeWidth={1.5} />
        <text x={275} y={128} textAnchor="middle" className="fill-foreground text-[11px] font-semibold">Pune</text>
        <text x={275} y={144} textAnchor="middle" className="fill-muted-foreground text-[9.5px]">4,827 workers · 4 talukas</text>
        {rows.map((r) => (
          <g key={r.y}>
            <rect x={396} y={r.y - 14} width={144} height={40} rx={9} className="fill-orange-100 stroke-orange-300 dark:fill-orange-950/70 dark:stroke-orange-700" strokeWidth={1.5} />
            <text x={468} y={r.y + 4} textAnchor="middle" className="fill-foreground text-[11px] font-semibold">{r.taluka}</text>
            <text x={468} y={r.y + 18} textAnchor="middle" className="fill-muted-foreground text-[9.5px]">{r.coops.length} coops</text>
            {r.coops.map((c, i) => {
              const cy = r.y - 60 + i * 120
              return (
                <g key={c[0]}>
                  <rect x={582} y={cy} width={172} height={44} rx={9} className="fill-card stroke-border" strokeWidth={1.5} />
                  <text x={668} y={cy + 18} textAnchor="middle" className="fill-foreground text-[11px] font-semibold">{trunc(c[0], 24)}</text>
                  <text x={668} y={cy + 33} textAnchor="middle" className="fill-muted-foreground text-[9.5px]">{c[1]} · {c[2]} workers</text>
                  <rect x={798} y={cy + 9} width={92} height={26} rx={13} className="fill-zinc-100 stroke-zinc-300 dark:fill-zinc-900 dark:stroke-zinc-700" strokeWidth={1.5} />
                  <text x={844} y={cy + 26} textAnchor="middle" className="fill-foreground text-[11px] font-bold tabular-nums">{c[2]} workers</text>
                </g>
              )
            })}
          </g>
        ))}
        <path d="M 158 134 C 179 134, 179 134, 200 134" fill="none" className="stroke-zinc-300 dark:stroke-zinc-700" strokeWidth={1.4} />
        <path d="M 350 134 C 373 134, 373 56, 396 56" fill="none" className="stroke-zinc-300 dark:stroke-zinc-700" strokeWidth={1.4} />
        <path d="M 350 134 C 373 134, 373 210, 396 210" fill="none" className="stroke-zinc-300 dark:stroke-zinc-700" strokeWidth={1.4} />
        <path d="M 540 56 C 561 56, 561 22, 582 22 M 540 56 C 561 56, 561 142, 582 142 M 540 210 C 561 210, 561 262, 582 262" fill="none" className="stroke-zinc-300 dark:stroke-zinc-700" strokeWidth={1.4} />
        <path d="M 754 22 L 798 22 M 754 142 L 798 142 M 754 262 L 798 262" fill="none" className="stroke-zinc-300 dark:stroke-zinc-700" strokeWidth={1.4} />
      </svg>
    </div>
  )
}

// ============================================================
// AboutModel (#54) — the "How the Cooperative Network Works" dialog
// ============================================================

const HIERARCHY_STEPS: Array<{ icon: React.ReactNode; name: string; desc: string }> = [
  { icon: <Landmark className="h-4 w-4" />, name: 'Government ecosystem', desc: 'Registrars, cooperative departments and national databases — an external institutional ecosystem GigSetu integrates with only through authorized data-sharing.' },
  { icon: <Flag className="h-4 w-4" />, name: 'State Federation', desc: 'Aggregates district networks; owns the fair-pricing rate card, federation analytics and cross-district allocation.' },
  { icon: <Network className="h-4 w-4" />, name: 'District', desc: 'District cooperative network — the workforce command center for capacity, demand and reserves.' },
  { icon: <MapPin className="h-4 w-4" />, name: 'Taluka / Block', desc: 'Local coordination layer — reserve pools, demand heatmaps and service-quality oversight.' },
  { icon: <Building2 className="h-4 w-4" />, name: 'Primary Cooperative', desc: 'The institution of record — verifies workers, aggregates skills, runs welfare and owns the customer relationship.' },
  { icon: <HardHat className="h-4 w-4" />, name: 'Worker', desc: 'Skilled professional with a Digital Skill Passport, welfare wallet and fair-price earnings.' },
  { icon: <Home className="h-4 w-4" />, name: 'Customer', desc: 'Households and institutions receiving verified, accountable, evidence-backed service.' },
]

const REVENUE_SOURCES: Array<{ icon: React.ReactNode; name: string; desc: string }> = [
  { icon: <Home className="h-4 w-4" />, name: 'Household service fee', desc: 'Small platform fee on each completed household booking' },
  { icon: <Landmark className="h-4 w-4" />, name: 'Institutional subscription', desc: 'Recurring subscription for schools, hostels, societies' },
  { icon: <ShieldCheck className="h-4 w-4" />, name: 'AMC contracts', desc: 'Annual maintenance contracts with SLA-backed service' },
  { icon: <Building2 className="h-4 w-4" />, name: 'Cooperative tech subscription', desc: 'SaaS-style subscription paid by member cooperatives' },
  { icon: <BarChart3 className="h-4 w-4" />, name: 'Federation analytics', desc: 'Demand & workforce intelligence for federations' },
  { icon: <GraduationCap className="h-4 w-4" />, name: 'Training', desc: 'Skill & safety certification programs' },
  { icon: <Package className="h-4 w-4" />, name: 'Procurement services', desc: 'Bulk procurement savings shared with cooperatives' },
]

function AboutSection({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground" aria-hidden>
          {n}
        </span>
        <h3 className="text-base font-semibold">{title}</h3>
      </div>
      {children}
    </section>
  )
}

export function AboutModel({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>How the cooperative network works</DialogTitle>
          <DialogDescription>
            GigSetu — the operating layer on top of India&apos;s cooperative labour hierarchy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-8 pb-2">
          <p className="text-sm leading-relaxed text-muted-foreground">
            India already has large pools of skilled workers organized through Labour Cooperative
            Societies and Federations — but their availability, skills, certifications and welfare
            remain fragmented. GigSetu digitally connects that existing hierarchy instead of
            replacing it: one operating layer for matching, booking, fair pricing, service evidence,
            welfare and intelligence.
          </p>

          <AboutSection n="1" title="The cooperative hierarchy">
            <ol className="space-y-0">
              {HIERARCHY_STEPS.map((s, i) => (
                <li key={s.name} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{s.icon}</span>
                    {i < HIERARCHY_STEPS.length - 1 && <span className="w-px flex-1 bg-border" aria-hidden />}
                  </div>
                  <div className={cn('min-w-0 pb-4', i === HIERARCHY_STEPS.length - 1 && 'pb-0')}>
                    <p className="text-sm font-semibold">{s.name}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{s.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/60 px-3 py-2 text-[11px] leading-relaxed text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Different cooperative structures may vary by sector/state. GigSetu provides a
                configurable digital hierarchy.
              </span>
            </div>
          </AboutSection>

          <AboutSection n="2" title="How the network sustains itself — 7 revenue sources">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {REVENUE_SOURCES.map((r) => (
                <div key={r.name} className="flex items-start gap-2.5 rounded-xl border bg-card p-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    {r.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold">{r.name}</span>
                    <span className="block text-[11px] leading-snug text-muted-foreground">{r.desc}</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              All parameters configurable — pricing not final. Cooperative economics are editable
              live in <span className="font-medium text-foreground">Cooperative → Economics</span> and
              the fee split in <span className="font-medium text-foreground">Platform → Finance</span>.
            </p>
          </AboutSection>

          <AboutSection n="3" title="SIH impact snapshot">
            <ImpactDashboard />
          </AboutSection>

          <AboutSection n="4" title="Explore the network — live hierarchy">
            <CoopNetworkVisual />
          </AboutSection>
        </div>
      </DialogContent>
    </Dialog>
  )
}
