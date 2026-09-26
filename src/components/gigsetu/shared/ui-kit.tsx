'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Star, ShieldCheck, AlertTriangle, Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { useAppStore } from '@/store/app-store'
import { t as translate } from '@/lib/i18n'

// ---------- Logo ----------

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn('h-8 w-8', className)} aria-hidden>
      <rect x="1.5" y="1.5" width="37" height="37" rx="9" className="fill-primary" />
      <g className="fill-primary-foreground">
        <circle cx="20" cy="12.5" r="4.2" />
        <circle cx="11.5" cy="25" r="4.2" />
        <circle cx="28.5" cy="25" r="4.2" />
      </g>
      <g stroke="currentColor" strokeWidth="0" className="fill-primary-foreground/40">
        <circle cx="20" cy="27.5" r="1.8" />
      </g>
      <path d="M20 16.7 L13.6 22.9 M20 16.7 L26.4 22.9 M14.9 27.2 L25.1 27.2" stroke="var(--color-background)" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </svg>
  )
}

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <LogoMark />
      {!compact && (
        <div className="leading-tight">
          <div className="font-bold tracking-tight text-foreground">GigSetu</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Cooperative Workforce OS</div>
        </div>
      )}
    </div>
  )
}

// ---------- KPI ----------

export function KpiCard({
  label, value, sub, icon, tone = 'default', className,
}: {
  label: string
  value: ReactNode
  sub?: string
  icon?: ReactNode
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
  className?: string
}) {
  const tones: Record<string, string> = {
    default: 'text-foreground',
    primary: 'text-primary',
    success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    danger: 'text-destructive',
  }
  return (
    <Card className={cn('py-4', className)}>
      <CardContent className="px-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          {icon && <span className={cn('opacity-70', tones[tone])}>{icon}</span>}
        </div>
        <p className={cn('mt-1 text-2xl font-bold tabular-nums tracking-tight', tones[tone])}>{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  )
}

// ---------- Section ----------

export function SectionCard({
  title, description, actions, children, className, contentClassName,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {description && <CardDescription className="text-xs">{description}</CardDescription>}
        </div>
        {actions}
      </CardHeader>
      <CardContent className={cn('pt-0', contentClassName)}>{children}</CardContent>
    </Card>
  )
}

// ---------- Badges ----------

export function DemandBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    HIGH: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900',
    MEDIUM: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900',
    LOW: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900',
  }
  return <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide', map[level] ?? map.LOW)}>{level}</span>
}

export function StatusChip({ status }: { status: string }) {
  const lang = useAppStore((s) => s.lang)
  const map: Record<string, string> = {
    QUOTE_REQUESTED: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300',
    QUOTED: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300',
    NEGOTIATING: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300',
    REQUESTED: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
    ACCEPTED: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
    ON_THE_WAY: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
    IN_PROGRESS: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
    COMPLETED: 'border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300',
    PAID: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300',
    REVIEWED: 'border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400',
    CANCELLED: 'border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950 dark:text-red-400',
  }
  // Localized label when a st<STATUS> key exists; falls back to the raw status text.
  const localized = translate(`st${status}`, lang)
  const label = localized === `st${status}` ? status.replace(/_/g, ' ') : localized
  return <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold', map[status] ?? map.REQUESTED)}>{label}</span>
}

export function AvailDot({ availability }: { availability: string }) {
  const map: Record<string, string> = { AVAILABLE: 'bg-emerald-500', BUSY: 'bg-amber-500', OFFLINE: 'bg-zinc-400' }
  return <span className={cn('inline-block h-2 w-2 rounded-full', map[availability] ?? 'bg-zinc-400')} />
}

export function VerifiedBadge({ status }: { status: string }) {
  const ok = status === 'VERIFIED'
  return (
    <Badge variant="outline" className={ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300' : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300'}>
      <ShieldCheck className="mr-1 h-3 w-3" /> {status}
    </Badge>
  )
}

export function RatingStars({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 text-amber-500', className)}>
      <Star className="h-3.5 w-3.5 fill-amber-500" />
      <span className="font-semibold tabular-nums">{value.toFixed(2)}</span>
    </span>
  )
}

export function PrototypeNotice({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <div className={cn('flex items-start gap-2 rounded-lg border border-dashed border-amber-300 bg-amber-50/60 px-3 py-2 text-[11px] leading-relaxed text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300', className)}>
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>{children ?? 'Prototype / Designed for Authorized Integration — no live government or payment APIs are connected. Government & cooperative data shown is realistic synthetic data.'}</span>
    </div>
  )
}

export function AttentionRow({ severity, label }: { severity: string; label: string }) {
  const color = severity === 'SERIOUS' ? 'text-destructive' : severity === 'WARNING' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'
  return (
    <div className="flex items-center gap-2 py-1 text-sm">
      <AlertTriangle className={cn('h-3.5 w-3.5 shrink-0', color)} />
      <span className={cn(severity === 'SERIOUS' && 'font-medium text-destructive')}>{label}</span>
    </div>
  )
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-10 text-center">
      {icon && <div className="text-muted-foreground/60">{icon}</div>}
      <p className="font-medium">{title}</p>
      {body && <p className="max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action}
    </div>
  )
}

export function LevelPill({ level, label }: { level: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
      <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-primary text-[10px] font-bold text-primary-foreground">{level}</span>
      {label}
    </span>
  )
}
