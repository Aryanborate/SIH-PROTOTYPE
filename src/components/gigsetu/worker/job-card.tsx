'use client'

// Shared job card + action hook for the Worker app (used by Home and Jobs tabs)

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, inr, timeAgo, fmtDateTime } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { StatusChip, RatingStars } from '../shared/ui-kit'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { BookingDTO } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Clock, Loader2, MapPin, User } from 'lucide-react'

const ACTIVE_STATUSES = ['REQUESTED', 'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS']

/** Worker-side lifecycle chain shown as a compact segmented progress strip. */
const STAGE_CHAIN = ['REQUESTED', 'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS', 'COMPLETED']

function StageStrip({ status }: { status: string }) {
  const idx = STAGE_CHAIN.indexOf(status)
  if (idx < 0) return null
  return (
    <div className="mb-3 flex items-center gap-1" role="img" aria-label={`Stage ${idx + 1} of ${STAGE_CHAIN.length}: ${status}`}>
      {STAGE_CHAIN.map((s, i) => (
        <span
          key={s}
          className={cn(
            'h-1 flex-1 rounded-full',
            i < idx ? 'bg-emerald-500' : i === idx ? 'bg-primary ring-2 ring-primary/20' : 'bg-muted'
          )}
        />
      ))}
    </div>
  )
}

export function isActiveJob(b: BookingDTO): boolean {
  return ACTIVE_STATUSES.includes(b.status)
}

// Next advance action label for the worker progress chain
const ADVANCE_LABEL: Record<string, string> = {
  ACCEPTED: 'On the way',
  ON_THE_WAY: 'Start work',
  IN_PROGRESS: 'Mark complete',
}

export function UrgencyBadge({ urgency }: { urgency: string }) {
  if (urgency === 'EMERGENCY') return <Badge variant="destructive" className="h-4 px-1.5 text-[9px]">SOS</Badge>
  if (urgency === 'URGENT') return <Badge className="h-4 border-amber-200 bg-amber-100 px-1.5 text-[9px] text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">URGENT</Badge>
  return null
}

/**
 * accept / advance mutations for the logged-in worker.
 * Invalidates the worker home + jobs queries so both tabs stay in sync.
 */
export function useJobActions(workerId: string) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ['worker-home', workerId] })
    void qc.invalidateQueries({ queryKey: ['worker-jobs', workerId] })
  }

  /**
   * FIX: this had NO catch, so a failed Accept/Advance produced an unhandled
   * promise rejection and the worker saw the spinner stop with no message on the
   * single most important action in their app. Errors are now surfaced.
   */
  async function run(bookingId: string, action: 'acceptJob' | 'advance' | 'rejectJob') {
    setPendingId(bookingId)
    setError(null)
    try {
      await api.patch('/api/worker', { id: workerId, action, bookingId })
      invalidate()
      return true
    } catch (e) {
      const msg = (e as Error).message
      setError(msg)
      toast({
        title: action === 'rejectJob' ? 'Could not decline this job' : action === 'acceptJob' ? 'Could not accept this job' : 'Could not update this job',
        description: msg,
        variant: 'destructive',
      })
      return false
    } finally {
      setPendingId(null)
    }
  }

  return {
    pendingId,
    error,
    accept: (bookingId: string) => void run(bookingId, 'acceptJob'),
    advance: (bookingId: string) => void run(bookingId, 'advance'),
    reject: (bookingId: string) => void run(bookingId, 'rejectJob'),
  }
}

export type JobActions = ReturnType<typeof useJobActions>

function MetaRow({ b }: { b: BookingDTO }) {
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {b.area}</span>
      <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {fmtDateTime(b.scheduledAt)}</span>
      {b.customerName && <span className="inline-flex items-center gap-1"><User className="h-3 w-3" /> {b.customerName}</span>}
      <span className="font-mono">{b.refCode}</span>
    </div>
  )
}

function ActionButtons({ b, actions }: { b: BookingDTO; actions: JobActions }) {
  const pending = actions.pendingId === b.id
  if (b.status === 'REQUESTED') {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" className="min-h-10 min-w-36" disabled={pending} onClick={() => actions.accept(b.id)}>
          {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          {pending ? 'Accepting…' : 'Accept job'}
        </Button>
        <span className="text-[11px] text-muted-foreground">Assigned to you via cooperative matching</span>
      </div>
    )
  }
  const label = ADVANCE_LABEL[b.status]
  if (!label) return null
  return (
    <div className="mt-3">
      <Button size="sm" className="min-h-10 min-w-40" disabled={pending} onClick={() => actions.advance(b.id)}>
        {pending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
        {pending ? 'Updating…' : label}
      </Button>
    </div>
  )
}

/** Customer review on a settled job. Rendered by JobActionCard (was dead code). */
function ReviewLine({ b }: { b: BookingDTO }) {
  // FIX: `!b.rating` treated a legitimate 0-star review as absent.
  if (b.rating == null) return null
  return (
    <div className="mt-2 rounded-lg border border-dashed bg-muted/40 px-3 py-2">
      <RatingStars value={b.rating} />
      {b.review && <p className="mt-1 text-xs italic text-muted-foreground">&ldquo;{b.review}&rdquo;</p>}
    </div>
  )
}

/** Full card for today's / active jobs with worker action buttons */
export function JobActionCard({ b, actions }: { b: BookingDTO; actions: JobActions }) {
  const price = b.finalPrice ?? b.estimatedPrice
  const emergency = b.urgency === 'EMERGENCY'
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border bg-card p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-md motion-reduce:transition-none motion-reduce:hover:transform-none',
        emergency ? 'border-red-300 dark:border-red-900' : ''
      )}
    >
      {emergency && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-red-500" />}
      {isActiveJob(b) && <StageStrip status={b.status} />}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold">{b.title}</p>
            <UrgencyBadge urgency={b.urgency} />
          </div>
          <MetaRow b={b} />
        </div>
        <div className="shrink-0 text-right">
          <StatusChip status={b.status} />
          {price ? <p className="mt-1 text-sm font-bold tabular-nums">{inr(price)}</p> : null}
        </div>
      </div>
      {b.description && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{b.description}</p>}
      <ReviewLine b={b} />
      {actions.error && (
        <p role="alert" className="mt-2 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
          {actions.error}
        </p>
      )}
      <ActionButtons b={b} actions={actions} />
    </div>
  )
}

/** Compact row for history lists — shows rating + review for settled jobs */
export function BookingRow({ b }: { b: BookingDTO }) {
  const price = b.finalPrice ?? b.estimatedPrice
  return (
    <div className="rounded-lg border bg-card p-3 transition duration-200 hover:-translate-y-px hover:border-primary/40 hover:shadow-sm motion-reduce:transition-none motion-reduce:hover:transform-none">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-medium">{b.title}</p>
            <UrgencyBadge urgency={b.urgency} />
          </div>
          <MetaRow b={b} />
        </div>
        <div className="shrink-0 text-right">
          <StatusChip status={b.status} />
          {price ? <p className="mt-1 text-xs font-semibold tabular-nums">{inr(price)}</p> : null}
        </div>
      </div>
      {b.review ? (
        <p className="mt-1.5 text-[11px] italic text-muted-foreground">
          <RatingStars value={b.rating ?? 0} className="mr-1.5" />&ldquo;{b.review}&rdquo; · {timeAgo(b.scheduledAt)}
        </p>
      ) : null}
    </div>
  )
}
