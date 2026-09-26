'use client'

// Printable cooperative payment receipt — shared by BookingDetail and the Payments tab.
// In-app styled preview (Dialog) + print window with a download fallback when popups are blocked.

import type { BookingDTO } from '@/lib/types'
import {
  Dialog, DialogContent, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { Download, Printer, ShieldCheck } from 'lucide-react'

const pct = (v: number, total: number) => (total > 0 ? Math.round((v / total) * 100) : 0)

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function inrText(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  return `₹${Number(v).toLocaleString('en-IN')}`
}

function paidStamp(b: BookingDTO): string {
  if (!b.payment) return ''
  const t = b.payment.method.toUpperCase().includes('UPI') ? 'PAID · UPI' : `PAID · ${b.payment.method.toUpperCase()}`
  return `<div class="stamp">${t}</div>`
}

/** Standalone, print-friendly HTML document for the receipt (also used for the download fallback). */
export function receiptHtml(b: BookingDTO): string {
  const p = b.payment
  const paidOn = p?.paidAt ? new Date(p.paidAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'
  const bookedOn = new Date(b.scheduledAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>Receipt ${esc(b.refCode)} — GigSetu</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, 'Times New Roman', serif; background: #fafaf9; color: #18181b; padding: 24px; }
  .sheet { max-width: 420px; margin: 0 auto; background: #fff; border: 1px solid #e4e4e7; border-radius: 12px; overflow: hidden; position: relative; }
  .head { background: #f59e0b; color: #fff; padding: 20px 22px; }
  .brand { font-size: 20px; font-weight: 700; letter-spacing: -0.3px; }
  .brand small { display: block; font-size: 10px; letter-spacing: 2.2px; opacity: 0.9; margin-top: 2px; }
  .meta { padding: 18px 22px 6px; font-size: 12px; color: #52525b; line-height: 1.7; }
  .meta b { color: #18181b; }
  .row { display: flex; justify-content: space-between; gap: 12px; padding: 7px 22px; font-size: 12.5px; }
  .row .lab { color: #52525b; }
  .row .val { font-variant-numeric: tabular-nums; text-align: right; }
  .divider { border-top: 1.5px dashed #d4d4d8; margin: 10px 22px; }
  .total { font-size: 16px; font-weight: 700; padding: 4px 22px 2px; display: flex; justify-content: space-between; }
  .total .val { color: #b45309; font-variant-numeric: tabular-nums; }
  .note { padding: 14px 22px 20px; font-size: 10.5px; color: #71717a; line-height: 1.6; text-align: center; }
  .stamp { position: absolute; top: 68px; right: 18px; transform: rotate(8deg); border: 2.5px solid #10b981; color: #10b981; font-family: Arial, sans-serif; font-size: 11px; font-weight: 800; letter-spacing: 1.5px; padding: 4px 9px; border-radius: 6px; opacity: 0.9; background: rgba(255,255,255,0.75); }
  .barcode { height: 38px; margin: 6px 22px 12px; background: repeating-linear-gradient(90deg, #18181b 0 2px, transparent 2px 5px, #18181b 5px 6px, transparent 6px 10px); border-radius: 2px; opacity: 0.85; }
  @media print { body { background: #fff; padding: 0; } .sheet { border: none; border-radius: 0; } }
</style></head>
<body><div class="sheet">
  ${paidStamp(b)}
  <div class="head">
    <div class="brand">GigSetu <small>COOPERATIVE WORKFORCE OS</small></div>
  </div>
  <div class="meta">
    Payment receipt · <b>${esc(b.refCode)}</b><br/>
    ${esc(b.cooperativeName ?? 'Primary Labour Cooperative Society')}<br/>
    Paid on ${esc(paidOn)}
  </div>
  <div class="divider"></div>
  <div class="row"><span class="lab">Service</span><span class="val">${esc(b.title)}</span></div>
  <div class="row"><span class="lab">Worker</span><span class="val">${esc(b.workerName ?? '—')}${b.workerSkill ? ` · ${esc(b.workerSkill)}` : ''}</span></div>
  <div class="row"><span class="lab">Customer</span><span class="val">${esc(b.customerName ?? '—')}</span></div>
  <div class="row"><span class="lab">Area</span><span class="val">${esc(b.area)}</span></div>
  <div class="row"><span class="lab">Scheduled</span><span class="val">${esc(bookedOn)}</span></div>
  <div class="row"><span class="lab">Method</span><span class="val">${esc(p?.method ?? '—')}</span></div>
  ${p?.txnId ? `<div class="row"><span class="lab">Transaction</span><span class="val" style="font-family:monospace">${esc(p.txnId)}</span></div>` : ''}
  <div class="divider"></div>
  <div class="total"><span>Total paid</span><span class="val">${inrText(p?.amount)}</span></div>
  ${p ? `
  <div class="row"><span class="lab">Worker share · ${pct(p.workerShare, p.amount)}%</span><span class="val">${inrText(p.workerShare)}</span></div>
  <div class="row"><span class="lab">Cooperative commission · ${pct(p.coopCommission, p.amount)}%</span><span class="val">${inrText(p.coopCommission)}</span></div>
  <div class="row"><span class="lab">Welfare fund · ${pct(p.welfare, p.amount)}%</span><span class="val">${inrText(p.welfare)}</span></div>
  <div class="row"><span class="lab">Platform fee · ${pct(p.platformFee, p.amount)}%</span><span class="val">${inrText(p.platformFee)}</span></div>` : ''}
  <div class="barcode" aria-hidden="true"></div>
  <div class="note">
    ≈86% of every rupee reaches the worker — printed on every receipt by cooperative rule.<br/>
    SIH prototype · synthetic data · designed for authorized payment-gateway integration.<br/>
    This document is a demo artefact, not a tax invoice.
  </div>
</div></body></html>`
}

/** Open the system print dialog in a popup; fall back to a downloaded HTML receipt when popups are blocked. */
export function printReceipt(b: BookingDTO): 'printed' | 'downloaded' {
  const html = receiptHtml(b)
  const w = window.open('', '_blank', 'width=460,height=720')
  if (w) {
    w.document.open()
    w.document.write(html)
    w.document.close()
    // Give the popup a tick to lay out, then raise print
    w.setTimeout(() => { try { w.print() } catch { /* headless / blocked */ } }, 250)
    return 'printed'
  }
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `receipt-${b.refCode}.html`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
  return 'downloaded'
}

/** In-app receipt preview styled like a printed cooperative bill. */
export function ReceiptDialog({ booking, open, onOpenChange }: { booking: BookingDTO | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast()
  const b = booking
  const p = b?.payment ?? null
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-sm overflow-y-auto p-0" aria-label="Payment receipt">
        {b && p && (
          <div className="relative bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
            <DialogTitle className="sr-only">Payment receipt for {b.refCode}</DialogTitle>
            {/* header band */}
            <div className="rounded-t-lg bg-gradient-to-r from-amber-500 to-amber-600 px-5 pb-4 pt-5 text-white">
              <p className="font-serif text-xl font-bold tracking-tight">GigSetu</p>
              <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-amber-100">Cooperative Workforce OS</p>
            </div>
            {/* PAID stamp */}
            <div className="absolute right-4 top-16 rotate-6 rounded-md border-2 border-emerald-500/90 bg-white/80 px-2 py-1 text-[10px] font-extrabold uppercase tracking-widest text-emerald-600 dark:bg-zinc-950/70 dark:text-emerald-400">
              Paid · {p.method.replace(/ \(prototype\)/i, '')}
            </div>

            <div className="space-y-1 px-5 pt-4 text-xs text-muted-foreground">
              <p>Payment receipt · <span className="font-mono font-semibold text-foreground">{b.refCode}</span></p>
              <p>{b.cooperativeName ?? 'Primary Labour Cooperative Society'}</p>
              <p>Paid on {new Date(p.paidAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
            </div>

            <Separator className="my-3 border-dashed" />

            <div className="space-y-1.5 px-5 text-[13px]">
              {[
                ['Service', b.title],
                ['Worker', [b.workerName, b.workerSkill].filter(Boolean).join(' · ') || '—'],
                ['Customer', b.customerName ?? '—'],
                ['Area', b.area],
                ['Scheduled', new Date(b.scheduledAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })],
                ['Method', p.method],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3">
                  <span className="shrink-0 text-muted-foreground">{k}</span>
                  <span className="truncate text-right font-medium">{v}</span>
                </div>
              ))}
              {p.txnId && (
                <div className="flex items-baseline justify-between gap-3">
                  <span className="shrink-0 text-muted-foreground">Transaction</span>
                  <span className="truncate text-right font-mono text-[11px]">{p.txnId}</span>
                </div>
              )}
            </div>

            <div className="mx-5 my-3 border-t-2 border-dashed border-zinc-300 dark:border-zinc-700" />

            <div className="flex items-baseline justify-between px-5">
              <span className="text-sm font-bold">Total paid</span>
              <span className="text-xl font-extrabold tabular-nums text-amber-700 dark:text-amber-400">{inrText(p.amount)}</span>
            </div>

            <div className="mt-1 space-y-1 px-5 text-[12px]">
              {([
                ['Worker share', p.workerShare],
                ['Cooperative commission', p.coopCommission],
                ['Welfare fund', p.welfare],
                ['Platform fee', p.platformFee],
              ] as const).map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3">
                  <span className="text-muted-foreground">{k} · {pct(v, p.amount)}%</span>
                  <span className="font-medium tabular-nums">{inrText(v)}</span>
                </div>
              ))}
            </div>

            {/* decorative demo barcode */}
            <div className="mx-5 mt-4 h-9 rounded-sm opacity-80 [background:repeating-linear-gradient(90deg,currentColor_0_2px,transparent_2px_5px,currentColor_5px_6px,transparent_6px_10px)]" aria-hidden="true" />

            <div className="space-y-2 px-5 pb-2 pt-3 text-center text-[10px] leading-relaxed text-muted-foreground">
              <p className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400"><ShieldCheck className="h-3 w-3" /> ≈86% of every rupee reaches the worker — printed on every receipt by cooperative rule.</p>
              <p>SIH prototype · synthetic data · designed for authorized payment-gateway integration. Not a tax invoice.</p>
            </div>

            <div className="flex gap-2 border-t bg-muted/40 p-3 dark:bg-zinc-900/60">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  const how = printReceipt(b)
                  toast({
                    title: how === 'printed' ? 'Receipt sent to print' : 'Receipt downloaded',
                    description: how === 'printed' ? `receipt-${b.refCode} — use your browser's print dialog to save as PDF.` : `Saved receipt-${b.refCode}.html (popup was blocked).`,
                  })
                }}
              >
                <Printer className="mr-1.5 h-3.5 w-3.5" /> Print
              </Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={() => {
                  const blob = new Blob([receiptHtml(b)], { type: 'text/html;charset=utf-8' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `receipt-${b.refCode}.html`
                  document.body.appendChild(a)
                  a.click()
                  a.remove()
                  URL.revokeObjectURL(url)
                  toast({ title: 'Receipt downloaded', description: `receipt-${b.refCode}.html saved to your device.` })
                }}
              >
                <Download className="mr-1.5 h-3.5 w-3.5" /> Download
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
