'use client'

// Spec §22/#23/#24 — Cooperative Governance Actions for the Taluka / Block and
// District coordination dashboards.
//
// These two roles were previously READ-ONLY: the dashboards told them what was
// wrong (shortages, escalations, over-utilised societies) but gave them no way to
// act on it, which made them monitors rather than control rooms. This panel adds
// the three actions a coordinator actually has authority over, each backed by a
// real, audited API call:
//
//   1. Acknowledge a complaint raised in this taluka/district
//   2. Sanction a training placement from the cooperative training calendar
//   3. Raise a capacity-exchange recommendation to the next level up
//
// Nothing is auto-decided: every action is an explicit human choice, and every
// action is written to the audit log under the signed-in coordinator.

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { GraduationCap, Handshake, ShieldCheck, Loader2, ChevronDown } from 'lucide-react'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { SectionCard, EmptyState } from '../shared/ui-kit'
import { cn } from '@/lib/utils'
import type { DemoUser } from '@/lib/types'

export interface GovernanceComplaint {
  id: string
  cooperativeId: string
  subject: string
  severity: string
  status: string
  customerName: string
  createdAt: string
}

export interface GovernanceCourse {
  id: string
  title: string
  categoryKey: string
  provider: string
  seats: number
}

export function GovernanceActions({
  user,
  scopeLabel,
  cooperativeIds,
  cooperativeNames,
  opportunities,
  skillGaps,
}: {
  user: DemoUser
  scopeLabel: string
  cooperativeIds: string[]
  cooperativeNames: string[]
  opportunities?: Array<{ skill: string; gap: number; kind: string }>
  skillGaps?: Array<{ skill: string; have: number; need: number }>
}) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const canGovern = ['TALUKA_COORD', 'DISTRICT_COORD', 'STATE_ADMIN', 'NATIONAL_ADMIN', 'PLATFORM_ADMIN'].includes(user.role)

  const complaintsQ = useQuerySafe<{ ok: boolean; complaints: GovernanceComplaint[] }>(
    ['gov-complaints', user.role, user.talukaId ?? user.districtId ?? ''],
    () =>
      api.get<{ ok: boolean; complaints: GovernanceComplaint[] }>(
        cooperativeIds.length
          ? `/api/complaints?cooperativeId=${encodeURIComponent(cooperativeIds[0])}`
          : '/api/complaints',
      ),
    canGovern,
  )
  const coursesQ = useQuerySafe<{ ok: boolean; courses: GovernanceCourse[] }>(
    ['gov-courses'],
    () => api.get<{ ok: boolean; courses: GovernanceCourse[] }>('/api/worker?section=training'),
    canGovern,
  )

  const ack = useMutation({
    mutationFn: (id: string) => api.patch<{ ok: boolean }>('/api/complaints', { id, action: 'ACK' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['gov-complaints'] })
      void qc.invalidateQueries({ queryKey: ['hierarchy-dashboard'] })
      toast({ title: 'Complaint acknowledged', description: 'The society was notified and the record moved to RESOLVING.' })
    },
    onError: (e) => toast({ title: 'Could not acknowledge', description: (e as Error).message, variant: 'destructive' }),
  })

  const sanction = useMutation({
    mutationFn: (course: GovernanceCourse) =>
      api.post<{ ok: boolean; recommendation: { id: string } }>('/api/exchange', {
        skill: course.categoryKey,
        fromCoopId: cooperativeIds[0] ?? 'unknown',
        fromCoopName: cooperativeNames[0] ?? scopeLabel,
        toCoopId: 'training-sanction-queue',
        toCoopName: 'Federation training sanction queue',
        districtName: scopeLabel,
        workerCount: 5,
        expectedDemand: Math.max(5, (skillGaps ?? []).find((g) => g.skill === course.categoryKey)?.need ?? 10),
        durationDays: 90,
        rationale: `Training sanction raised for ${course.title} (${course.provider}) — ${course.seats} seats to close the ${course.categoryKey} gap in ${scopeLabel}.`,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['exchange'] })
      toast({ title: 'Training sanction raised', description: 'Sent to the federation training queue for approval. AI recommends; humans approve.' })
    },
    onError: (e) => toast({ title: 'Could not raise sanction', description: (e as Error).message, variant: 'destructive' }),
  })

  const raiseTransfer = useMutation({
    mutationFn: (opp: { skill: string; gap: number }) =>
      api.post<{ ok: boolean; recommendation: { id: string } }>('/api/exchange', {
        skill: opp.skill,
        fromCoopId: cooperativeIds[0] ?? 'unknown',
        fromCoopName: cooperativeNames[0] ?? scopeLabel,
        toCoopId: 'neighbouring-society',
        toCoopName: 'Neighbouring society (mutual aid)',
        districtName: scopeLabel,
        workerCount: Math.min(3, Math.max(1, Math.abs(opp.gap))),
        expectedDemand: Math.abs(opp.gap),
        durationDays: 7,
        rationale: `${scopeLabel} coordinator raised a ${opp.skill} mutual-aid request after reviewing the demand heatmap.`,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['exchange'] })
      toast({ title: 'Transfer recommendation raised', description: 'Pending district/federation approval — no worker moves automatically.' })
    },
    onError: (e) => toast({ title: 'Could not raise recommendation', description: (e as Error).message, variant: 'destructive' }),
  })

  const openComplaints = (complaintsQ.data?.complaints ?? []).filter((c) => c.status === 'OPEN')
  const shortageSkills = (opportunities ?? []).filter((o) => o.kind === 'SHORTAGE').slice(0, 3)
  const courses = (coursesQ.data?.courses ?? []).slice(0, 3)

  if (!canGovern) return null

  return (
    <SectionCard
      title={
        <span className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" /> Governance actions — {scopeLabel}
        </span>
      }
      description="Acknowledge escalations, sanction training and raise mutual-aid requests. Every action is audit-logged under your name."
      actions={
        <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? 'Hide' : 'Show'} <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
        </Button>
      }
    >
      {open ? (
        <div className="grid gap-3 md:grid-cols-3">
          {/* 1 — complaints */}
          <div className="rounded-lg border p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Open complaints</p>
            {openComplaints.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">Nothing awaiting acknowledgement in {scopeLabel}.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {openComplaints.slice(0, 3).map((c) => (
                  <li key={c.id} className="rounded-md border border-dashed p-2">
                    <p className="truncate text-xs font-semibold">{c.subject}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {c.severity} · {c.customerName}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1.5 h-7 text-xs"
                      disabled={busy === c.id || ack.isPending}
                      onClick={() => {
                        setBusy(c.id)
                        ack.mutate(c.id, { onSettled: () => setBusy(null) })
                      }}
                    >
                      {busy === c.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null} Acknowledge
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 2 — training sanctions */}
          <div className="rounded-lg border p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Training sanctions</p>
            {courses.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">No open courses in the calendar.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {courses.map((course) => (
                  <li key={course.id} className="rounded-md border border-dashed p-2">
                    <p className="truncate text-xs font-semibold">{course.title}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {course.provider} · {course.seats} seats
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1.5 h-7 gap-1 text-xs"
                      disabled={sanction.isPending}
                      onClick={() => sanction.mutate(course)}
                    >
                      {sanction.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <GraduationCap className="h-3 w-3" />} Sanction 5 seats
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* 3 — mutual aid */}
          <div className="rounded-lg border p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Mutual-aid requests</p>
            {shortageSkills.length === 0 ? (
              <p className="mt-2 text-xs text-muted-foreground">No shortage detected — nothing to request.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {shortageSkills.map((o) => (
                  <li key={o.skill} className="rounded-md border border-dashed p-2">
                    <p className="truncate text-xs font-semibold capitalize">{o.skill}</p>
                    <p className="text-[11px] text-muted-foreground">Shortfall of {Math.abs(o.gap)} member(s)</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1.5 h-7 gap-1 text-xs"
                      disabled={raiseTransfer.isPending}
                      onClick={() => raiseTransfer.mutate(o)}
                    >
                      {raiseTransfer.isPending ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Handshake className="h-3 w-3" />} Request mutual aid
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {openComplaints.length} open complaint(s) · {shortageSkills.length} shortage signal(s) · {courses.length} training course(s) available.
        </p>
      )}
    </SectionCard>
  )
}

/** Small wrapper so the panel can be rendered conditionally without a hook-order bug. */
function useQuerySafe<T>(key: readonly unknown[], fn: () => Promise<T>, enabled: boolean) {
  return useQuery({ queryKey: key, queryFn: fn, enabled, staleTime: 20_000, retry: false })
}
