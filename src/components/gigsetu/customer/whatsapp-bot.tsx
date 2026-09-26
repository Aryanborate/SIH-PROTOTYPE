'use client'

// Phase 4 — WhatsApp Booking Bot view (prototype UI for the WhatsApp Business API).
// A booking assistant, not an FAQ bot: progressive slot filling → verified worker card
// → CONFIRM / QUOTE → REAL booking in the cooperative engine (ref like GS-202609-3972).

import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api-client'
import { LANG_LABEL, t } from '@/lib/i18n'
import type { DemoUser, Lang, WaBotResponse, WaQuickReply, WaWorkerCard } from '@/lib/types'
import { useAppStore } from '@/store/app-store'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Bot, Check, CheckCheck, SendHorizontal, ShieldCheck, Star } from 'lucide-react'

interface Msg {
  id: string
  role: 'bot' | 'user' | 'system'
  text?: string
  at: Date
  workerCard?: WaWorkerCard | null
  quickReplies?: WaQuickReply[]
  used?: boolean
  confirmedCode?: string
  isQuote?: boolean
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const fmt = (s: string, vars: Record<string, string | number>) => {
  let out = s
  for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v))
  return out
}
const initials = (name: string) => name.split(/\s+/).slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase()
const clock = (d: Date) => d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })

export function WhatsAppBot({ user }: { user: DemoUser }) {
  const { toast } = useToast()
  // FIX: the bot kept its own `lang` seeded once via getState(), so the header
  // language selector did NOT translate the bot and the bot's own selector did
  // not change the app — two desynchronised language controls. It is now a
  // single source of truth: the store, with a local override.
  const storeLang = useAppStore((s) => s.lang)
  const setStoreLang = useAppStore((s) => s.setLang)
  // A local override lets the bot's own selector win for this thread, but the
  // STORE stays the single source of truth for the rest of the app.
  const [langOverride, setLangOverride] = useState<Lang | null>(null)
  const langRef = useRef<Lang>(storeLang)
  const lang = langOverride ?? storeLang
  const setLang = (l: Lang) => {
    setLangOverride(l)
    langRef.current = l
    setStoreLang(l)
  }
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [typing, setTyping] = useState(false)
  const waState = useRef<WaBotResponse['state']>({})
  const idSeq = useRef(0)
  const alive = useRef(true)
  const chatRoot = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  useEffect(() => {
    langRef.current = lang
  }, [lang])

  // auto-scroll to the newest message
  useEffect(() => {
    const vp = chatRoot.current?.querySelector('[data-slot="scroll-area-viewport"]') as HTMLElement | null
    if (vp) vp.scrollTop = vp.scrollHeight
  }, [msgs, typing])

  const push = useCallback((m: Omit<Msg, 'id' | 'at'> & { at?: Date }) => {
    const msg: Msg = { id: `wa-${++idSeq.current}`, at: m.at ?? new Date(), ...m }
    setMsgs((prev) => [...prev.map((x) => (x.quickReplies?.length ? { ...x, used: true } : x)), msg])
    return msg.id
  }, [])

  const callBot = useCallback(
    async (payload: { message?: string; confirm?: boolean; quote?: boolean }) => {
      if (busy) return
      setBusy(true)
      setTyping(true)
      try {
        const res = await api.post<WaBotResponse>('/api/ai/wa-bot', {
          customerId: user.customerId ?? '',
          lang: langRef.current,
          state: waState.current,
          ...payload,
        })
        if (!alive.current) return
        waState.current = res.state
        let lastBotId = ''
        for (const r of res.replies) {
          await sleep(Math.min(r.delayMs ?? 500, 1200))
          if (!alive.current) return
          lastBotId = push({ role: 'bot', text: r.text })
        }
        if (res.workerCard) {
          push({ role: 'bot', workerCard: res.workerCard, quickReplies: res.quickReplies })
        } else if (res.quickReplies?.length && lastBotId) {
          setMsgs((prev) => prev.map((m) => (m.id === lastBotId ? { ...m, quickReplies: res.quickReplies } : m)))
        }
        if (res.bookingRef) {
          const isQuote = (res.replies[0]?.text ?? '').startsWith('📝')
          push({ role: 'system', confirmedCode: res.bookingRef, isQuote, quickReplies: res.quickReplies })
        }
      } catch {
        if (alive.current) push({ role: 'system', text: t('waNetErr', langRef.current) })
      } finally {
        if (alive.current) {
          setTyping(false)
          setBusy(false)
        }
      }
    },
    [busy, push, user.customerId]
  )

  // trigger the welcome + service buttons on mount
  const started = useRef(false)
  useEffect(() => {
    if (started.current) return
    started.current = true
    push({ role: 'user', text: 'hi' })
    void callBot({ message: 'hi' })
    // Intentionally mount-only: this is the conversation handshake, not a
    // reaction to push/callBot identity. `busy` is read through a ref so the
    // closure can never go stale.
     
  }, [])

  const onQuickReply = (m: Msg, q: WaQuickReply) => {
    if (m.used || busy) return
    setMsgs((prev) => prev.map((x) => (x.id === m.id ? { ...x, used: true } : x)))
    if (q.value === 'CONFIRM') void callBot({ confirm: true })
    else if (q.value === 'QUOTE') void callBot({ quote: true })
    else if (q.value === 'NEW') void callBot({ message: 'NEW' })
    else if (q.value === 'TRACK') {
      // FIX: this chip used to raise a toast and do nothing. It now opens the
      // customer's live tracking view on the most recent booking.
      const last = [...msgs].reverse().find((x) => x.confirmedCode)
      if (last?.confirmedCode) {
        const st = useAppStore.getState()
        st.openBookingByRef(last.confirmedCode)
        st.setView('customer')
        toast({ title: t('waTrackToast', lang), description: t('waTrackToastSub', lang) })
      } else {
        toast({
          title: t('waTrackToast', lang),
          description: 'No booking yet from this conversation. Confirm a worker first, then track it here.',
        })
      }
    } else void callBot({ message: q.value })
  }

  const sendText = () => {
    const v = input.trim()
    if (!v || busy) return
    setInput('')
    push({ role: 'user', text: v })
    void callBot({ message: v })
  }

  const trackInApp = (ref: string) => {
    const st = useAppStore.getState()
    st.openBookingByRef(ref)
    st.setView('customer')
  }

  const renderCard = (w: WaWorkerCard) => (
    <div className="min-w-0 rounded-xl border border-emerald-200/70 bg-emerald-50/60 p-3 dark:border-emerald-900 dark:bg-emerald-950/40">
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
          {initials(w.workerName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="truncate text-sm font-semibold">{w.workerName}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-1.5 py-px text-[9px] font-bold tracking-wide text-white">
              <ShieldCheck className="h-2.5 w-2.5" aria-hidden /> {t('waVerified', lang)}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden /> {w.rating.toFixed(2)} · {w.coopName}
          </div>
        </div>
      </div>
      <div className="mt-2 text-xs font-medium">{fmt(t('waEta', lang), { km: w.distanceKm, eta: w.etaMin })}</div>
      <div className="text-xs font-semibold">{fmt(t('waFair', lang), { floor: w.priceFloor, ceiling: w.priceCeiling })}</div>
      <p className="mt-1.5 text-[10px] italic text-zinc-400 dark:text-zinc-500">{t('waFairNote', lang)}</p>
    </div>
  )

  return (
    <div className="mx-auto flex h-[min(80vh,720px)] w-full max-w-xl flex-col overflow-hidden rounded-3xl border bg-zinc-100 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
      {/* header — muted emerald, dark-mode aware */}
      <header className="flex items-center gap-3 bg-emerald-700 px-3 py-2.5 text-white dark:bg-emerald-950 sm:px-4">
        <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-base font-bold">G</span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold">{t('waTitle', lang)}</h2>
          <p className="truncate text-[11px] text-emerald-50/80 dark:text-emerald-200/70">{t('waSub', lang)}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
            <SelectTrigger aria-label={t('waLang', lang)} className="h-7 w-[104px] border-white/30 bg-white/10 text-[11px] text-white [&>svg]:text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(LANG_LABEL) as Lang[]).map((l) => (
                <SelectItem key={l} value={l}>{LANG_LABEL[l]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="hidden items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[9px] text-emerald-50 sm:inline-flex">
            <Bot className="h-3 w-3" aria-hidden /> {t('waProto', lang)}
          </span>
        </div>
      </header>

      {/* chat wallpaper + message log */}
      <div ref={chatRoot} className="relative min-h-0 max-h-[60vh] flex-1">
        <ScrollArea className="absolute inset-0">
          <div
            role="log"
            aria-live="polite"
            aria-label={t('waLogAria', lang)}
            className="min-h-full space-y-2.5 bg-[#efeae2] px-3 py-4 text-black/10 [background-image:radial-gradient(circle_at_1px_1px,currentColor_1px,transparent_0)] [background-size:14px_14px] dark:bg-zinc-900 dark:text-white/10"
          >
            {msgs.map((m) => {
              const isLast = m.id === msgs[msgs.length - 1]?.id
              if (m.role === 'system') {
                return (
                  <div key={m.id} className="flex flex-col items-center gap-1.5">
                    {m.text ? (
                      <p className="rounded-lg bg-zinc-200/90 px-3 py-1.5 text-center text-[11px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">{m.text}</p>
                    ) : m.confirmedCode ? (
                      <div className="flex flex-col items-center gap-1.5 rounded-lg bg-white/90 px-3 py-2 shadow-sm dark:bg-zinc-800">
                        <p className="text-center text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                          {fmt(t(m.isQuote ? 'waQuoteRef' : 'waConfirmed', lang), { ref: m.confirmedCode })}
                        </p>
                        <Button
                          size="sm"
                          className="h-7 rounded-full bg-emerald-600 px-3 text-[11px] hover:bg-emerald-700"
                          onClick={() => trackInApp(m.confirmedCode!)}
                        >
                          {t('waTrackBtn', lang)}
                        </Button>
                      </div>
                    ) : null}
                    {isLast && m.quickReplies?.length ? <QuickReplyRow m={m} onPick={onQuickReply} /> : null}
                  </div>
                )
              }
              const mine = m.role === 'user'
              return (
                <div key={m.id}>
                  <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-sm sm:max-w-[75%] ${
                        mine
                          ? 'rounded-tr-sm bg-emerald-100 dark:bg-emerald-900/60'
                          : 'rounded-tl-sm bg-white dark:bg-zinc-800'
                      }`}
                    >
                      {m.workerCard ? renderCard(m.workerCard) : m.text ? <p className="whitespace-pre-line text-sm text-zinc-800 dark:text-zinc-100">{m.text}</p> : null}
                      <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-zinc-400">
                        <span>{clock(m.at)}</span>
                        {mine ? <Check className="h-3 w-3" aria-hidden /> : <CheckCheck className="h-3.5 w-3.5" aria-hidden />}
                      </div>
                    </div>
                  </div>
                  {isLast && m.quickReplies?.length ? (
                    <div className={`mt-1.5 flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <QuickReplyRow m={m} onPick={onQuickReply} />
                    </div>
                  ) : null}
                </div>
              )
            })}
            {typing && (
              <div className="flex justify-start">
                <div aria-label={t('waTyping', lang)} className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-white px-3 py-2.5 shadow-sm dark:bg-zinc-800">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-400" style={{ animationDelay: `${d}ms` }} aria-hidden />
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* input bar */}
      <form
        className="flex items-center gap-2 border-t bg-zinc-100 p-2.5 dark:border-zinc-800 dark:bg-zinc-950"
        onSubmit={(e) => {
          e.preventDefault()
          sendText()
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('waInputPh', lang)}
          aria-label={t('waInputPh', lang)}
          disabled={busy}
          className="h-11 flex-1 rounded-full bg-white dark:bg-zinc-900"
        />
        <Button
          type="submit"
          size="icon"
          aria-label={t('waSend', lang)}
          disabled={busy || !input.trim()}
          className="h-11 w-11 shrink-0 rounded-full bg-emerald-600 hover:bg-emerald-700"
        >
          <SendHorizontal className="h-5 w-5" aria-hidden />
        </Button>
      </form>
    </div>
  )
}

/** quick-reply chips under the latest message that carries them; disabled after use */
function QuickReplyRow({ m, onPick }: { m: Msg; onPick: (m: Msg, q: WaQuickReply) => void }) {
  return (
    <div className="flex max-w-[92%] flex-wrap gap-1.5">
      {m.quickReplies!.map((q) => (
        <Button
          key={q.value + q.label}
          variant="outline"
          size="sm"
          disabled={m.used}
          onClick={() => onPick(m, q)}
          className={`h-8 min-h-8 rounded-full text-[11px] ${
            q.kind === 'primary'
              ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white'
              : 'border-zinc-300 bg-white/90 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
          }`}
        >
          {q.label}
        </Button>
      ))}
    </div>
  )
}
