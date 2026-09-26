'use client'

// Government & Institutional Ecosystem — level 0 view.
// Everything here is EXTERNAL: the platform only mirrors records obtained via
// authorized data-sharing. No live government API is connected in this prototype.

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { SectionCard, LevelPill, EmptyState } from '../shared/ui-kit'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { GovDashboardResponse, GovRegistrationRecord, GovIntegration } from './api-types'
import {
  Landmark, Database, ArrowLeftRight, Layers, RefreshCw, ShieldCheck, ShieldAlert,
  Building2, Zap, Droplets, Hammer, Paintbrush, Sparkles, Car, HeartHandshake, Leaf, Wrench, Refrigerator, MoreHorizontal,
} from 'lucide-react'
import type { ReactNode } from 'react'

const CATEGORY_ICONS: Record<string, ReactNode> = {
  electrician: <Zap className="h-3 w-3" />, plumber: <Droplets className="h-3 w-3" />,
  carpenter: <Hammer className="h-3 w-3" />, painter: <Paintbrush className="h-3 w-3" />,
  cleaning: <Sparkles className="h-3 w-3" />, driver: <Car className="h-3 w-3" />,
  caregiver: <HeartHandshake className="h-3 w-3" />, gardener: <Leaf className="h-3 w-3" />,
  technician: <Wrench className="h-3 w-3" />, appliance: <Refrigerator className="h-3 w-3" />,
  other: <MoreHorizontal className="h-3 w-3" />,
}

function parseCategories(json: string): string[] {
  try {
    const arr = JSON.parse(json)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function fmtRegDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className ?? ''}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm font-medium leading-snug">{children}</div>
    </div>
  )
}

function VerificationBadge({ status }: { status: string }) {
  const ok = status.toUpperCase().startsWith('VERIFIED')
  return (
    <Badge variant="outline" className={ok
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
      : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300'}>
      {ok ? <ShieldCheck className="mr-1 h-3 w-3" /> : <ShieldAlert className="mr-1 h-3 w-3" />} {status}
    </Badge>
  )
}

function IntegrationStatusBadge({ status }: { status: string }) {
  if (status === 'DESIGNED') {
    return <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">Blueprint ready</Badge>
  }
  return <Badge variant="outline" className="border-zinc-300 bg-transparent text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">Future / Authorized Integration</Badge>
}

function RegistrationCard({ reg }: { reg: GovRegistrationRecord }) {
  const categories = parseCategories(reg.serviceCategories)
  return (
    <SectionCard
      title={<span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Society registration record</span>}
      description={`Featured cooperative: ${reg.cooperative.name}`}
    >
      <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Registration number"><span className="font-mono text-xs">{reg.registrationNumber}</span></Field>
        <Field label="Registered on">{fmtRegDate(reg.registeredOn)}</Field>
        <Field label="Registering authority">{reg.registeringAuthority}</Field>
        <Field label="State">{reg.state}</Field>
        <Field label="District">{reg.district}</Field>
        <Field label="Taluka">{reg.taluka}</Field>
        <Field label="Society type">{reg.societyType}</Field>
        <Field label="Authorized representative">{reg.authorizedRepresentative}</Field>
        <Field label="Member count"><span className="tabular-nums">{reg.memberCount.toLocaleString('en-IN')}</span></Field>
        <Field label="Worker count"><span className="tabular-nums">{reg.workerCount.toLocaleString('en-IN')}</span></Field>
        <Field label="Operational status">
          <Badge variant="secondary" className="text-[10px] font-semibold">{reg.operationalStatus}</Badge>
        </Field>
        <Field label="Verification status"><VerificationBadge status={reg.verificationStatus} /></Field>
        <Field label="Service categories" className="sm:col-span-2 lg:col-span-3">
          <div className="flex flex-wrap gap-1.5">
            {categories.map((c) => (
              <Badge key={c} variant="secondary" className="gap-1 capitalize">
                {CATEGORY_ICONS[c] ?? CATEGORY_ICONS.other} {c}
              </Badge>
            ))}
            {categories.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
          </div>
        </Field>
      </div>
      <div className="mt-4 flex items-center gap-2 border-t border-dashed pt-3 text-[11px] text-muted-foreground">
        <Database className="h-3.5 w-3.5 shrink-0" />
        <span>
          Source: <span className="font-semibold text-amber-700 dark:text-amber-400">{reg.sourceNote}</span>
          <span className="mx-1.5">·</span>
          mirrored record — verify against the official register before any legal use
        </span>
      </div>
    </SectionCard>
  )
}

function IntegrationRow({ item }: { item: GovIntegration }) {
  return (
    <div className="flex flex-col gap-1.5 py-3 sm:flex-row sm:items-start sm:gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">{item.name}</p>
          <Badge variant="secondary" className="text-[10px]">{item.domain}</Badge>
          <IntegrationStatusBadge status={item.status} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{item.purpose}</p>
        <p className="mt-1 flex items-center gap-1.5 text-[11px] leading-relaxed text-muted-foreground/80">
          <ArrowLeftRight className="h-3 w-3 shrink-0" /> {item.dataFlow}
        </p>
      </div>
    </div>
  )
}

export function GovernmentEcosystem() {
  const q = useQuery({
    queryKey: ['gov-dashboard'],
    queryFn: () => api.get<GovDashboardResponse>('/api/hierarchy/dashboard?level=government'),
    // Live: every governance dashboard must reflect a booking as it happens.
    staleTime: 15_000,
    refetchInterval: 20_000,
  })

  if (q.isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-5">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  if (q.isError || !q.data?.ok) {
    return (
      <div className="mx-auto max-w-5xl">
        <EmptyState
          icon={<Landmark className="h-8 w-8" />}
          title="Ecosystem registry unavailable"
          body={q.isError ? (q.error as Error).message : 'Unexpected response from the registry service.'}
          action={<Button variant="outline" size="sm" onClick={() => q.refetch()}><RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Retry</Button>}
        />
      </div>
    )
  }

  const { integrations, registration, levels } = q.data

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <div className="rounded-lg bg-primary/10 p-2 text-primary"><Landmark className="h-5 w-5" /></div>
          <h1 className="text-xl font-bold tracking-tight">Government &amp; Institutional Ecosystem</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">External institutional ecosystem — connected only via authorized data-sharing.</p>
      </div>

      {/* Prominent source banner */}
      <div className="flex items-start gap-3 rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950/40">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <p className="text-sm font-bold text-amber-900 dark:text-amber-200">Government Registration Source: External / Authorized Integration</p>
          <p className="mt-0.5 text-xs leading-relaxed text-amber-800 dark:text-amber-300/90">
            Designed for authorized integration with relevant government cooperative databases. No live government API is connected in this prototype.
          </p>
        </div>
      </div>

      {/* Registration record */}
      {registration ? (
        <RegistrationCard reg={registration} />
      ) : (
        <EmptyState icon={<Database className="h-8 w-8" />} title="No registration record mirrored yet" body="Once an authorized registry connection is established, society records will appear here." />
      )}

      {/* Conceptual integration layer */}
      <SectionCard
        title="Conceptual integration layer"
        description="Planned connections to external institutional systems — each requires formal authorization before any data flows."
      >
        <div className="divide-y">
          {integrations.map((item) => <IntegrationRow key={item.id} item={item} />)}
          {integrations.length === 0 && <p className="py-4 text-sm text-muted-foreground">No integrations registered yet.</p>}
        </div>
      </SectionCard>

      {/* Hierarchy levels strip */}
      <SectionCard
        title={<span className="flex items-center gap-2"><Layers className="h-4 w-4 text-primary" /> Platform hierarchy levels</span>}
        description="How the cooperative network is organized across the country."
      >
        <div className="flex flex-wrap gap-2">
          {levels.map((l) => <LevelPill key={l.id} level={l.level} label={l.nameEn} />)}
        </div>
        <p className="mt-3 text-[11px] italic text-muted-foreground">
          Configurable — different sectors/states may organize differently. Level 0 (government) is an external ecosystem, not part of the platform.
        </p>
      </SectionCard>
    </div>
  )
}
