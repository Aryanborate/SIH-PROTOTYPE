import { cn } from '../../lib/utils'

export function Chip({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-slate-300',
        className,
      )}
    >
      {children}
    </span>
  )
}

const toneStyles: Record<string, string> = {
  live: 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200/90',
  active: 'border-indigo-300/25 bg-indigo-400/10 text-indigo-200/90',
  wip: 'border-sky-300/20 bg-sky-400/10 text-sky-200/90',
  neutral: 'border-white/[0.08] bg-white/[0.04] text-slate-300',
}

const dotStyles: Record<string, string> = {
  live: 'bg-emerald-300',
  active: 'bg-indigo-300',
  wip: 'bg-sky-300',
  neutral: 'bg-slate-400',
}

export function StatusChip({
  children,
  tone = 'neutral',
  className,
}: {
  children: React.ReactNode
  tone?: 'live' | 'active' | 'wip' | 'neutral'
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em]',
        toneStyles[tone],
        className,
      )}
    >
      <span className={cn('h-1 w-1 rounded-full', dotStyles[tone], tone === 'live' && 'animate-pulse-soft')} aria-hidden="true" />
      {children}
    </span>
  )
}
