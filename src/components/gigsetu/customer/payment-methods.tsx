'use client'

// Digital Payments UI (#38) — method chooser (UPI / Razorpay / Cash on completion),
// transparent settlement split strip, and a collapsible payment-history list fed by
// GET /api/payments?customerId= (Task 14-a server contract).

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, inr, timeAgo } from '@/lib/api-client'
import { t } from '@/lib/i18n'
import { useAppStore } from '@/store/app-store'
import type { Lang, PaymentRecord, PaymentHistoryDTO } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Banknote, ChevronDown, CreditCard, Loader2, Smartphone, Wallet } from 'lucide-react'

export type PayMethod = 'upi' | 'razorpay' | 'cash'

/** Wire label sent to the booking engine for the chosen chip. */
export function payMethodLabel(m: PayMethod): string {
  if (m === 'razorpay') return 'Razorpay (Prototype)'
  if (m === 'cash') return 'Cash on completion'
  return 'UPI (Prototype)'
}

const METHODS: { value: PayMethod; labelKey: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { value: 'upi', labelKey: 'paymUpi', Icon: Smartphone },
  { value: 'razorpay', labelKey: 'paymRazorpay', Icon: CreditCard },
  { value: 'cash', labelKey: 'paymCash', Icon: Banknote },
]

/** Radio-style selectable method chips (default UPI). */
export function PaymentMethodChooser({ value, onChange, disabled }: { value: PayMethod; onChange: (m: PayMethod) => void; disabled?: boolean }) {
  const lang = useAppStore((s) => s.lang)
  return (
    <div>
      <p className="mb-1.5 text-xs font-semibold">{t('paymChoose', lang)}</p>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t('paymChoose', lang)}>
        {METHODS.map(({ value: v, labelKey, Icon }) => {
          const selected = value === v
          return (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onChange(v)}
              className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-2 text-[11px] font-semibold leading-tight transition sm:flex-row sm:gap-1.5 ${
                selected
                  ? 'border-primary bg-accent text-primary shadow-sm'
                  : 'border-border text-muted-foreground hover:border-primary/40 hover:bg-accent/40'
              } disabled:opacity-50`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="text-center">{t(labelKey, lang)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Transparent settlement split — where the customer's money actually went. */
export function PaymentSplitStrip({ payment }: { payment: PaymentRecord }) {
  const lang = useAppStore((s) => s.lang)
  const cells = [
    { label: t('worker', lang), value: payment.workerShare, cls: 'text-emerald-600 dark:text-emerald-400' },
    { label: t('cooperative', lang), value: payment.coopCommission, cls: '' },
    { label: t('welfare', lang), value: payment.welfare, cls: 'text-emerald-600 dark:text-emerald-400' },
    { label: t('paymPlatform', lang), value: payment.platformFee, cls: '' },
  ]
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold">
        <Wallet className="h-3.5 w-3.5 text-primary" /> {t('paymSplitTitle', lang)}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-primary/30 bg-accent/60 px-2.5 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{t('paymCustomerPaid', lang)}</p>
          <p className="text-sm font-bold tabular-nums text-primary">{inr(payment.amount)}</p>
        </div>
        {cells.map((c) => (
          <div key={c.label} className="rounded-lg border bg-muted/30 px-2.5 py-2">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{c.label}</p>
            <p className={`text-sm font-bold tabular-nums ${c.cls}`}>{inr(c.value)}</p>
          </div>
        ))}
      </div>
      <p className="text-[10px] leading-relaxed text-muted-foreground">{t('paymFeeNote', lang)}</p>
    </div>
  )
}

/** Collapsible "last 5 settled payments" list — GET /api/payments?customerId=. */
export function PaymentHistoryList({ customerId }: { customerId: string }) {
  const lang = useAppStore((s) => s.lang)
  const [open, setOpen] = useState(false)
  const q = useQuery({
    queryKey: ['payments', customerId],
    queryFn: () => api.get<{ ok: boolean; payments: PaymentHistoryDTO[] }>(`/api/payments?customerId=${customerId}`),
    enabled: open,
    staleTime: 30_000,
  })

  return (
    <div className="border-t pt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex min-h-[44px] w-full items-center justify-between rounded-lg px-1 text-xs font-semibold text-primary transition hover:bg-accent/40"
      >
        <span>{open ? t('paymHistoryHide', lang) : t('paymHistory', lang)}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-1 max-h-56 space-y-1.5 overflow-y-auto pr-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 dark:[&::-webkit-scrollbar-thumb]:bg-zinc-700">
          {q.isLoading && <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>}
          {q.isError && <p className="py-2 text-center text-[11px] text-muted-foreground">{(q.error as Error).message}</p>}
          {q.data && q.data.payments.length === 0 && <p className="py-2 text-center text-[11px] text-muted-foreground">{t('paymHistoryEmpty', lang)}</p>}
          {q.data?.payments.slice(0, 5).map((p) => (
            <div key={p.refCode} className="flex items-center justify-between gap-2 rounded-lg border bg-muted/20 px-2.5 py-2 text-xs">
              <div className="min-w-0">
                <p className="truncate font-semibold">{p.title}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {p.method} · <span className="font-mono">{t('paymTxn', lang)} {p.txnId || '—'}</span> · {timeAgo(p.paidAt)}
                </p>
              </div>
              <span className="shrink-0 font-bold tabular-nums">{inr(p.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
