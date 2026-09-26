'use client'

// GigSetu Phase 6 — LANDING PAGE (Tasks #53/#80/#83/#52/#71, agent 15-c).
// Public-facing polish layer: hero, live network stats, how-it-works, why,
// USP strip, NOT/IS differentiation, cooperative flywheel, refreshed concept
// note, the compact role login grid (demo entries) and the About/Impact mount.
// Mounted by gigsetu-app.tsx when no session user is present (contract kept).

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { useAppStore } from '@/store/app-store'
import { useDemoStore } from '@/store/demo-store'
import { api, signInAs } from '@/lib/api-client'
import { t, LANG_LABEL } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Logo, PrototypeNotice } from './shared/ui-kit'
import { GlobalSearch } from './shared/search-dialog'
import { AboutModel } from './shared/about-model'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useTheme } from '@/components/theme-provider'
import { useToast } from '@/hooks/use-toast'
import type { DemoUser, Lang, Role } from '@/lib/types'
import {
  User, HardHat, Building2, Landmark, Network, Map, Flag, Globe2, Server, Loader2,
  Play, ArrowRight, ArrowDown, BookOpen, Sparkles, ShieldCheck, HeartHandshake,
  Scale, Siren, Handshake, Home, Check, X, Zap, Droplets, Phone, Activity,
} from 'lucide-react'

// ---------- data ----------

const ROLE_OPTIONS: Array<{ role: Role; label: string; desc: string; icon: React.ReactNode; color: string }> = [
  { role: 'CUSTOMER', label: 'Customer', desc: 'Anita · household booking', icon: <User className="h-5 w-5" />, color: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  { role: 'WORKER', label: 'Worker', desc: 'Rajesh · Skill Passport', icon: <HardHat className="h-5 w-5" />, color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  { role: 'COOP_ADMIN', label: 'Cooperative', desc: 'Pune Electrical · 248 workers', icon: <Building2 className="h-5 w-5" />, color: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' },
  { role: 'TALUKA_COORD', label: 'Taluka', desc: 'Haveli · coordination', icon: <Map className="h-5 w-5" />, color: 'bg-lime-100 text-lime-700 dark:bg-lime-950 dark:text-lime-300' },
  { role: 'DISTRICT_COORD', label: 'District', desc: 'Pune · command center', icon: <Network className="h-5 w-5" />, color: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300' },
  { role: 'STATE_ADMIN', label: 'State Federation', desc: 'Maharashtra · intelligence', icon: <Flag className="h-5 w-5" />, color: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' },
  { role: 'NATIONAL_ADMIN', label: 'National / Apex', desc: 'Apex network · overview', icon: <Globe2 className="h-5 w-5" />, color: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300' },
  { role: 'INSTITUTION', label: 'Institution', desc: 'St. Mary\u2019s Hostel · AMC', icon: <Landmark className="h-5 w-5" />, color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300' },
  { role: 'PLATFORM_ADMIN', label: 'Platform Admin', desc: 'GigSetu Ops · system', icon: <Server className="h-5 w-5" />, color: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300' },
]

const HOW_STEPS: Array<{ icon: React.ReactNode; title: string; caption: string; tone: string }> = [
  { icon: <HardHat className="h-6 w-6" />, title: 'Worker', caption: 'Skilled workers join their local cooperative — identity, skills and certifications verified.', tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  { icon: <Building2 className="h-6 w-6" />, title: 'Cooperative', caption: 'The society aggregates, trains and guarantees its workers — welfare and quality are owned here.', tone: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' },
  { icon: <Sparkles className="h-6 w-6" />, title: 'GigSetu', caption: 'The operating layer matches demand to capacity with AI — bookings, fair pricing, service evidence.', tone: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  { icon: <Home className="h-6 w-6" />, title: 'Customer', caption: 'Households and institutions receive trusted service — every booking funds the welfare wallet.', tone: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300' },
]

const WHY_CARDS: Array<{ icon: React.ReactNode; title: string; body: string; tone: string }> = [
  { icon: <Handshake className="h-5 w-5" />, title: 'Cooperative ownership', body: 'Cooperatives own the network — the platform serves them, workers stay in control of their institution.', tone: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  { icon: <Sparkles className="h-5 w-5" />, title: 'AI workforce intelligence', body: 'Matching, demand forecasting, skill-gap and preventive maintenance — AI tuned for cooperative capacity.', tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  { icon: <ShieldCheck className="h-5 w-5" />, title: 'Verified skills', body: 'A Digital Skill Passport with verified certifications — customers always know who is entering their home.', tone: 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' },
  { icon: <HeartHandshake className="h-5 w-5" />, title: 'Worker welfare', body: 'A welfare wallet funded by every booking — insurance, training, social security and emergency support.', tone: 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300' },
  { icon: <Scale className="h-5 w-5" />, title: 'Fair pricing', body: 'A federation rate card with transparent splits — ≈86% of every rupee reaches the worker, printed on receipts.', tone: 'bg-lime-100 text-lime-700 dark:bg-lime-950 dark:text-lime-300' },
  { icon: <Siren className="h-5 w-5" />, title: 'Emergency network', body: 'Emergency pools escalate from the local cooperative to taluka, district and federation reserve — minutes, not hours.', tone: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' },
]

const USP_LINES = [
  'Cooperative Service Exchange',
  'AI Workforce Intelligence',
  'Digital Skill Passport',
  'Worker Welfare Wallet',
  'Multilingual WhatsApp Booking',
  'Fair Pricing Engine',
  'Emergency Cooperative Network',
  'Federation Workforce Command Center',
  'Cross-Cooperative Capacity Allocation',
  'Preventive Maintenance Intelligence',
  'Cooperative Institutional Contracts',
]

const FLYWHEEL: Array<{ label: string; caption: string }> = [
  { label: 'More Cooperatives', caption: 'Every society onboarded strengthens the network' },
  { label: 'More Verified Workers', caption: 'Cooperatives bring verified, certified skills' },
  { label: 'More Network Capacity', caption: 'More capacity means shorter wait times' },
  { label: 'Faster Service Assurance', caption: 'Requests are fulfilled faster and more reliably' },
  { label: 'More Customer Trust', caption: 'Reliable, accountable service builds trust' },
  { label: 'More Demand', caption: 'Trusted customers generate more bookings' },
  { label: 'More Jobs for Workers', caption: 'Steady demand means steady work' },
  { label: 'Better Worker Income', caption: 'Fair pricing raises worker earnings' },
  { label: 'More Welfare Contribution', caption: 'Every job funds the welfare wallet' },
  { label: 'Better Training & Skills', caption: 'Welfare funds training and certification' },
  { label: 'Stronger Cooperatives', caption: 'Skilled, insured workers strengthen societies' },
]

const NOT_LIST = ['just a booking app', 'a worker marketplace', 'a WhatsApp chatbot', 'a government database']

interface NationalPulse {
  ok: boolean
  national: { districts: number; cooperatives: number; workers: number; jobsToday: number } | null
}

// ---------- flywheel ----------

function splitCaption(caption: string): [string, string] {
  if (caption.length <= 34) return [caption, '']
  const words = caption.split(' ')
  let a = ''
  let i = 0
  while (i < words.length && (a.length + words[i].length + 1) * 5.6 <= 150) {
    a += (a ? ' ' : '') + words[i]
    i++
  }
  return [a, words.slice(i).join(' ')]
}

function Flywheel({ active, setActive }: { active: number | null; setActive: (i: number | null) => void }) {
  const CX = 260
  const CY = 235
  const R = 158
  const NODE_R = 27
  const gapDeg = 13.5
  const pos = FLYWHEEL.map((_, i) => {
    const deg = -90 + i * (360 / FLYWHEEL.length)
    const rad = (deg * Math.PI) / 180
    return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad), deg }
  })
  const arcs = FLYWHEEL.map((_, i) => {
    const a = pos[i]
    const b = pos[(i + 1) % FLYWHEEL.length]
    const aRad = ((a.deg + gapDeg) * Math.PI) / 180
    const bRad = ((b.deg - gapDeg) * Math.PI) / 180
    const x1 = CX + R * Math.cos(aRad)
    const y1 = CY + R * Math.sin(aRad)
    const x2 = CX + R * Math.cos(bRad)
    const y2 = CY + R * Math.sin(bRad)
    return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${R} ${R} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`
  })
  const current = active !== null ? FLYWHEEL[active] : null
  const capLines = current ? splitCaption(current.caption) : ['', '']

  return (
    <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-center lg:justify-center">
      <svg
        viewBox="0 0 520 470"
        className="w-full max-w-[520px] shrink-0"
        role="img"
        aria-label="Cooperative flywheel — an 11-step loop: more cooperatives bring more verified workers and capacity, which builds trust and demand, jobs, income, welfare, training and stronger cooperatives, looping back to more cooperatives."
      >
        <defs>
          <marker id="fly-arrow" viewBox="0 0 8 8" refX="6" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L8,4 L0,8 z" className="fill-zinc-400 dark:fill-zinc-600" />
          </marker>
        </defs>
        {arcs.map((d, i) => (
          <path key={i} d={d} fill="none" className="stroke-zinc-300 dark:stroke-zinc-700" strokeWidth={1.6} markerEnd="url(#fly-arrow)" />
        ))}
        <circle cx={CX} cy={CY} r={NODE_R + 58} className="fill-muted/40 dark:fill-zinc-900/40" aria-hidden />
        {pos.map((p, i) => {
          const isActive = active === i
          return (
            <g
              key={FLYWHEEL[i].label}
              role="button"
              tabIndex={0}
              aria-label={`${i + 1}. ${FLYWHEEL[i].label} — ${FLYWHEEL[i].caption}`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="cursor-pointer outline-none"
            >
              <circle
                cx={p.x}
                cy={p.y}
                r={NODE_R}
                className={cn(
                  'stroke-[2] transition-colors',
                  isActive ? 'fill-amber-100 stroke-amber-500 dark:fill-amber-950 dark:stroke-amber-400' : 'fill-card stroke-border'
                )}
              />
              <text x={p.x} y={p.y + 5} textAnchor="middle" className={cn('pointer-events-none text-[13px] font-bold tabular-nums', isActive ? 'fill-amber-700 dark:fill-amber-300' : 'fill-foreground')}>
                {i + 1}
              </text>
              <title>{`${FLYWHEEL[i].label} — ${FLYWHEEL[i].caption}`}</title>
            </g>
          )
        })}
        <text x={CX} y={CY - 14} textAnchor="middle" className="fill-muted-foreground text-[10px] font-semibold uppercase tracking-[0.18em]">
          {current ? current.label : 'One loop'}
        </text>
        <text x={CX} y={CY + 8} textAnchor="middle" className="fill-foreground text-[13px] font-bold">
          {current ? capLines[0] : 'every cooperative'}
        </text>
        <text x={CX} y={CY + 26} textAnchor="middle" className="fill-foreground text-[13px] font-bold">
          {current ? capLines[1] : 'wins'}
        </text>
      </svg>

      <ol className="grid w-full max-w-md grid-cols-1 gap-1 sm:grid-cols-2 lg:max-w-sm lg:grid-cols-1">
        {FLYWHEEL.map((f, i) => (
          <li key={f.label}>
            <button
              type="button"
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              aria-label={`${f.label} — ${f.caption}`}
              className={cn(
                'flex w-full items-baseline gap-2 rounded-lg px-2 py-1 text-left text-xs transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
                active === i ? 'bg-accent' : 'hover:bg-accent/60'
              )}
            >
              <span className={cn('inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold', active === i ? 'bg-amber-500 text-white' : 'bg-muted text-muted-foreground')}>
                {i + 1}
              </span>
              <span className={cn('truncate', active === i ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{f.label}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

// ---------- page ----------

export function LoginScreen() {
  const { login, lang, setLang } = useAppStore()
  const { resolvedTheme, setTheme } = useTheme()
  const { toast } = useToast()
  const [loading, setLoading] = useState<Role | null>(null)
  const [error, setError] = useState('')
  const [aboutOpen, setAboutOpen] = useState(false)
  const [conceptOpen, setConceptOpen] = useState(false)
  const [flywheelActive, setFlywheelActive] = useState<number | null>(null)
  const demoActive = useDemoStore((s) => s.active)

  // Live network pulse — real numbers from the seeded federation graph
  const pulseQ = useQuery({
    queryKey: ['national-pulse'],
    queryFn: () => api.get<NationalPulse>('/api/hierarchy/dashboard?level=national'),
    staleTime: 60_000,
    refetchInterval: 30_000,
    retry: false,
  })
  const pulse = pulseQ.data?.national
  const catQ = useQuery({
    queryKey: ['landing-categories'],
    queryFn: () => api.get<{ ok: boolean; categories: unknown[] }>('/api/categories'),
    staleTime: 300_000,
    retry: false,
  })
  const serviceCount = catQ.data?.categories?.length ?? null

  async function handleLogin(role: Role) {
    setLoading(role)
    setError('')
    try {
      const res = await signInAs<{ ok: boolean; user: DemoUser }>(role)
      if (!res.user) throw new Error(`No demo identity available for ${role}. Run: npm run db:seed`)
      login(res.user)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(null)
    }
  }

  // SIH demo entry — reset + scripted login lives in the demo engine
  // (startSihDemo in demo-launch.ts).
  async function handleStartDemo() {
    try {
      const mod = await import('@/components/gigsetu/demo/demo-launch')
      if (typeof mod.startSihDemo !== 'function') throw new Error('startSihDemo export not found')
      await mod.startSihDemo()
    } catch (e) {
      // Surface the REAL reason. The old copy always claimed the module was
      // "still loading", which sent people hunting a phantom import bug while
      // the actual failure was a 401/400 from the auth or reset call.
      toast({
        title: 'Could not start the SIH demo',
        description: (e as Error).message || 'Unknown error — check the browser console and the dev server log.',
        variant: 'destructive',
      })
    }
  }

  const fadeUp = {
    initial: { opacity: 0, y: 14 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-40px' },
    transition: { duration: 0.35, ease: 'easeOut' as const },
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-2 px-4 py-2.5 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8 hidden text-xs md:inline-flex" onClick={() => setAboutOpen(true)}>
              <BookOpen className="mr-1.5 h-3.5 w-3.5" /> {t('lpHowTitle', lang)}
            </Button>
            <GlobalSearch />
            <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
              <SelectTrigger className="h-8 w-[104px] text-xs" aria-label="Language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(LANG_LABEL).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost" size="icon" className="h-8 w-8" aria-label="Toggle theme"
              onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            >
              <Sparkles className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 sm:px-6">
        {/* ============ HERO ============ */}
        <section className="mx-auto flex max-w-3xl flex-col items-center gap-5 py-10 text-center sm:py-14">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: 'easeOut' }} className="space-y-4">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-[11px] font-medium text-muted-foreground">
              <Activity className="h-3 w-3 text-emerald-500" aria-hidden />
              {t('lpHeroBadge', lang)}
            </span>
            <div className="flex items-center justify-center gap-3">
              <p className="text-4xl font-extrabold tracking-tight sm:text-5xl">
                GIG<span className="text-primary">SETU</span>
              </p>
            </div>
            <h1 className="text-xl font-bold leading-snug tracking-tight sm:text-3xl">
              {t('lpHeadline', lang)}
            </h1>
            <p className="mx-auto max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              {t('lpSub', lang)}
            </p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.08, ease: 'easeOut' }} className="w-full space-y-3">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button size="lg" className="h-11 flex-1 min-w-[150px] text-xs font-bold tracking-wide sm:flex-none" onClick={() => handleLogin('CUSTOMER')} disabled={loading !== null}>
                {loading === 'CUSTOMER' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Home className="mr-1.5 h-4 w-4" />}
                {t('lpCtaBook', lang)}
              </Button>
              <Button size="lg" variant="secondary" className="h-11 flex-1 min-w-[150px] text-xs font-bold tracking-wide sm:flex-none" onClick={() => handleLogin('WORKER')} disabled={loading !== null}>
                {loading === 'WORKER' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <HardHat className="mr-1.5 h-4 w-4" />}
                {t('lpCtaJoin', lang)}
              </Button>
              <Button size="lg" variant="outline" className="h-11 flex-1 min-w-[150px] text-xs font-bold tracking-wide sm:flex-none" onClick={() => handleLogin('COOP_ADMIN')} disabled={loading !== null}>
                {loading === 'COOP_ADMIN' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Building2 className="mr-1.5 h-4 w-4" />}
                {t('lpCtaCoop', lang)}
              </Button>
              <Button size="lg" variant="outline" className="h-11 flex-1 min-w-[150px] text-xs font-bold tracking-wide sm:flex-none" onClick={() => handleLogin('INSTITUTION')} disabled={loading !== null}>
                {loading === 'INSTITUTION' ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Landmark className="mr-1.5 h-4 w-4" />}
                {t('lpCtaInst', lang)}
              </Button>
            </div>
            <Button
              size="lg"
              className={cn(
                'h-11 w-full max-w-sm text-xs font-bold uppercase tracking-widest shadow-md',
                'bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200',
                demoActive && 'bg-emerald-600 text-white hover:bg-emerald-600 dark:bg-emerald-500 dark:text-white'
              )}
              onClick={handleStartDemo}
              aria-label={demoActive ? 'SIH demo is running' : 'Start the scripted SIH demo'}
            >
              {demoActive ? <Activity className="mr-2 h-4 w-4 animate-pulse" /> : <Play className="mr-2 h-4 w-4 fill-current" />}
              {demoActive ? t('lpDemoRunning', lang) : `▶ ${t('lpCtaDemo', lang)}`}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              {t('positioning', lang)} — SIH prototype with seeded synthetic data.
            </p>
          </motion.div>
        </section>

        {/* ============ TRUSTED COOPERATIVE NETWORK (live stats) ============ */}
        <motion.section {...fadeUp} aria-label="Trusted cooperative network statistics" className="rounded-2xl border bg-card p-5 sm:p-6">
          <p className="mb-4 flex items-center justify-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            {t('lpTrusted', lang)}
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { v: pulse ? pulse.workers.toLocaleString('en-IN') : '—', l: 'Cooperative workers', i: <HardHat className="h-3.5 w-3.5" /> },
              { v: pulse ? pulse.cooperatives.toLocaleString('en-IN') : '—', l: 'Cooperatives', i: <Building2 className="h-3.5 w-3.5" /> },
              { v: pulse ? pulse.districts.toLocaleString('en-IN') : '—', l: 'Districts', i: <Network className="h-3.5 w-3.5" /> },
              { v: serviceCount !== null ? serviceCount.toLocaleString('en-IN') : '—', l: t('lpStatServices', lang), i: <Zap className="h-3.5 w-3.5" /> },
            ].map((s) => (
              <div key={s.l} className="rounded-xl bg-muted/40 px-2 py-3 text-center">
                <p className="text-2xl font-bold tabular-nums text-primary sm:text-3xl">{s.v}</p>
                <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {s.i}
                  {s.l}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-center text-[10px] leading-relaxed text-muted-foreground">
            Live seeded snapshot · 7 configurable hierarchy levels · 3 languages — <span className="font-medium">synthetic demo data, no live government APIs</span>
          </p>
        </motion.section>

        {/* ============ HOW IT WORKS ============ */}
        <motion.section {...fadeUp} className="py-12 sm:py-16" aria-labelledby="how-title">
          <div className="mb-6 text-center">
            <h2 id="how-title" className="text-xl font-bold tracking-tight sm:text-2xl">{t('lpHowTitle', lang)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('lpHowSub', lang)}</p>
          </div>
          <ol className="flex flex-col items-stretch justify-center gap-2 md:flex-row md:items-center">
            {HOW_STEPS.map((s, i) => (
              <li key={s.title} className="flex flex-col items-center gap-2 md:flex-1 md:flex-row">
                <Card className="w-full py-4 md:py-5">
                  <CardContent className="flex items-start gap-3 px-4 md:flex-col md:items-center md:text-center">
                    <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', s.tone)} aria-hidden>
                      {s.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold">{s.title}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{s.caption}</span>
                    </span>
                  </CardContent>
                </Card>
                {i < HOW_STEPS.length - 1 && (
                  <>
                    <ArrowDown className="h-4 w-4 shrink-0 text-muted-foreground/60 md:hidden" aria-hidden />
                    <ArrowRight className="hidden h-4 w-4 shrink-0 text-muted-foreground/60 md:block" aria-hidden />
                  </>
                )}
              </li>
            ))}
          </ol>
        </motion.section>

        {/* ============ WHY GIGSETU ============ */}
        <motion.section {...fadeUp} className="pb-12 sm:pb-16" aria-labelledby="why-title">
          <div className="mb-6 text-center">
            <h2 id="why-title" className="text-xl font-bold tracking-tight sm:text-2xl">{t('lpWhyTitle', lang)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('lpWhySub', lang)}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {WHY_CARDS.map((c) => (
              <Card key={c.title} className="py-4 transition-shadow hover:shadow-md">
                <CardContent className="space-y-2 px-4">
                  <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', c.tone)} aria-hidden>
                    {c.icon}
                  </span>
                  <p className="text-sm font-bold">{c.title}</p>
                  <p className="text-xs leading-relaxed text-muted-foreground">{c.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.section>

        {/* ============ USP STRIP ============ */}
        <motion.section {...fadeUp} className="rounded-2xl border bg-muted/30 p-5 sm:p-6" aria-labelledby="usp-title">
          <h2 id="usp-title" className="mb-4 text-center text-sm font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t('lpUspTitle', lang)}
          </h2>
          <ul className="flex flex-wrap items-center justify-center gap-2">
            {USP_LINES.map((u) => (
              <li key={u} className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-xs font-medium shadow-sm">
                <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
                {u}
              </li>
            ))}
          </ul>
        </motion.section>

        {/* ============ DIFFERENTIATION (NOT / IS) ============ */}
        <motion.section {...fadeUp} className="py-12 sm:py-16" aria-labelledby="diff-title">
          <div className="mb-6 text-center">
            <h2 id="diff-title" className="text-xl font-bold tracking-tight sm:text-2xl">{t('lpDiffTitle', lang)}</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card className="border-dashed bg-muted/30 py-5">
              <CardContent className="px-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">GigSetu is NOT …</p>
                <ul className="mt-3 space-y-2.5">
                  {NOT_LIST.map((n) => (
                    <li key={n} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400" aria-hidden>
                        <X className="h-3 w-3" />
                      </span>
                      {n}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card className="border-primary/40 py-5 shadow-sm">
              <CardContent className="px-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">GigSetu IS …</p>
                <p className="mt-3 text-lg font-bold leading-snug">A Cooperative Workforce Operating System</p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  Government ecosystem + cooperative hierarchy + GigSetu operating layer + AI workforce
                  intelligence — serving customer demand and institutional demand while funding worker
                  welfare. The cooperative remains the institution of record.
                </p>
                <ul className="mt-3 space-y-1.5">
                  {['Cooperatives own the network and the customer relationship', 'Every rupee split is transparent and configurable', 'Designed for authorized government integration'].map((s) => (
                    <li key={s} className="flex items-center gap-2.5 text-xs text-muted-foreground">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" aria-hidden>
                        <Check className="h-3 w-3" />
                      </span>
                      {s}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </motion.section>

        {/* ============ FLYWHEEL ============ */}
        <motion.section {...fadeUp} className="pb-12 sm:pb-16" aria-labelledby="fly-title">
          <div className="mb-6 text-center">
            <h2 id="fly-title" className="text-xl font-bold tracking-tight sm:text-2xl">{t('lpFlyTitle', lang)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t('lpFlySub', lang)}</p>
          </div>
          <Flywheel active={flywheelActive} setActive={setFlywheelActive} />
        </motion.section>

        {/* ============ ROLE LOGIN (demo identities) ============ */}
        <motion.section {...fadeUp} className="pb-12" aria-labelledby="roles-title">
          <Card className="border-primary/30 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle id="roles-title" className="text-base">{t('lpRolesTitle', lang)}</CardTitle>
              <CardDescription className="text-xs">
                Every role is backed by seeded, realistic synthetic data — enter any part of the cooperative stack.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {ROLE_OPTIONS.map((r) => (
                  <button
                    key={r.role}
                    onClick={() => handleLogin(r.role)}
                    disabled={loading !== null}
                    title={`${r.label} — ${r.desc}`}
                    className="group flex min-h-[44px] items-center gap-2.5 rounded-xl border bg-background px-3 py-2 text-left transition hover:border-primary/50 hover:bg-accent hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
                  >
                    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition group-hover:scale-105', r.color)} aria-hidden>
                      {r.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-bold sm:text-sm">{r.label} demo</span>
                      <span className="block truncate text-[10px] text-muted-foreground sm:text-[11px]">{r.desc}</span>
                    </span>
                    {loading === r.role ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" aria-hidden />
                    ) : (
                      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
                    )}
                  </button>
                ))}
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => setConceptOpen(true)}>
                  <BookOpen className="mr-1.5 h-4 w-4" /> {t('lpConcept', lang)} (concept note)
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setAboutOpen(true)}>
                  How the cooperative network works →
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.section>
      </main>

      {/* ============ FOOTER ============ */}
      <footer className="mt-auto border-t bg-card/60 px-4 py-5 text-center sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3">
          <div className="hidden gap-4 text-xs text-muted-foreground sm:flex sm:flex-wrap sm:justify-center">
            <span className="inline-flex items-center gap-1"><Zap className="h-3.5 w-3.5 text-primary" /> Electricians</span>
            <span className="inline-flex items-center gap-1"><Droplets className="h-3.5 w-3.5 text-primary" /> Plumbers</span>
            <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-primary" /> Verified certifications</span>
            <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5 text-primary" /> Multilingual</span>
          </div>
          <Button variant="outline" size="sm" onClick={() => setAboutOpen(true)}>
            <BookOpen className="mr-1.5 h-4 w-4" /> How the cooperative network works
          </Button>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            GigSetu · India&apos;s Cooperative Workforce Operating System — SIH prototype. Synthetic demo data; designed for authorized integration with government cooperative databases.
          </p>
        </div>
      </footer>

      {/* ============ ABOUT / MODEL DIALOG (#54 + #79 + #76) ============ */}
      <AboutModel open={aboutOpen} onOpenChange={setAboutOpen} />

      {/* ============ CONCEPT NOTE (kept + refreshed) ============ */}
      <Dialog open={conceptOpen} onOpenChange={setConceptOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>GigSetu — cooperative digital infrastructure</DialogTitle>
            <DialogDescription>Prototype concept note</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            <p>
              India already has large pools of skilled workers organized through Labour Cooperative
              Societies and Federations — but their availability, skills, certifications and welfare
              remain fragmented. Customers do not know whom to trust; cooperatives lack digital
              customer acquisition; federations lack real-time demand intelligence.
            </p>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground">Architecture — one operating layer</p>
              <ul className="flex flex-wrap gap-1.5">
                {['Government ecosystem', 'Cooperative hierarchy', 'GigSetu operating layer', 'AI workforce intelligence', 'Customer demand', 'Institutional demand', 'Worker welfare'].map((c) => (
                  <li key={c} className="rounded-full border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-foreground">{c}</li>
                ))}
              </ul>
            </div>
            <p>
              <strong className="text-foreground">GigSetu is NOT a marketplace clone.</strong> It is a
              cooperative-owned operating system: the cooperative remains the institution of record;
              GigSetu provides matching, booking, fair pricing, service evidence, welfare wallets,
              demand forecasting and federation intelligence on top.
            </p>
            <p>
              Government and cooperative registration databases are external institutional ecosystems.
              GigSetu is <strong className="text-foreground">designed for authorized integration</strong> —
              this prototype uses clearly-labelled synthetic data and does not claim live government API access.
            </p>
            <PrototypeNotice />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
