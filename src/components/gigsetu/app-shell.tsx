'use client'

import { useState } from 'react'
import { useAppStore, ROLE_VIEWS, type View } from '@/store/app-store'
import { useDemoStore } from '@/store/demo-store'
import { t, LANG_LABEL } from '@/lib/i18n'
import { api, timeAgo } from '@/lib/api-client'
import { Logo, PrototypeNotice } from './shared/ui-kit'
import { NotificationCenter } from './shared/notification-center'
import { GeoMap } from './shared/geo-map'
import { CustomerApp } from './customer/customer-app'
import { DemoEngine } from './demo/demo-engine'
import { DemoPanel } from './demo/demo-panel'
import { PresentationStrip } from './demo/presentation-mode'
import { startSihDemo, stopSihDemo } from './demo/demo-launch'
import { GlobalSearch } from './shared/search-dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { useToast } from '@/hooks/use-toast'
import type { DemoUser, Lang, NotificationDTO, Role } from '@/lib/types'
import {
  Bell, LogOut, Sun, Moon, Repeat, Play, Square, CheckCircle2, CircleDot, ArrowDown, Inbox,
} from 'lucide-react'

/** Row classes for notification items — unread tint + hover affordance when deep-linkable. */
function cnRow(unread: boolean, clickable: boolean): string {
  return [
    'flex w-full gap-2 border-b px-3 py-2.5 text-left last:border-0',
    unread ? 'bg-accent/50' : '',
    clickable ? 'cursor-pointer transition-colors hover:bg-accent' : '',
  ].filter(Boolean).join(' ')
}

const VIEW_LABELS: Record<View, string> = {
  login: 'Login', customer: 'Customer App', worker: 'Worker App', coop: 'Cooperative Dashboard',
  taluka: 'Taluka Dashboard', district: 'District Command Center', state: 'State Federation',
  national: 'National Apex', government: 'Government & Institutional Ecosystem', hierarchy: 'Cooperative Hierarchy',
  exchange: 'Cooperative Service Exchange', ai: 'AI Intelligence (Forecast · Skill Gap · Allocation)',
  whatsapp: 'WhatsApp Booking Assistant', platform: 'Platform Admin', map: 'Map & Geo View',
}

function notificationTarget(user: DemoUser): { audience: string; audienceId: string } | null {
  switch (user.role) {
    case 'CUSTOMER':
    case 'INSTITUTION':
      return { audience: 'CUSTOMER', audienceId: user.customerId ?? '' }
    case 'WORKER':
      return { audience: 'WORKER', audienceId: user.workerId ?? '' }
    case 'COOP_ADMIN':
      return { audience: 'COOP', audienceId: user.orgId ?? '' }
    case 'STATE_ADMIN':
    case 'DISTRICT_COORD':
      return { audience: 'STATE', audienceId: user.federationId ?? '' }
    default:
      return null
  }
}

function NotificationsBell({ user }: { user: DemoUser }) {
  const target = notificationTarget(user)
  const lang = useAppStore((s) => s.lang)
  const openBookingByRef = useAppStore((s) => s.openBookingByRef)
  const openWorkerTab = useAppStore((s) => s.openWorkerTab)
  const [open, setOpen] = useState(false)
  const [centerOpen, setCenterOpen] = useState(false)
  const queryKey = ['notifications', target?.audience, target?.audienceId]
  const { data } = useQuery({
    queryKey,
    queryFn: () => api.get<{ ok: boolean; notifications: NotificationDTO[]; unread: number }>(`/api/notifications?audience=${target?.audience}&audienceId=${target?.audienceId}`),
    enabled: !!target,
    refetchInterval: 15000,
  })
  const qc = useQueryClient()
  async function markAllRead() {
    await api.patch('/api/notifications', { audience: target?.audience, audienceId: target?.audienceId }).catch(() => {})
    qc.invalidateQueries({ queryKey })
  }
  async function markOneRead(id: string) {
    await api.patch('/api/notifications', { id }).catch(() => {})
    qc.invalidateQueries({ queryKey })
  }
  if (!target) {
    // No personal notification stream (e.g. platform/national) — the bell opens
    // the notification center directly (oversight across all streams).
    return (
      <>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t('ncOpen', lang)} onClick={() => setCenterOpen(true)}>
          <Bell className="h-4 w-4" />
        </Button>
        <NotificationCenter user={user} open={centerOpen} onOpenChange={setCenterOpen} />
      </>
    )
  }
  const unread = data?.unread ?? 0
  const isCustomerSide = user.role === 'CUSTOMER' || user.role === 'INSTITUTION'
  const isWorker = user.role === 'WORKER'
  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative h-8 w-8" aria-label={`${t('notifications', lang)}${unread > 0 ? ` (${unread})` : ''}`}>
            <Bell className="h-4 w-4" />
            {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">{unread}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">{t('notifications', lang)}</span>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px] text-muted-foreground" onClick={markAllRead}>
              {t('markAllRead', lang)}
            </Button>
          )}
        </div>
        <ScrollArea className="h-72">
          {(data?.notifications ?? []).length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">{t('noNotifications', lang)}</p>
          ) : (
            data!.notifications.map((n) => {
              // Booking deep-link: engine notifications embed the refCode in the body ("Job GS-202609-7777 …")
              const ref = isCustomerSide || isWorker ? n.body.match(/GS-\d{6}-\d+/)?.[0] ?? null : null
              // Worker deep-link: pick the destination tab from the notification content
              const workerTab = (() => {
                const s = `${n.title} ${n.body}`.toLowerCase()
                if (/payment|settled|payout/.test(s)) return 'earnings'
                if (/welfare/.test(s)) return 'welfare'
                if (/training|certification/.test(s)) return 'training'
                if (/rating|review/.test(s)) return 'ratings'
                return 'jobs'
              })()
              const clickable = isCustomerSide ? !!ref : isWorker ? !!ref : false
              const RowInner = (
                <>
                  {n.type === 'SUCCESS' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> : n.type === 'WARNING' || n.type === 'EMERGENCY' ? <Bell className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" /> : <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold leading-snug">{n.title}{!n.read && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" aria-label="unread" />}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-[10px] text-muted-foreground/70">
                      {timeAgo(n.createdAt)}
                      {clickable && (
                        <span className="inline-flex items-center gap-0.5 rounded-full border border-primary/30 bg-accent px-1.5 py-px font-semibold text-primary">
                          <ArrowDown className="h-2.5 w-2.5" /> {isWorker ? t(workerTab, lang) : t('viewBooking', lang)}
                        </span>
                      )}
                    </p>
                  </div>
                </>
              )
              const cls = cnRow(!n.read, clickable)
              return clickable ? (
                <button
                  key={n.id}
                  className={cls}
                  onClick={() => {
                    setOpen(false)
                    if (!n.read) markOneRead(n.id)
                    if (isCustomerSide) openBookingByRef(ref!)
                    else if (isWorker) openWorkerTab(workerTab)
                  }}
                >
                  {RowInner}
                </button>
              ) : (
                <div key={n.id} className={cls}>
                  {RowInner}
                </div>
              )
            })
          )}
        </ScrollArea>
        <div className="border-t p-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-full justify-center gap-1.5 text-xs text-muted-foreground"
            onClick={() => { setOpen(false); setCenterOpen(true) }}
          >
            <Inbox className="h-3.5 w-3.5" /> {t('ncOpen', lang)}
          </Button>
        </div>
      </PopoverContent>
      </Popover>
      <NotificationCenter user={user} open={centerOpen} onOpenChange={setCenterOpen} />
    </>
  )
}

function RoleSwitcher({ user }: { user: DemoUser }) {
  const { login } = useAppStore()
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <Repeat className="h-3.5 w-3.5" />
          <span className="hidden max-w-[130px] truncate sm:inline">{user.name}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Switch demo role</DialogTitle>
          <DialogDescription>Every role shares the same live data layer</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(['CUSTOMER', 'WORKER', 'COOP_ADMIN', 'TALUKA_COORD', 'DISTRICT_COORD', 'STATE_ADMIN', 'NATIONAL_ADMIN', 'INSTITUTION', 'PLATFORM_ADMIN'] as Role[]).map((r) => (
            <Button
              key={r}
              variant={user.role === r ? 'default' : 'outline'}
              size="sm"
              className="justify-start text-xs"
              disabled={user.role === r}
              onClick={async () => {
                setOpen(false)
                const res = await api.get<{ ok: boolean; user: DemoUser }>(`/api/session?role=${r}`)
                login(res.user)
              }}
            >
              {r.replace(/_/g, ' ')}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function AppShell() {
  const { user, view, lang, setLang, setView, logout } = useAppStore()
  const { resolvedTheme, setTheme } = useTheme()
  const demoActive = useDemoStore((s) => s.active)
  const presentation = useDemoStore((s) => s.presentation)
  const qc = useQueryClient()
  const { toast } = useToast()

  async function handleStartDemo() {
    try {
      await startSihDemo(qc)
    } catch (e) {
      toast({
        title: 'Could not start the SIH demo',
        description: e instanceof Error ? e.message : 'Please try again in a moment.',
        variant: 'destructive',
      })
    }
  }

  if (!user) return null

  const allowedViews: Array<{ key: View; label: string }> = ROLE_VIEWS[user.role].map((key) => ({
    key,
    label: VIEW_LABELS[key],
  }))
  const presentationOn = demoActive && presentation

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {presentationOn ? (
        <PresentationStrip />
      ) : (
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-3 sm:px-6">
          <button className="flex items-center gap-2" onClick={() => setView(defaultHome(user.role))} aria-label="GigSetu home">
            <Logo compact />
            <span className="hidden text-sm font-bold sm:inline">GigSetu</span>
          </button>
          <Separator orientation="vertical" className="mx-1 hidden h-5 sm:block" />
          <Badge variant="secondary" className="hidden max-w-[280px] truncate text-[11px] font-medium md:inline-flex">
            {VIEW_LABELS[view]}
          </Badge>

          <div className="ml-auto flex items-center gap-1.5">
            {allowedViews.length > 0 && (
              <Select value={view} onValueChange={(v) => setView(v as View)}>
                <SelectTrigger className="h-8 w-[120px] text-xs sm:w-[160px]" aria-label="View">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {allowedViews.map((v) => (
                    <SelectItem key={v.key} value={v.key} className="text-xs">{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <NotificationsBell user={user} />
            <GlobalSearch />
            {demoActive ? (
              <Button variant="outline" size="sm" className="h-8 gap-1.5 border-destructive/40 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={stopSihDemo}>
                <Square className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Stop demo</span>
              </Button>
            ) : (
              <Button variant="default" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleStartDemo} aria-label="Start SIH Demo">
                <Play className="h-3.5 w-3.5 fill-current" />
                <span className="hidden sm:inline">Start SIH Demo</span>
                <span className="sm:hidden">Demo</span>
              </Button>
            )}
            <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
              <SelectTrigger className="h-8 w-[92px] text-xs" aria-label="Language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LANG_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Toggle theme" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
              <Sun className="h-4 w-4 dark:hidden" /><Moon className="hidden h-4 w-4 dark:block" />
            </Button>
            <RoleSwitcher user={user} />
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t('logout', lang)} onClick={logout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
        </header>
      )}

      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 sm:px-6 sm:py-6">
        <motion.div
          key={`${view}-${user.role}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          <ViewRouter view={view} user={user} />
        </motion.div>
      </main>

      {!presentationOn && (
        <footer className="mt-auto border-t bg-card/60 px-4 py-3 text-center text-[11px] text-muted-foreground sm:px-6">
          GigSetu — India&apos;s Cooperative Workforce Operating System · SIH prototype · synthetic data, designed for authorized integration
        </footer>
      )}

      {/* Phase 6 — SIH Demo Mode: silent engine + floating control panel */}
      <DemoEngine />
      <DemoPanel />
    </div>
  )
}

function defaultHome(role: Role): View {
  switch (role) {
    case 'CUSTOMER':
    case 'INSTITUTION': return 'customer'
    case 'WORKER': return 'worker'
    case 'COOP_ADMIN': return 'coop'
    case 'TALUKA_COORD': return 'taluka'
    case 'DISTRICT_COORD': return 'district'
    case 'STATE_ADMIN': return 'state'
    case 'NATIONAL_ADMIN': return 'national'
    default: return 'platform'
  }
}

// Lazy imports kept simple — all views are client components in this prototype
import { WorkerApp } from './worker/worker-app'
import { CoopApp } from './coop/coop-app'
import { TalukaDashboard } from './hierarchy/taluka-dashboard'
import { DistrictDashboard } from './hierarchy/district-dashboard'
import { StateDashboard } from './hierarchy/state-dashboard'
import { NationalDashboard } from './hierarchy/national-dashboard'
import { GovernmentEcosystem } from './hierarchy/government-ecosystem'
import { HierarchyView } from './hierarchy/hierarchy-view'
import { ServiceExchange } from './hierarchy/service-exchange'
import { AiIntelligence } from './ai/ai-intelligence'
import { WhatsAppBot } from './customer/whatsapp-bot'
import { PlatformAdmin } from './platform-admin'

function ViewRouter({ view, user }: { view: View; user: DemoUser }) {
  const focusIds = useAppStore((s) => s.focusIds)
  switch (view) {
    case 'customer': return <CustomerApp user={user} />
    case 'worker': return <WorkerApp user={user} />
    case 'coop': return <CoopApp user={user} focusCoopId={focusIds.coop} />
    case 'taluka': return <TalukaDashboard user={user} focusId={focusIds.taluka} />
    case 'district': return <DistrictDashboard user={user} focusId={focusIds.district} />
    case 'state': return <StateDashboard user={user} />
    case 'national': return <NationalDashboard user={user} />
    case 'government': return <GovernmentEcosystem />
    case 'hierarchy': return <HierarchyView user={user} />
    case 'exchange': return <ServiceExchange user={user} />
    case 'ai': return <AiIntelligence user={user} />
    case 'whatsapp': return <WhatsAppBot user={user} />
    case 'platform': return <PlatformAdmin user={user} />
    case 'map': return <GeoMap user={user} />
    default: return <PrototypeNotice>Unknown view.</PrototypeNotice>
  }
}
