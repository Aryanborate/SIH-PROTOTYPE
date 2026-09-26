'use client'

// GigSetu Phase 5 — Analytics kit (#55), Task 14-e
// Dependency-free SVG chart primitives for the platform admin panel and
// future dashboards. Amber/emerald/zinc palette, dark-mode aware, aria-labelled.

import { useAppStore } from '@/store/app-store'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export interface ChartDatum {
  label: string
  value: number
}

/** Default donut/dot palette — amber, emerald, zinc, orange, red, yellow. NO indigo/blue. */
export const CHART_PALETTE = [
  'bg-amber-500',
  'bg-emerald-500',
  'bg-zinc-400',
  'bg-orange-400',
  'bg-red-400',
  'bg-yellow-500',
]

export const DONUT_STROKE_PALETTE = [
  'stroke-amber-500',
  'stroke-emerald-500',
  'stroke-zinc-400',
  'stroke-orange-400',
  'stroke-red-400',
  'stroke-yellow-500',
]

// ---------- ChartLegend ----------

export interface LegendItem {
  label: string
  /** Optional formatted value shown next to the label (tabular-nums). */
  value?: string
  /** Tailwind bg-* class for the swatch; falls back to the shared palette. */
  dotClass?: string
}

export function ChartLegend({ items, className }: { items: LegendItem[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap gap-x-4 gap-y-1.5', className)} aria-hidden={false}>
      {items.map((it, i) => (
        <li key={`${it.label}-${i}`} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span aria-hidden className={cn('inline-block h-2.5 w-2.5 shrink-0 rounded-full', it.dotClass ?? CHART_PALETTE[i % CHART_PALETTE.length])} />
          <span className="truncate">{it.label}</span>
          {it.value !== undefined && <span className="font-semibold tabular-nums text-foreground">{it.value}</span>}
        </li>
      ))}
    </ul>
  )
}

// ---------- BarChartMini ----------

/**
 * Compact vertical bar chart. Amber bars by default, value labels above each
 * bar, category labels below. Pure SVG, no chart library.
 */
export function BarChartMini({
  data,
  height = 150,
  tone = 'amber',
  className,
}: {
  data: ChartDatum[]
  height?: number
  tone?: 'amber' | 'emerald' | 'zinc'
  className?: string
}) {
  const lang = useAppStore((s) => s.lang)
  const max = Math.max(1, ...data.map((d) => d.value))
  const slot = 48 // horizontal px per bar
  const W = Math.max(slot, data.length * slot)
  const H = height
  const barW = 26
  const topPad = 18 // room for the value label
  const botPad = 18 // room for the category label
  const plotH = Math.max(4, H - topPad - botPad)
  const fill = tone === 'emerald' ? 'fill-emerald-500' : tone === 'zinc' ? 'fill-zinc-400 dark:fill-zinc-500' : 'fill-amber-500'
  const aria = `${t('akAriaBars', lang)}: ${data.map((d) => `${d.label} ${d.value}`).join(', ')}`

  return (
    <div className={cn('w-full', className)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={aria}>
        {/* faint horizontal gridlines */}
        <g className="stroke-zinc-200 dark:stroke-zinc-800" strokeWidth={1} strokeDasharray="3 4">
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={4} y1={topPad + plotH * f} x2={W - 4} y2={topPad + plotH * f} />
          ))}
        </g>
        {data.map((d, i) => {
          const cx = i * slot + slot / 2
          const barH = Math.max(0, (d.value / max) * plotH)
          const y = topPad + plotH - barH
          return (
            <g key={`${d.label}-${i}`}>
              {d.value > 0 ? (
                <rect x={cx - barW / 2} y={y} width={barW} height={Math.max(2, barH)} rx={4} className={fill} />
              ) : (
                <rect x={cx - barW / 2} y={topPad + plotH - 2} width={barW} height={2} rx={1} className="fill-zinc-200 dark:fill-zinc-800" />
              )}
              <text x={cx} y={y - 5} textAnchor="middle" className="fill-foreground text-[11px] font-bold tabular-nums">
                {d.value}
              </text>
              <text x={cx} y={H - 5} textAnchor="middle" className="fill-zinc-500 dark:fill-zinc-400 text-[10px]">
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ---------- StackedBar ----------

export interface StackSegment {
  label: string
  value: number
  /** Tailwind bg-* class for the segment + legend swatch. */
  color: string
}

/**
 * Horizontal 100% proportional bar with a legend underneath. Values of 0 are
 * skipped visually but still shown in the legend.
 */
export function StackedBar({
  segments,
  className,
  legendClassName,
}: {
  segments: StackSegment[]
  className?: string
  legendClassName?: string
}) {
  const lang = useAppStore((s) => s.lang)
  const total = segments.reduce((s, seg) => s + Math.max(0, seg.value), 0)
  const aria = `${t('akAriaSplit', lang)}: ${segments.map((s) => `${s.label} ${s.value}`).join(', ')}`

  return (
    <div className={className} role="img" aria-label={aria}>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
        {total > 0 &&
          segments.map((seg, i) => {
            const pct = (Math.max(0, seg.value) / total) * 100
            if (pct <= 0) return null
            return (
              <div
                key={`${seg.label}-${i}`}
                className={cn('h-full', seg.color)}
                style={{ width: `${pct}%` }}
                title={`${seg.label}: ${pct.toFixed(1)}%`}
              />
            )
          })}
      </div>
      <ChartLegend
        className={cn('mt-2.5', legendClassName)}
        items={segments.map((s) => ({ label: s.label, dotClass: s.color }))}
      />
    </div>
  )
}

// ---------- DonutMini ----------

export interface DonutDatum {
  label: string
  value: number
  /** Optional tailwind stroke-* class override. */
  color?: string
}

/**
 * Small donut chart (stroke-dasharray technique on a 100-unit circumference)
 * with the total in the center and a legend beside/below it.
 */
export function DonutMini({
  data,
  size = 150,
  className,
  legend = true,
}: {
  data: DonutDatum[]
  size?: number
  className?: string
  legend?: boolean
}) {
  const lang = useAppStore((s) => s.lang)
  const total = data.reduce((s, d) => s + Math.max(0, d.value), 0)
  const aria = `${t('akAriaDonut', lang)}: ${data.map((d) => `${d.label} ${d.value}`).join(', ')}`
  let cum = 0

  return (
    <div className={cn('flex flex-wrap items-center gap-4', className)}>
      <svg
        viewBox="0 0 42 42"
        width={size}
        height={size}
        role="img"
        aria-label={aria}
        className="shrink-0"
      >
        <circle cx={21} cy={21} r={15.9155} fill="none" className="stroke-zinc-200 dark:stroke-zinc-800" strokeWidth={5.5} />
        {total > 0 &&
          data.map((d, i) => {
            const pct = (Math.max(0, d.value) / total) * 100
            if (pct <= 0) return null
            const dash = `${Math.max(0.5, pct)} ${100 - Math.max(0.5, pct)}`
            const offset = 25 - cum
            cum += pct
            return (
              <circle
                key={`${d.label}-${i}`}
                cx={21}
                cy={21}
                r={15.9155}
                fill="none"
                strokeWidth={5.5}
                className={d.color ?? DONUT_STROKE_PALETTE[i % DONUT_STROKE_PALETTE.length]}
                strokeDasharray={dash}
                strokeDashoffset={offset}
              >
                <title>{`${d.label}: ${d.value}`}</title>
              </circle>
            )
          })}
        <text x={21} y={20} textAnchor="middle" className="fill-foreground text-[7px] font-bold tabular-nums">
          {total.toLocaleString('en-IN')}
        </text>
        <text x={21} y={26.5} textAnchor="middle" className="fill-zinc-500 dark:fill-zinc-400 text-[3.2px] font-medium uppercase tracking-wider">
          {t('akTotal', lang)}
        </text>
      </svg>
      {legend && <ChartLegend items={data.map((d, i) => ({ label: d.label, value: d.value.toLocaleString('en-IN'), dotClass: dotFor(d.color, i) }))} />}
    </div>
  )
}

function dotFor(strokeClass: string | undefined, i: number): string {
  if (strokeClass) return strokeClass.replace(/^stroke-/, 'bg-')
  return CHART_PALETTE[i % CHART_PALETTE.length]
}

// ---------- SparkLine ----------

/**
 * Tiny trend polyline. `preserveAspectRatio="none"` + vector-effect keeps the
 * stroke crisp at any container width.
 */
export function SparkLine({
  points,
  tone = 'amber',
  className,
  height = 40,
}: {
  points: number[]
  tone?: 'amber' | 'emerald' | 'zinc'
  className?: string
  height?: number
}) {
  const lang = useAppStore((s) => s.lang)
  const W = 100
  const H = 32
  // FIX: Math.min(...[]) is Infinity and Math.max(...[]) is -Infinity, so
  // `span` became -Infinity (truthy) and produced a degenerate polygon. Bail out
  // cleanly when there is no data.
  if (points.length === 0) {
    return (
      <div
        role="img"
        aria-label="No data yet"
        className={cn('flex h-8 items-center justify-center rounded border border-dashed text-[10px] text-muted-foreground', className)}
        style={{ height }}
      >
        —
      </div>
    )
  }
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const step = points.length > 1 ? W / (points.length - 1) : W
  const coords = points.map((p, i) => [i * step, H - 3 - ((p - min) / span) * (H - 6)] as const)
  const line = coords.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ')
  const area = `0,${H} ${line} ${W},${H}`
  const stroke = tone === 'emerald' ? 'stroke-emerald-500' : tone === 'zinc' ? 'stroke-zinc-400' : 'stroke-amber-500'
  const fillC = tone === 'emerald' ? 'fill-emerald-500/10' : tone === 'zinc' ? 'fill-zinc-400/10' : 'fill-amber-500/10'
  const last = points.length > 0 ? points[points.length - 1] : 0

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ height }}
      className={cn('w-full', className)}
      role="img"
      aria-label={`${t('akAriaSpark', lang)}: ${points.join(', ')} — ${t('akTotal', lang)} ${last}`}
    >
      <polygon points={area} className={fillC} stroke="none" />
      <polyline
        points={line}
        fill="none"
        className={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
