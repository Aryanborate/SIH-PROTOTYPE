'use client'

// Phase 6 #45 — Global search UI (Task 15-c).
// Self-mount-safe: renders ONLY a trigger button + the CommandDialog palette.
// The orchestrator mounts <GlobalSearch /> in the app shell and/or the landing.
// Server: GET /api/search?q=… (grouped results with client nav hints).
// Navigation is role-gated via ROLE_VIEWS — blocked results show a toast that
// names the demo identity that can open them.

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAppStore, ROLE_VIEWS, type View } from '@/store/app-store'
import { api } from '@/lib/api-client'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
} from '@/components/ui/command'
import {
  Search,
  HardHat,
  Building2,
  Flag,
  Globe2,
  Wrench,
  ReceiptText,
  Network,
  MapPin,
  Landmark,
  Loader2,
  CornerDownLeft,
} from 'lucide-react'
import type { Role } from '@/lib/types'

// ---------- API shapes (mirror /api/search) ----------

interface SearchNav {
  view?: string
  focusIds?: { district?: string; taluka?: string; coop?: string }
  bookingRef?: string
  workerTab?: string
}
interface SearchItem {
  id: string
  type: string
  title: string
  subtitle: string
  nav: SearchNav
}
interface SearchGroup {
  type: string
  label: string
  results: SearchItem[]
}
interface SearchResponse {
  ok: boolean
  q: string
  groups: SearchGroup[]
}

// ---------- Presentation helpers ----------

const TYPE_ICON: Record<string, React.ReactNode> = {
  worker: <HardHat className="h-4 w-4" />,
  cooperative: <Building2 className="h-4 w-4" />,
  federation: <Flag className="h-4 w-4" />,
  service: <Wrench className="h-4 w-4" />,
  booking: <ReceiptText className="h-4 w-4" />,
  district: <Network className="h-4 w-4" />,
  taluka: <MapPin className="h-4 w-4" />,
  institution: <Landmark className="h-4 w-4" />,
}

const ROLE_LABEL: Record<Role, string> = {
  CUSTOMER: 'Customer',
  INSTITUTION: 'Institution',
  WORKER: 'Worker',
  COOP_ADMIN: 'Cooperative',
  TALUKA_COORD: 'Taluka',
  DISTRICT_COORD: 'District',
  STATE_ADMIN: 'State Federation',
  NATIONAL_ADMIN: 'National',
  PLATFORM_ADMIN: 'Platform Admin',
}

/** Which demo identity is the natural home for a view (used in the block toast). */
const VIEW_ROLE_SUGGEST: Partial<Record<View, Role>> = {
  customer: 'CUSTOMER',
  whatsapp: 'CUSTOMER',
  worker: 'WORKER',
  coop: 'COOP_ADMIN',
  exchange: 'COOP_ADMIN',
  ai: 'COOP_ADMIN',
  hierarchy: 'COOP_ADMIN',
  government: 'COOP_ADMIN',
  map: 'COOP_ADMIN',
  taluka: 'TALUKA_COORD',
  district: 'DISTRICT_COORD',
  state: 'STATE_ADMIN',
  national: 'NATIONAL_ADMIN',
  platform: 'PLATFORM_ADMIN',
}

/** #69-style progressive search lines, cycled while the request is in flight. */
const PROGRESS_LINES = [
  'Checking local cooperative…',
  'Checking Taluka reserve…',
  'Checking district capacity…',
]

const EXAMPLES = ['rajesh', 'Haveli', 'GS-', 'electrician', 'Pune']

function targetViewFor(item: SearchItem): View | null {
  if (item.nav.bookingRef) return 'customer'
  if (item.nav.view) return item.nav.view as View
  return null
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [raw, setRaw] = useState('')
  const [q, setQ] = useState('')
  const [lineIdx, setLineIdx] = useState(0)
  const { toast } = useToast()
  const user = useAppStore((s) => s.user)
  const allowedViews = user ? ROLE_VIEWS[user.role] ?? [] : []

  // ⌘K / Ctrl+K toggles the palette (global listener, safe to double-mount).
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // Debounce the query 250ms.
  useEffect(() => {
    const id = setTimeout(() => setQ(raw.trim()), 250)
    return () => clearTimeout(id)
  }, [raw])

  const searchQ = useQuery({
    queryKey: ['global-search', q],
    queryFn: () => api.get<SearchResponse>(`/api/search?q=${encodeURIComponent(q)}`),
    enabled: open && q.length >= 2,
    staleTime: 15_000,
    retry: false,
  })
  const fetching = searchQ.isFetching

  // Cycle the progressive lines while loading (index resets on new input).
  useEffect(() => {
    if (!fetching) return
    const id = setInterval(() => setLineIdx((i) => (i + 1) % PROGRESS_LINES.length), 700)
    return () => clearInterval(id)
  }, [fetching])

  function navigate(item: SearchItem) {
    const view = targetViewFor(item)
    if (!view) return
    const store = useAppStore.getState()
    const user = store.user
    const allowed = !!user && (ROLE_VIEWS[user.role] ?? []).includes(view)
    if (!allowed) {
      const suggest = VIEW_ROLE_SUGGEST[view] ?? 'PLATFORM_ADMIN'
      toast({
        title: 'Role gate',
        description: `Switch to the ${ROLE_LABEL[suggest]} demo to open this.${user ? '' : ' Log in with a demo identity first.'}`,
      })
      return
    }
    setOpen(false)
    if (item.nav.bookingRef) {
      store.openBookingByRef(item.nav.bookingRef)
    } else if (view === 'worker' && item.nav.workerTab) {
      store.openWorkerTab(item.nav.workerTab)
    } else if (item.nav.focusIds && Object.keys(item.nav.focusIds).length > 0) {
      store.drillTo(view, item.nav.focusIds)
    } else {
      store.setView(view)
    }
  }

  const groups = searchQ.data?.groups ?? []
  const showExamples = q.length < 2 && !fetching
  const showEmpty = !fetching && q.length >= 2 && groups.length === 0 && !searchQ.isError

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        aria-label="Search the cooperative network (Ctrl+K)"
        onClick={() => setOpen(true)}
        className="h-9 gap-2 text-muted-foreground"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search</span>
        <kbd className="pointer-events-none hidden rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-block">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search the cooperative network"
        description="Workers, cooperatives, federations, services, bookings, districts, talukas and institutions"
        className="max-w-xl"
      >
        <CommandInput
          value={raw}
          onValueChange={(v) => {
            setRaw(v)
            setLineIdx(0)
          }}
          placeholder="Try a worker, cooperative, booking ref (GS-…), district or service…"
          aria-label="Search query"
        />
        <CommandList>
          {showExamples && (
            <CommandGroup heading="Try searching for">
              {EXAMPLES.map((ex) => (
                <CommandItem
                  key={ex}
                  value={`example ${ex}`}
                  onSelect={() => {
                    setRaw(ex)
                    setLineIdx(0)
                  }}
                  className="text-muted-foreground"
                >
                  <Search className="h-4 w-4" />
                  <span>{ex}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {fetching && (
            <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground" role="status" aria-live="polite">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <div>
                <p className="font-medium text-foreground">Searching the cooperative network…</p>
                <p className="text-xs">{PROGRESS_LINES[lineIdx]}</p>
              </div>
            </div>
          )}

          {!fetching &&
            groups.map((g) => (
              <CommandGroup key={g.type + g.label} heading={g.label}>
                {g.results.map((item) => {
                  const view = targetViewFor(item)
                  const allowed = view !== null && allowedViews.includes(view)
                  return (
                    <CommandItem
                      key={`${item.type}-${item.id}`}
                      value={`${item.title} ${item.subtitle}`}
                      onSelect={() => navigate(item)}
                      className="items-start gap-3 py-2.5"
                    >
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-muted/40 text-muted-foreground">
                        {TYPE_ICON[item.type] ?? <Search className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>
                      </span>
                      <CommandShortcut className="shrink-0">
                        {allowed ? <CornerDownLeft className="h-3.5 w-3.5" /> : <span className="text-[10px] uppercase tracking-wide">role-gated</span>}
                      </CommandShortcut>
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ))}

          {showEmpty && (
            <CommandEmpty>
              <span className="text-muted-foreground">
                No matches — try a worker, cooperative, booking ref (GS-…), district or service
              </span>
            </CommandEmpty>
          )}

          {searchQ.isError && (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Search is unavailable right now — please try again.
            </div>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}
