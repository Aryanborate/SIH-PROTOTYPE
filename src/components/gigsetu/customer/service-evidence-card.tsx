'use client'

// Service Evidence (#34) — transparent on-site record grid rendered for
// COMPLETED / PAID / REVIEWED bookings. Upgrades the old basic evidence block:
// never invents facts — missing fields render honest "awaiting worker upload" states.

import { t } from '@/lib/i18n'
import { useAppStore } from '@/store/app-store'
import type { BookingDTO } from '@/lib/types'
import { SectionCard } from '../shared/ui-kit'
import { Badge } from '@/components/ui/badge'
import { Camera, CheckCircle2, Clock, ShieldCheck, Hourglass } from 'lucide-react'

/** Date-only display (warranty line). */
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm leading-snug">{children}</div>
    </div>
  )
}

/** Dashed photo placeholder used for both before/after slots when no image exists. */
function PhotoSlot({ label, note, tone }: { label: string; note: string; tone: 'plain' | 'emerald' }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div
        className={`mt-1 flex h-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-2 text-center ${
          tone === 'emerald'
            ? 'border-emerald-300/70 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/30'
            : 'border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/50'
        }`}
      >
        <Camera className={`h-4 w-4 ${tone === 'emerald' ? 'text-emerald-500' : 'text-muted-foreground/60'}`} />
        <span className="text-[10px] leading-tight text-muted-foreground">{note}</span>
      </div>
    </div>
  )
}

export function ServiceEvidenceCard({ booking }: { booking: BookingDTO }) {
  const lang = useAppStore((s) => s.lang)
  const ev = booking.evidence ?? null
  const hasEv = !!ev

  // Completion date: COMPLETED timeline entry, else evidence timestamp, else scheduled date.
  const completedAt =
    [...booking.timeline].reverse().find((tl) => tl.status === 'COMPLETED')?.at ??
    ev?.at ??
    booking.scheduledAt
  const warrantyUntil = new Date(new Date(completedAt).getTime() + 30 * 86400000)
  const approved = !!ev?.by || !!booking.rating

  // Before photo: worker-uploaded evidence photo, else the customer's own booking attachment.
  const beforePhoto = ev?.photo?.startsWith('data:image') ? ev.photo : booking.media.find((m) => m.startsWith('data:image'))

  return (
    <SectionCard
      title={t('evTitle', lang)}
      description={hasEv ? t('evSub', lang) : undefined}
      actions={
        !hasEv ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
            <Hourglass className="h-3 w-3" /> {t('evAwaiting', lang)}
          </span>
        ) : undefined
      }
    >
      <div className="space-y-3">
        {/* Job ID strip */}
        <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t('evJobId', lang)}</p>
            <p className="truncate font-mono text-base font-bold tracking-tight">#{booking.refCode}</p>
          </div>
          {!hasEv && <p className="hidden max-w-[220px] text-[11px] leading-snug text-muted-foreground sm:block">{t('evAwaitingNote', lang)}</p>}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Before photo */}
          {beforePhoto ? (
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t('evBefore', lang)}</p>
              <img src={beforePhoto} alt={t('evBefore', lang)} className="mt-1 h-20 w-full rounded-lg border object-cover" />
            </div>
          ) : (
            <PhotoSlot label={t('evBefore', lang)} note={hasEv ? t('evBeforePh', lang) : t('evAwaiting', lang)} tone="plain" />
          )}

          {/* After photo — honest emerald-tinted placeholder (server stores no after-shot today) */}
          <PhotoSlot label={t('evAfter', lang)} note={t('evAfterPh', lang)} tone="emerald" />

          {/* Problem */}
          <Field label={t('evProblem', lang)}>
            <p className="line-clamp-3 text-muted-foreground">{booking.description || booking.title}</p>
          </Field>

          {/* Work performed */}
          <Field label={t('evWork', lang)}>
            {ev?.notes ? <p className="line-clamp-3">{ev.notes}</p> : <p className="line-clamp-3 italic text-muted-foreground">{booking.title}</p>}
          </Field>

          {/* Material used — not captured by the prototype flow; honest em dash when absent */}
          <Field label={t('evMaterial', lang)}>
            <p className={ev ? '' : 'text-muted-foreground'}>—</p>
          </Field>

          {/* Worker */}
          <Field label={t('worker', lang)}>
            {booking.workerName ? (
              <span className="flex flex-wrap items-center gap-1.5">
                <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-primary">{initials(booking.workerName)}</span>
                <span className="font-medium">{booking.workerName}</span>
                <Badge variant="outline" className="border-emerald-200 text-emerald-700 dark:border-emerald-900 dark:text-emerald-300"><ShieldCheck className="mr-0.5 h-2.5 w-2.5" /> {t('verified', lang)}</Badge>
              </span>
            ) : (
              <p className="text-muted-foreground">—</p>
            )}
          </Field>

          {/* Customer approval */}
          <Field label={t('evApproval', lang)}>
            {approved ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" /> {t('evApproved', lang)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                <Hourglass className="h-3 w-3" /> {t('pending', lang)}
              </span>
            )}
          </Field>

          {/* Warranty */}
          <Field label={t('evWarranty', lang)}>
            <span className="inline-flex w-fit items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
              <Clock className="h-3.5 w-3.5" /> {t('evWarrantyUntil', lang).replace('{date}', fmtDate(warrantyUntil.toISOString()))}
            </span>
          </Field>
        </div>
      </div>
    </SectionCard>
  )
}
