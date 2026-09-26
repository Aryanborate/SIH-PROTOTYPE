'use client'

// DIGITAL SKILL PASSPORT — premium portable worker identity document for GigSetu

import { SectionCard, VerifiedBadge, RatingStars, PrototypeNotice } from '../shared/ui-kit'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { WorkerDTO } from '@/lib/types'
import { BadgeCheck, CheckCircle2, Landmark, ShieldCheck, Quote } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PassportActions } from './passport-print'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmtDate(d?: string | null): string {
  if (!d) return '—'
  const s = d.slice(0, 10).split('-')
  if (s.length < 3) return d
  return `${Number(s[2])} ${MONTHS[Number(s[1]) - 1] ?? '?'} ${s[0]}`
}

function initialsOf(name: string): string {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-900/60 dark:text-amber-200/50">{label}</p>
      <div className="mt-1 text-sm font-medium leading-snug">{children}</div>
    </div>
  )
}

function Chips({ items }: { items: string[] }) {
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((s) => (
        <Badge key={s} variant="secondary" className="px-1.5 py-0 text-[10px] font-medium">{s}</Badge>
      ))}
    </span>
  )
}

// Deterministic decorative QR-style block (prototype — not a real code)
const QR_ROWS = ['1101101', '1001001', '1010110', '0110101', '1011010', '1001101', '1101011']
function FakeQr() {
  return (
    <div className="grid w-14 grid-cols-7 gap-px rounded border bg-card p-1" aria-hidden>
      {QR_ROWS.flatMap((row, y) =>
        row.split('').map((c, x) => (
          <span key={`${x}-${y}`} className={cn('aspect-square', c === '1' ? 'bg-foreground/75' : 'bg-transparent')} />
        ))
      )}
    </div>
  )
}

export function SkillPassport({
  worker,
  cooperative,
  portable,
}: {
  worker: WorkerDTO
  cooperative: { name: string; regNo: string }
  portable: { note: string; portableFields: string[] }
}) {
  return (
    <div className="space-y-4">
      {/* ---------- Print / export actions ---------- */}
      <div className="flex items-center justify-end gap-2">
        <span className="mr-auto hidden items-center gap-1.5 text-[11px] font-medium uppercase tracking-widest text-muted-foreground sm:flex">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Portable identity document
        </span>
        <PassportActions worker={worker} cooperative={cooperative} />
      </div>

      {/* ---------- Passport document ---------- */}
      <section
        aria-label="Digital Skill Passport"
        className="overflow-hidden rounded-xl border-2 border-amber-900/25 bg-card shadow-sm dark:border-amber-200/20"
      >
        {/* Guilloche-style header band */}
        <div className="relative bg-gradient-to-br from-amber-50 via-orange-50 to-amber-100 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-70 [background-image:repeating-linear-gradient(45deg,transparent_0px,transparent_7px,rgba(180,83,9,0.055)_7px,rgba(180,83,9,0.055)_8px),repeating-linear-gradient(-45deg,transparent_0px,transparent_11px,rgba(180,83,9,0.045)_11px,rgba(180,83,9,0.045)_12px)]"
          />
          <div className="relative p-5 sm:p-6">
            {/* Document header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-serif text-xs font-bold uppercase tracking-[0.28em] text-amber-900/80 dark:text-amber-200/70 sm:text-sm">
                  Digital Skill Passport
                </p>
                <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-amber-900/60 dark:text-amber-200/50">
                  GigSetu Cooperative Network · कौशल पासपोर्ट
                </p>
              </div>
              <div className="flex h-[72px] w-[72px] shrink-0 rotate-6 flex-col items-center justify-center rounded-full border-2 border-amber-800/40 text-amber-800/70 dark:border-amber-300/30 dark:text-amber-200/60">
                <ShieldCheck className="h-4 w-4" />
                <span className="mt-0.5 text-[7px] font-bold uppercase tracking-[0.18em]">Verified</span>
                <span className="text-[7px] font-bold uppercase tracking-[0.18em]">Member</span>
              </div>
            </div>

            {/* Identity row */}
            <div className="mt-5 flex items-center gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border-2 border-amber-900/20 bg-primary/10 text-xl font-bold text-primary dark:border-amber-200/20">
                {initialsOf(worker.name)}
              </div>
              <div className="min-w-0">
                <h3 className="truncate font-serif text-2xl font-bold tracking-tight">{worker.name}</h3>
                <p className="mt-1 inline-flex items-center gap-1.5 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-muted-foreground">
                  ID · {worker.id}
                </p>
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Landmark className="h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="truncate">{cooperative.name} · Reg. {cooperative.regNo}</span>
                </p>
              </div>
            </div>

            {/* Fields grid */}
            <div className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-dashed border-amber-900/20 pt-4 dark:border-amber-200/15 sm:grid-cols-3">
              <Field label="Primary skill">
                <span className="capitalize">{worker.primarySkill}</span>
              </Field>
              <Field label="Experience">
                <span className="tabular-nums">{worker.experienceYears} years</span>
              </Field>
              <Field label="Certification">
                <span className="block text-xs leading-snug">{worker.certName}</span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5">
                  <VerifiedBadge status={worker.certStatus} />
                  <span className="text-[10px] text-muted-foreground">valid till {fmtDate(worker.certExpiry)}</span>
                </span>
              </Field>
              <Field label="Safety training">
                {worker.safetyValid ? (
                  <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300" variant="outline">
                    <CheckCircle2 className="mr-1 h-3 w-3" /> Valid
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-[10px]">Lapsed — renew at coop</Badge>
                )}
              </Field>
              <Field label="Completed jobs">
                <span className="text-base font-bold tabular-nums">{worker.completedJobs.toLocaleString('en-IN')}</span>
              </Field>
              <Field label="Customer rating">
                <RatingStars value={worker.rating} />
              </Field>
              <Field label="Languages">
                <Chips items={worker.languages} />
              </Field>
              <Field label="Service areas" className="sm:col-span-1">
                <Chips items={worker.serviceAreas} />
              </Field>
              <Field label="Secondary skills">
                {worker.secondarySkills.length ? <Chips items={worker.secondarySkills} /> : <span className="text-xs text-muted-foreground">—</span>}
              </Field>
              <Field label="Completion rate" className="col-span-2 sm:col-span-3">
                <div className="flex items-center gap-3">
                  <Progress value={worker.completionRate} className="h-1.5 max-w-56" />
                  <span className="text-xs font-semibold tabular-nums">{worker.completionRate}%</span>
                </div>
              </Field>
            </div>

            {/* Skills checklist */}
            <div className="mt-4 border-t border-dashed border-amber-900/20 pt-4 dark:border-amber-200/15">
              <Field label="Cooperative-verified skills">
                <ul className="mt-1.5 grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
                  {worker.skills.map((s) => (
                    <li key={s} className="flex items-center gap-1.5 text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      {s}
                    </li>
                  ))}
                </ul>
              </Field>
            </div>

            {/* Bio quote */}
            {worker.bioEn && (
              <div className="mt-4 flex gap-2 rounded-lg bg-background/60 p-3 dark:bg-zinc-800/50">
                <Quote className="h-4 w-4 shrink-0 rotate-180 text-primary/60" />
                <p className="text-xs italic leading-relaxed text-muted-foreground">{worker.bioEn}</p>
              </div>
            )}

            {/* Document footer */}
            <div className="mt-5 flex items-end justify-between gap-4 border-t border-amber-900/20 pt-3 dark:border-amber-200/15">
              <div className="text-[10px] leading-relaxed text-amber-900/60 dark:text-amber-200/50">
                <p className="font-semibold uppercase tracking-widest">Issued by</p>
                <p>{cooperative.name}</p>
                <p>Portable across participating cooperatives · GigSetu Network</p>
              </div>
              <div className="flex flex-col items-center gap-1">
                <FakeQr />
                <span className="text-[8px] uppercase tracking-widest text-muted-foreground">Scan-verify (prototype)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Portable record ---------- */}
      <SectionCard
        title={
          <span className="inline-flex items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-primary" /> Portable professional record
          </span>
        }
        description={portable.note}
      >
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {portable.portableFields.map((f) => (
            <li key={f} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
              <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              {f}
            </li>
          ))}
        </ul>
        <PrototypeNotice className="mt-3">
          The Skill Passport follows the worker across participating cooperatives — with worker consent and applicable data-sharing rules. Sensitive personal data is never exposed.
        </PrototypeNotice>
      </SectionCard>
    </div>
  )
}
