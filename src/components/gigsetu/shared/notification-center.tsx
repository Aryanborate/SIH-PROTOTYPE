'use client'

// GigSetu Phase 5 — Notification Center (#41), Task 14-e
// Full role-aware notification surface: audience tabs, unread filter,
// mark-all-read, deep-links. Opened from the header bell popover.

import { useMemo, useState } from 'react'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import { api, timeAgo } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { DemoUser, NotificationDTO } from '@/lib/types'
import { EmptyState } from './ui-kit'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertTriangle, Bell, CheckCircle2, Inbox, Loader2, Siren } from 'lucide-react'

type TabKey = 'customer' | 'worker' | 'coop' | 'network'

const TAB_LABEL_KEY: Record<TabKey, string> = {
  customer: 'ncTabCustomer',
  worker: 'ncTabWorker',
  coop: 'ncTabCoop',
  network: 'ncTabNetwork',
}

interface AudienceSpec { audience: string; audienceId: string }
interface TabSpec { key: TabKey; audiences: AudienceSpec[] }
interface FlatSpec { tab: TabKey; audience: string; audienceId: string }

/**
 * Role → visible audience tabs. STATE/NATIONAL/PLATFORM see every stream
 * audience-wide (no audienceId filter); every other role sees exactly its own
 * stream, matching the header bell.
 */
function tabsForUser(user: DemoUser): TabSpec[] {
  switch (user.role) {
    case 'CUSTOMER':
    case 'INSTITUTION':
      return [{ key: 'customer', audiences: [{ audience: 'CUSTOMER', audienceId: user.customerId ?? '' }] }]
    case 'WORKER':
      return [{ key: 'worker', audiences: [{ audience: 'WORKER', audienceId: user.workerId ?? '' }] }]
    case 'COOP_ADMIN':
      return [{ key: 'coop', audiences: [{ audience: 'COOP', audienceId: user.orgId ?? '' }] }]
    case 'TALUKA_COORD':
    case 'DISTRICT_COORD':
      return [{
        key: 'network',
        audiences: [
          { audience: 'STATE', audienceId: user.federationId ?? '' },
          { audience: 'DISTRICT', audienceId: user.districtId ?? '' },
          { audience: 'TALUKA', audienceId: user.talukaId ?? '' },
        ],
      }]
    default:
      // STATE_ADMIN / NATIONAL_ADMIN / PLATFORM_ADMIN — oversight across all streams
      return [
        { key: 'customer', audiences: [{ audience: 'CUSTOMER', audienceId: '' }] },
        { key: 'worker', audiences: [{ audience: 'WORKER', audienceId: '' }] },
        { key: 'coop', audiences: [{ audience: 'COOP', audienceId: '' }] },
        { key: 'network', audiences: [{ audience: 'STATE', audienceId: '' }, { audience: 'PLATFORM', audienceId: '' }] },
      ]
  }
}

function typeIcon(type: string) {
  if (type === 'SUCCESS') return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
  if (type === 'WARNING') return <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
  if (type === 'EMERGENCY') return <Siren className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
  return <Bell className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
}

interface NotifResp { ok: boolean; notifications: NotificationDTO[]; unread: number }

export function NotificationCenter({ user, open, onOpenChange }: { user: DemoUser; open: boolean; onOpenChange: (o: boolean) => void }) {
  const lang = useAppStore((s) => s.lang)
  const openBookingByRef = useAppStore((s) => s.openBookingByRef)
  const openWorkerTab = useAppStore((s) => s.openWorkerTab)
  const qc = useQueryClient()
  const tabs = useMemo(() => tabsForUser(user), [user])
  const [active, setActive] = useState<TabKey>(tabs[0]?.key ?? 'customer')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [marking, setMarking] = useState(false)

  const specs: FlatSpec[] = useMemo(
    () => tabs.flatMap((tb) => tb.audiences.map((a) => ({ tab: tb.key, audience: a.audience, audienceId: a.audienceId }))),
    [tabs]
  )

  const results = useQueries({
    queries: specs.map((s) => ({
      queryKey: ['notifications', s.audience, s.audienceId],
      queryFn: () =>
        api.get<NotifResp>(`/api/notifications?audience=${s.audience}${s.audienceId ? `&audienceId=${encodeURIComponent(s.audienceId)}` : ''}`),
      enabled: open,
      refetchInterval: 25000,
      staleTime: 5000,
    })),
  })

  const tabData = useMemo(
    () =>
      tabs.map((tb) => {
        const idxs: number[] = []
        specs.forEach((s, i) => { if (s.tab === tb.key) idxs.push(i) })
        const notifications = idxs.flatMap((i) => results[i]?.data?.notifications ?? []).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        const unread = idxs.reduce((acc, i) => acc + (results[i]?.data?.unread ?? 0), 0)
        const loading = idxs.some((i) => results[i]?.isLoading)
        const error = idxs.every((i) => results[i]?.isError)
        return { tab: tb, notifications, unread, loading, error }
      }),
    [tabs, specs, results]
  )

  const activeData = tabData.find((d) => d.tab.key === active) ?? tabData[0]
  const rows = (activeData?.notifications ?? []).filter((n) => (unreadOnly ? !n.read : true))
  const hasError = tabData.length > 0 && tabData.every((d) => d.error)

  const isCustomerSide = user.role === 'CUSTOMER' || user.role === 'INSTITUTION'
  const isWorker = user.role === 'WORKER'

  async function markOneRead(id: string) {
    await api.patch('/api/notifications', { id }).catch(() => {})
    qc.invalidateQueries({ queryKey: ['notifications'] })
  }

  async function markAllRead() {
    if (!activeData) return
    setMarking(true)
    await Promise.all(
      activeData.tab.audiences.map((a) =>
        api.patch('/api/notifications', { audience: a.audience, audienceId: a.audienceId }).catch(() => {})
      )
    )
    setMarking(false)
    qc.invalidateQueries({ queryKey: ['notifications'] })
  }

  function rowClick(n: NotificationDTO) {
    if (!n.read) markOneRead(n.id)
    const ref = n.body.match(/GS-\d{6}-\d+/)?.[0] ?? null
    if (isCustomerSide && n.audience === 'CUSTOMER' && ref) {
      onOpenChange(false)
      openBookingByRef(ref)
    } else if (isWorker && n.audience === 'WORKER' && ref) {
      onOpenChange(false)
      const s = `${n.title} ${n.body}`.toLowerCase()
      const tab = /payment|settled|payout/.test(s) ? 'earnings' : /welfare/.test(s) ? 'welfare' : /training|certification/.test(s) ? 'training' : /rating|review/.test(s) ? 'ratings' : 'jobs'
      openWorkerTab(tab)
    }
  }

  const deepLinkable = (n: NotificationDTO) =>
    (isCustomerSide && n.audience === 'CUSTOMER') || (isWorker && n.audience === 'WORKER')
      ? /GS-\d{6}-\d+/.test(n.body)
      : false

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] w-full max-w-xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-4 py-3 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Inbox className="h-4 w-4 text-primary" /> {t('ncTitle', lang)}
          </DialogTitle>
          <DialogDescription className="text-xs">{t('ncSub', lang)}</DialogDescription>
        </DialogHeader>

        {/* Tabs (only when more than one stream is visible) */}
        {tabs.length > 1 && (
          <div className="border-b px-4 pt-2">
            <div className="flex gap-1 overflow-x-auto pb-2" role="tablist" aria-label={t('ncTitle', lang)}>
              {tabData.map((d) => (
                <button
                  key={d.tab.key}
                  role="tab"
                  aria-selected={active === d.tab.key}
                  onClick={() => setActive(d.tab.key)}
                  className={cn(
                    'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition',
                    active === d.tab.key ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-muted-foreground hover:bg-accent hover:text-foreground'
                  )}
                >
                  {t(TAB_LABEL_KEY[d.tab.key], lang)}
                  <span
                    className={cn(
                      'inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full px-1 py-0.5 text-[9px] font-bold tabular-nums',
                      d.unread > 0 ? 'bg-destructive text-destructive-foreground' : 'bg-secondary text-secondary-foreground'
                    )}
                  >
                    {d.unread}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center justify-between gap-2 border-b px-4 py-2">
          <div className="flex gap-1" role="group" aria-label={t('ncAll', lang)}>
            <Button variant={unreadOnly ? 'ghost' : 'secondary'} size="sm" className="h-8 px-3 text-xs" onClick={() => setUnreadOnly(false)} aria-pressed={!unreadOnly}>
              {t('ncAll', lang)}
            </Button>
            <Button variant={unreadOnly ? 'secondary' : 'ghost'} size="sm" className="h-8 gap-1.5 px-3 text-xs" onClick={() => setUnreadOnly(true)} aria-pressed={unreadOnly}>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-destructive" aria-hidden /> {t('ncUnread', lang)}
            </Button>
          </div>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground" onClick={markAllRead} disabled={marking || (activeData?.unread ?? 0) === 0}>
            {marking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
            {t('ncMarkAll', lang)}
          </Button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-700">
          {hasError ? (
            <div className="p-6">
              <EmptyState
                icon={<Bell className="h-8 w-8" />}
                title={t('ncErr', lang)}
                action={
                  <Button size="sm" className="h-10" onClick={() => qc.invalidateQueries({ queryKey: ['notifications'] })}>
                    {t('ncRetry', lang)}
                  </Button>
                }
              />
            </div>
          ) : activeData?.loading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-6">
              <EmptyState icon={<Inbox className="h-8 w-8" />} title={unreadOnly ? t('ncEmptyUnread', lang) : t('ncEmpty', lang)} />
            </div>
          ) : (
            <ul className="divide-y" aria-label={t('ncTitle', lang)}>
              {rows.map((n) => {
                const clickable = deepLinkable(n)
                const inner = (
                  <>
                    {typeIcon(n.type)}
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-semibold">{n.title}</span>
                        {!n.read && <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-label="unread" />}
                        <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground/70">{timeAgo(n.createdAt)}</span>
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">{n.body}</span>
                      <span className="mt-1 flex items-center gap-1.5">
                        <Badge variant="outline" className="px-1.5 py-0 text-[9px] font-medium text-muted-foreground">
                          {n.audience === 'STATE' ? t('ncTabNetwork', lang) : n.audience === 'COOP' ? t('ncTabCoop', lang) : n.audience === 'WORKER' ? t('ncTabWorker', lang) : n.audience === 'CUSTOMER' ? t('ncTabCustomer', lang) : n.audience}
                        </Badge>
                        {clickable && (
                          <span className="inline-flex items-center gap-0.5 rounded-full border border-primary/30 bg-accent px-1.5 py-px text-[9px] font-semibold text-primary">
                            <CheckCircle2 className="h-2.5 w-2.5" /> {t('ncViewBooking', lang)}
                          </span>
                        )}
                      </span>
                    </span>
                  </>
                )
                return (
                  <li key={n.id}>
                    <button
                      className={cn(
                        'flex w-full gap-2.5 px-4 py-3 text-left transition-colors hover:bg-accent/60',
                        !n.read && 'bg-accent/40',
                        clickable && 'cursor-pointer'
                      )}
                      onClick={() => rowClick(n)}
                    >
                      {inner}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Footer count */}
        <div className="border-t px-4 py-2 text-[11px] text-muted-foreground">
          {(activeData?.unread ?? 0) > 0
            ? `${activeData!.unread} ${t('ncUnreadN', lang)}`
            : t('ncEmptyUnread', lang)}
        </div>
      </DialogContent>
    </Dialog>
  )
}
