'use client'

// GigSetu Phase 5 — Map & Geo-spatial system (#42), Task 14-e
// Stylized interactive SVG map over the Pune service grid (AREA_COORDS is the
// source of truth). NO external map tiles, NO API keys — pan/zoom is plain
// pointer-event math on a <g transform>.

import { useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import { t } from '@/lib/i18n'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import type { DemoUser, GeoDTO } from '@/lib/types'
import { KpiCard, SectionCard, PrototypeNotice, AvailDot, EmptyState } from './ui-kit'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { MapPin, Briefcase, Building2, Minus, Plus, RotateCcw, RefreshCw, User, Loader2 } from 'lucide-react'

type Pin = GeoDTO['pins'][number]
type Zone = GeoDTO['zones'][number]

type CtxKey = 'customer' | 'coop' | 'district' | 'federation'

const CTX_API_ROLE: Record<CtxKey, string> = { customer: 'CUSTOMER', coop: 'COOP', district: 'DISTRICT', federation: 'FEDERATION' }
const CTX_LABEL_KEY: Record<CtxKey, string> = { customer: 'gmCtxCustomer', coop: 'gmCtxCoop', district: 'gmCtxDistrict', federation: 'gmCtxFederation' }

function contextsForRole(role: DemoUser['role']): CtxKey[] {
  switch (role) {
    case 'CUSTOMER':
    case 'INSTITUTION':
      return ['customer']
    case 'COOP_ADMIN':
    case 'TALUKA_COORD':
    case 'DISTRICT_COORD':
      return ['coop', 'district']
    default:
      // STATE_ADMIN / NATIONAL_ADMIN / PLATFORM_ADMIN
      return ['district', 'federation']
  }
}

const PXU = 40 // px per grid unit
const DEFAULT_BOUNDS = { minX: -0.5, minY: -0.5, maxX: 16.5, maxY: 13.5 }
const ZOOM_MIN = 1
const ZOOM_MAX = 4

const KIND_ICON: Record<string, React.ReactNode> = {
  WORKER: <User className="h-3.5 w-3.5" />,
  JOB: <Briefcase className="h-3.5 w-3.5" />,
  COOP: <Building2 className="h-3.5 w-3.5" />,
}

function LegendDot({ dotClass, label }: { dotClass: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn('inline-block h-2.5 w-2.5 rounded-full', dotClass)} />
      <span className="text-muted-foreground">{label}</span>
    </span>
  )
}

export function GeoMap({ user }: { user: DemoUser }) {
  const lang = useAppStore((s) => s.lang)
  const { toast } = useToast()
  const qc = useQueryClient()
  const contexts = useMemo(() => contextsForRole(user.role), [user.role])
  const [ctx, setCtx] = useState<CtxKey>(contexts[0])
  const [vf, setVf] = useState({ z: 1, x: 0, y: 0 })
  const [hover, setHover] = useState<Pin | null>(null)
  const [selected, setSelected] = useState<Pin | null>(null)
  const [dispatching, setDispatching] = useState(false)
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  // Featured cooperative id for the COOP context (never hardcode cuids).
  const coopRefQ = useQuery({
    queryKey: ['geo-coop-ref'],
    queryFn: () => api.get<{ ok: boolean; cooperative: { id: string } }>('/api/coop'),
    enabled: ctx === 'coop',
    staleTime: 60000,
  })

  const apiRole = CTX_API_ROLE[ctx]
  // FIX: the district was hardcoded to 'Pune' for every role, so a Nashik or
  // Nagpur coordinator only ever saw Pune. Use the signed-in district, falling
  // back to the district the user actually belongs to.
  const myDistrictQ = useQuery({
    queryKey: ['geo-my-district', user.districtId ?? '', user.federationId ?? ''],
    queryFn: async () => {
      if (user.districtId) {
        const d = await api.get<{ districts: Array<{ id: string; name: string }> }>('/api/districts')
        const hit = d.districts.find((x) => x.id === user.districtId)
        return hit?.name ?? ''
      }
      const f = await api.get<{ ok: boolean; rows: Array<{ districts: Array<{ id: string; name: string }> }> }>('/api/hierarchy')
      return f.rows?.[0]?.districts?.[0]?.name ?? ''
    },
    staleTime: 300000,
    enabled: ctx === 'district',
  })
  const refId = ctx === 'coop' ? (coopRefQ.data?.cooperative.id ?? '') : ctx === 'district' ? (myDistrictQ.data || 'Pune') : ''
  const geoQ = useQuery({
    queryKey: ['geo', apiRole, refId],
    queryFn: () => api.get<GeoDTO>(`/api/geo?role=${apiRole}&refId=${encodeURIComponent(refId)}`),
    enabled: ctx !== 'coop' || !!refId,
    refetchInterval: 30000,
  })

  const bounds = geoQ.data?.bounds ?? DEFAULT_BOUNDS
  const VW = Math.round((bounds.maxX - bounds.minX) * PXU)
  const VH = Math.round((bounds.maxY - bounds.minY) * PXU)
  const px = (x: number) => (x - bounds.minX) * PXU
  const py = (y: number) => (y - bounds.minY) * PXU

  const pins = geoQ.data?.pins ?? []
  const zones = geoQ.data?.zones ?? []
  const workerPins = useMemo(() => pins.filter((p) => p.kind === 'WORKER'), [pins])
  const kinds = useMemo(
    () => ({
      worker: pins.some((p) => p.kind === 'WORKER'),
      job: pins.some((p) => p.kind === 'JOB'),
      coop: pins.some((p) => p.kind === 'COOP'),
      demand: zones.some((z) => z.kind === 'DEMAND'),
      service: zones.some((z) => z.kind === 'SERVICE'),
      emergency: zones.some((z) => z.kind === 'EMERGENCY'),
    }),
    [pins, zones]
  )

  // grid lines (1 unit apart)
  const gridX = useMemo(() => {
    const xs: number[] = []
    for (let x = Math.ceil(bounds.minX); x <= Math.floor(bounds.maxX); x++) xs.push(x)
    return xs
  }, [bounds])
  const gridY = useMemo(() => {
    const ys: number[] = []
    for (let y = Math.ceil(bounds.minY); y <= Math.floor(bounds.maxY); y++) ys.push(y)
    return ys
  }, [bounds])

  function clampVf(z: number, x: number, y: number) {
    const zz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z))
    return {
      z: zz,
      x: Math.min(0, Math.max(VW * (1 - zz), x)),
      y: Math.min(0, Math.max(VH * (1 - zz), y)),
    }
  }

  const zoomBy = (f: number) =>
    setVf((v) => {
      const nz = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, v.z * f))
      const cx = VW / 2
      const cy = VH / 2
      return clampVf(nz, cx - (cx - v.x) * (nz / v.z), cy - (cy - v.y) * (nz / v.z))
    })

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.button !== 0) return
    svgRef.current?.setPointerCapture(e.pointerId)
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: vf.x, oy: vf.y }
  }
  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const d = dragRef.current
    if (!d || !svgRef.current) return
    const r = svgRef.current.getBoundingClientRect()
    const scale = Math.min(r.width / VW, r.height / VH) || 1
    const k = 1 / scale
    setVf((v) => clampVf(v.z, d.ox + (e.clientX - d.sx) * k, d.oy + (e.clientY - d.sy) * k))
  }
  function endDrag() {
    dragRef.current = null
  }

  // Tooltip in screen-space svg coords (outside the zoom/pan transform).
  const tip = useMemo(() => {
    if (!hover) return null
    const x = px(hover.x) * vf.z + vf.x
    const y = py(hover.y) * vf.z + vf.y
    const w = 190
    const h = 50
    let tx = x + 14
    if (tx + w > VW - 4) tx = x - w - 14
    let ty = y - h - 12
    if (ty < 4) ty = y + 14
    if (tx < 4) tx = 4
    return { x: tx, y: ty, w, h }
  }, [hover, vf, VW])

  const mapLoading = geoQ.isLoading || (ctx === 'coop' && coopRefQ.isLoading)
  const mapReady = !mapLoading && !geoQ.isError

  const summary = geoQ.data?.summary

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border bg-card p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
              <MapPin className="h-5 w-5 text-primary" /> {t('gmTitle', lang)}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">{t('gmSub', lang)}</p>
            <p className="mt-1 text-[11px] text-muted-foreground/70">{t('gmPanHint', lang)}</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <span className="hidden text-xs font-medium text-muted-foreground md:inline">{t('gmCtx', lang)}</span>
              <Select value={ctx} onValueChange={(v) => { setCtx(v as CtxKey); setSelected(null); setHover(null); setVf({ z: 1, x: 0, y: 0 }) }}>
                <SelectTrigger className="h-10 w-full text-xs sm:w-[170px]" aria-label={t('gmCtx', lang)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {contexts.map((c) => (
                    <SelectItem key={c} value={c} className="text-xs">{t(CTX_LABEL_KEY[c], lang)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" size="sm" className="h-10 gap-1.5 text-xs" onClick={() => geoQ.refetch()} disabled={geoQ.isFetching}>
              <RefreshCw className={cn('h-3.5 w-3.5', geoQ.isFetching && 'animate-spin')} /> {t('gmRefresh', lang)}
            </Button>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label={t('gmKpiWorkers', lang)} value={summary ? summary.workers.toLocaleString('en-IN') : '—'} icon={<User className="h-4 w-4" />} />
        <KpiCard label={t('gmKpiAvailable', lang)} value={summary ? summary.available.toLocaleString('en-IN') : '—'} tone="success" icon={<User className="h-4 w-4" />} />
        <KpiCard label={t('gmKpiJobs', lang)} value={summary ? summary.jobs.toLocaleString('en-IN') : '—'} tone="warning" icon={<Briefcase className="h-4 w-4" />} />
        <KpiCard label={t('gmKpiEmergency', lang)} value={summary ? summary.emergencyZones.toLocaleString('en-IN') : '—'} tone={summary && summary.emergencyZones > 0 ? 'danger' : 'default'} icon={<MapPin className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Map canvas */}
        <div className="space-y-3">
          <div className="relative h-[60vh] overflow-hidden rounded-2xl border bg-zinc-50 dark:bg-zinc-950 lg:h-[560px]">
            {mapLoading && (
              <div className="flex h-full items-center justify-center p-6">
                <Skeleton className="h-full w-full rounded-xl" />
              </div>
            )}
            {geoQ.isError && (
              <div className="flex h-full items-center justify-center p-6">
                <EmptyState
                  icon={<MapPin className="h-8 w-8" />}
                  title={t('gmErr', lang)}
                  action={
                    <Button size="sm" className="h-10" onClick={() => geoQ.refetch()}>
                      {t('gmRetry', lang)}
                    </Button>
                  }
                />
              </div>
            )}
            {mapReady && (
              <svg
                ref={svgRef}
                viewBox={`0 0 ${VW} ${VH}`}
                preserveAspectRatio="xMidYMid meet"
                className="h-full w-full cursor-grab touch-none select-none active:cursor-grabbing"
                role="img"
                aria-label={`${t('gmMapAria', lang)} — ${geoQ.data?.title ?? ''}`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onPointerLeave={() => { endDrag(); setHover(null) }}
              >
                {/* canvas background (outside the transform so zoom never reveals gaps) */}
                <rect x={0} y={0} width={VW} height={VH} className="fill-zinc-50 dark:fill-zinc-950" />
                <g transform={`translate(${vf.x} ${vf.y}) scale(${vf.z})`}>
                  {/* decorative roads — keep it schematic, no tiles */}
                  <g className="stroke-zinc-200 dark:stroke-zinc-800" fill="none" strokeLinecap="round">
                    <path d="M 30 500 C 160 450, 250 480, 330 380 S 500 250, 655 290" strokeWidth={9} />
                    <path d="M 55 60 C 150 140, 240 130, 330 210 S 470 330, 610 390" strokeWidth={7} />
                    <path d="M 120 30 C 200 120, 380 110, 520 60" strokeWidth={5} />
                    <path d="M 40 220 C 180 240, 300 180, 420 220 S 600 180, 660 150" strokeWidth={4} opacity={0.8} />
                    <circle cx={340} cy={290} r={165} strokeWidth={6} strokeDasharray="1 14" />
                  </g>
                  {/* grid lines */}
                  <g className="stroke-zinc-200/80 dark:stroke-zinc-800/80" strokeWidth={1}>
                    {gridX.map((gx) => <line key={`gx${gx}`} x1={px(gx)} y1={0} x2={px(gx)} y2={VH} />)}
                    {gridY.map((gy) => <line key={`gy${gy}`} x1={0} y1={py(gy)} x2={VW} y2={py(gy)} />)}
                  </g>
                  {/* zones */}
                  {zones.map((z) => (
                    <g key={z.key} pointerEvents="none">
                      <circle
                        cx={px(z.x)}
                        cy={py(z.y)}
                        r={Math.max(9, z.r * PXU)}
                        strokeWidth={1.5}
                        strokeDasharray={z.kind === 'EMERGENCY' ? '6 4' : undefined}
                        className={cn(
                          z.kind === 'EMERGENCY'
                            ? 'fill-red-500/15 stroke-red-500'
                            : z.kind === 'SERVICE'
                              ? 'fill-emerald-500/10 stroke-emerald-500/50'
                              : 'fill-amber-500/15 stroke-amber-500/50'
                        )}
                      />
                      <text
                        x={px(z.x)}
                        y={py(z.y) - 4}
                        textAnchor="middle"
                        className={cn(
                          'text-[10px] font-semibold',
                          z.kind === 'EMERGENCY'
                            ? 'fill-red-600 dark:fill-red-400'
                            : z.kind === 'SERVICE'
                              ? 'fill-emerald-700 dark:fill-emerald-400'
                              : 'fill-amber-700 dark:fill-amber-300'
                        )}
                      >
                        {z.label}
                      </text>
                      <text x={px(z.x)} y={py(z.y) + 8} textAnchor="middle" className="fill-zinc-500 dark:fill-zinc-400 text-[9px] font-medium">
                        {z.level}
                      </text>
                    </g>
                  ))}
                  {/* pins */}
                  {pins.map((p) => {
                    const isSel = selected?.id === p.id
                    const common = {
                      onMouseEnter: () => setHover(p),
                      onMouseLeave: () => setHover((h) => (h?.id === p.id ? null : h)),
                      onClick: () => setSelected(p),
                      className: 'cursor-pointer',
                    }
                    if (p.kind === 'WORKER') {
                      return (
                        <g key={p.id} {...common}>
                          {isSel && <circle cx={px(p.x)} cy={py(p.y)} r={10} fill="none" className="stroke-foreground" strokeWidth={1.5} strokeDasharray="3 3" />}
                          <circle cx={px(p.x)} cy={py(p.y)} r={14} fill="transparent" />
                          <circle
                            cx={px(p.x)}
                            cy={py(p.y)}
                            r={6}
                            stroke="var(--color-background)"
                            strokeWidth={1.5}
                            className={cn(p.status === 'AVAILABLE' ? 'fill-emerald-500' : p.status === 'BUSY' ? 'fill-amber-500' : 'fill-zinc-400')}
                          />
                        </g>
                      )
                    }
                    if (p.kind === 'JOB') {
                      return (
                        <g key={p.id} {...common}>
                          {isSel && <rect x={px(p.x) - 10} y={py(p.y) - 10} width={20} height={20} rx={4} fill="none" className="stroke-foreground" strokeWidth={1.5} strokeDasharray="3 3" />}
                          <rect x={px(p.x) - 11} y={py(p.y) - 11} width={22} height={22} fill="transparent" />
                          <rect x={px(p.x) - 5.5} y={py(p.y) - 5.5} width={11} height={11} rx={2} className="fill-amber-500" stroke="var(--color-background)" strokeWidth={1.5} />
                        </g>
                      )
                    }
                    return (
                      <g key={p.id} {...common}>
                        {isSel && <circle cx={px(p.x)} cy={py(p.y)} r={17} fill="none" className="stroke-foreground" strokeWidth={1.5} strokeDasharray="3 3" />}
                        <circle cx={px(p.x)} cy={py(p.y)} r={24} fill="transparent" />
                        <circle cx={px(p.x)} cy={py(p.y)} r={13} className="fill-primary" stroke="var(--color-background)" strokeWidth={2} />
                        <text x={px(p.x)} y={py(p.y) + 3.5} textAnchor="middle" className="fill-primary-foreground text-[10px] font-bold tabular-nums" pointerEvents="none">
                          {p.value ?? 0}
                        </text>
                      </g>
                    )
                  })}
                </g>
                {/* hover tooltip — screen space */}
                {tip && hover && (
                  <g pointerEvents="none">
                    <rect x={tip.x} y={tip.y} width={tip.w} height={tip.h} rx={8} className="fill-background stroke-border" strokeWidth={1} />
                    <text x={tip.x + 10} y={tip.y + 19} className="fill-foreground text-[11px] font-semibold">
                      {hover.label.length > 30 ? `${hover.label.slice(0, 29)}…` : hover.label}
                    </text>
                    <text x={tip.x + 10} y={tip.y + 35} className="fill-zinc-500 dark:fill-zinc-400 text-[10px]">
                      {hover.sub.length > 38 ? `${hover.sub.slice(0, 37)}…` : hover.sub} · {hover.area}
                    </text>
                  </g>
                )}
              </svg>
            )}

            {/* Zoom controls — 44px touch targets */}
            {mapReady && (
              <div className="absolute right-3 top-3 flex flex-col gap-1.5">
                <Button variant="outline" size="icon" className="h-11 w-11 bg-background/95 shadow-sm" onClick={() => zoomBy(1.3)} disabled={vf.z >= ZOOM_MAX} aria-label={t('gmZoomIn', lang)}>
                  <Plus className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-11 w-11 bg-background/95 shadow-sm" onClick={() => zoomBy(1 / 1.3)} disabled={vf.z <= ZOOM_MIN} aria-label={t('gmZoomOut', lang)}>
                  <Minus className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-11 w-11 bg-background/95 shadow-sm" onClick={() => setVf({ z: 1, x: 0, y: 0 })} disabled={vf.z === 1 && vf.x === 0 && vf.y === 0} aria-label={t('gmZoomReset', lang)}>
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Legend (role/kind aware) */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border bg-card px-4 py-3 text-xs">
            <span className="font-semibold">{t('gmLegend', lang)}</span>
            {kinds.worker && (
              <>
                <LegendDot dotClass="bg-emerald-500" label={t('gmLGAvail', lang)} />
                <LegendDot dotClass="bg-amber-500" label={t('gmLGBusy', lang)} />
                <LegendDot dotClass="bg-zinc-400" label={t('gmLGOffline', lang)} />
              </>
            )}
            {kinds.job && <LegendDot dotClass="rounded-[2px] bg-amber-500" label={t('gmLGJob', lang)} />}
            {kinds.coop && <LegendDot dotClass="bg-primary" label={t('gmLGCoop', lang)} />}
            {kinds.demand && <LegendDot dotClass="border border-amber-500/70 bg-amber-500/25" label={t('gmLGDemand', lang)} />}
            {kinds.service && <LegendDot dotClass="border border-emerald-500/60 bg-emerald-500/20" label={t('gmLGService', lang)} />}
            {kinds.emergency && <LegendDot dotClass="border-2 border-dashed border-red-500 bg-red-500/15" label={t('gmLGEmergency', lang)} />}
          </div>

          <PrototypeNotice>
            {t('gmNoteCap', lang)}
            {geoQ.data?.note ? ` ${geoQ.data.note}` : ''}
          </PrototypeNotice>
        </div>

        {/* Side panel */}
        <SectionCard title={t('gmPanelTitle', lang)} description={geoQ.data?.title}>
          {selected ? (
            <div className="rounded-xl border p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-semibold">{selected.label}</p>
                <Badge variant="outline" className="gap-1 border-primary/30 bg-accent text-primary">
                  {KIND_ICON[selected.kind] ?? <MapPin className="h-3.5 w-3.5" />} {selected.kind}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{selected.sub}</p>
              <dl className="mt-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-muted-foreground">{t('gmLblArea', lang)}</dt>
                  <dd className="font-medium">{selected.area}</dd>
                </div>
                {selected.kind === 'WORKER' && selected.status && (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">{t('gmLblStatus', lang)}</dt>
                    <dd className="flex items-center gap-1.5 font-medium">
                      <AvailDot availability={selected.status} /> {selected.status}
                    </dd>
                  </div>
                )}
                {selected.kind === 'WORKER' && selected.skill && (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">{t('gmLblSkill', lang)}</dt>
                    <dd className="font-medium capitalize">{selected.skill}</dd>
                  </div>
                )}
                {selected.kind === 'COOP' && typeof selected.value === 'number' && (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-muted-foreground">{t('gmLblJobs', lang)}</dt>
                    <dd className="font-bold tabular-nums text-primary">{selected.value.toLocaleString('en-IN')}</dd>
                  </div>
                )}
              </dl>
              {selected.kind === 'WORKER' && (
                <div className="mt-3 border-t border-dashed pt-3">
                  {/* FIX: this was a permanently `disabled` primary button with no
                      handler — the single most visible dead affordance in the app.
                      It now creates a REAL emergency booking through the cooperative
                      engine, and the map + dashboards update. */}
                  <Button
                    size="sm"
                    className="h-10 w-full gap-1.5"
                    disabled={dispatching || !user.customerId}
                    onClick={async () => {
                      if (dispatching) return
                      setDispatching(true)
                      try {
                        const res = await api.post<{ ok: boolean; booking?: { refCode: string; status: string }; dispatchedFrom?: string | null }>('/api/emergency', {
                          dispatch: true,
                          customerId: user.customerId,
                          categoryKey: selected.skill || 'plumber',
                          area: selected.area,
                          title: `Urgent ${selected.skill || 'service'} — ${selected.area}`,
                          description: `Dispatched from the cooperative map for ${selected.label}.`,
                        })
                        await qc.invalidateQueries()
                        toast({
                          title: `${t('gmDispatch', lang)} · ${res.booking?.refCode ?? ''}`,
                          description: res.dispatchedFrom
                            ? `${selected.label} assigned via ${res.dispatchedFrom}. Track it in your bookings.`
                            : `${selected.label} has been notified and will be assigned shortly.`,
                        })
                        setSelected(null)
                      } catch (e) {
                        toast({ title: t('gmDispatch', lang), description: (e as Error).message, variant: 'destructive' })
                      } finally {
                        setDispatching(false)
                      }
                    }}
                  >
                    {dispatching ? <Loader2 className="h-4 w-4 animate-spin" /> : <User className="h-4 w-4" />} {t('gmDispatch', lang)}
                  </Button>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{t('gmDispatchNote', lang)}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('gmPanelHint', lang)}</p>
          )}

          <p className="mb-2 mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t('gmWorkersNearby', lang)} {workerPins.length > 0 && <span className="tabular-nums">({workerPins.length})</span>}
          </p>
          <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-700">
            {workerPins.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">{t('ncEmpty', lang)}</p>
            ) : (
              workerPins.slice(0, 60).map((w) => (
                <button
                  key={w.id}
                  onClick={() => setSelected(w)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg border p-2 text-left transition hover:bg-accent/60',
                    selected?.id === w.id && 'border-primary/50 bg-accent'
                  )}
                >
                  <AvailDot availability={w.status ?? 'OFFLINE'} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">{w.label}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">{w.sub} · {w.area}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
