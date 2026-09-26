'use client'

// Two-sided trust (#35) — worker-side report dialog.
// Files a report straight into the transparent trust register and notifies the cooperative office.

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { t } from '@/lib/i18n'
import { useAppStore } from '@/store/app-store'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { AlertTriangle, CalendarX, Flag, IndianRupee, Loader2, MessageSquareOff } from 'lucide-react'

type TrustCategory = 'UNSAFE_ENV' | 'ABUSIVE_BEHAVIOUR' | 'REPEAT_CANCELLATION' | 'PAYMENT_ISSUE'

const CATEGORIES: Array<{ key: TrustCategory; icon: React.ReactNode; labelKey: string; subKey: string }> = [
  { key: 'UNSAFE_ENV', icon: <AlertTriangle className="h-4 w-4" />, labelKey: 'trCatUnsafe', subKey: 'trCatUnsafeSub' },
  { key: 'ABUSIVE_BEHAVIOUR', icon: <MessageSquareOff className="h-4 w-4" />, labelKey: 'trCatAbusive', subKey: 'trCatAbusiveSub' },
  { key: 'REPEAT_CANCELLATION', icon: <CalendarX className="h-4 w-4" />, labelKey: 'trCatRepeatCancel', subKey: 'trCatRepeatCancelSub' },
  { key: 'PAYMENT_ISSUE', icon: <IndianRupee className="h-4 w-4" />, labelKey: 'trCatPayment', subKey: 'trCatPaymentSub' },
]

/** Amber outline "Report an issue" button + shadcn Dialog. Also usable on completed job cards. */
export function TrustReportButton({
  workerId,
  bookingId,
  className,
}: {
  workerId: string
  bookingId?: string
  className?: string
}) {
  const lang = useAppStore((s) => s.lang)
  const { toast } = useToast()
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<TrustCategory | null>(null)
  const [detail, setDetail] = useState('')

  const valid = !!category && detail.trim().length >= 10

  const mut = useMutation({
    mutationFn: () =>
      api.post<{ ok: boolean; report: { id: string; category: string; status: string } }>('/api/trust', {
        workerId,
        bookingId: bookingId ?? undefined,
        category,
        detail: detail.trim(),
      }),
    onSuccess: () => {
      toast({ title: t('trSuccessToast', lang) })
      // Refresh the transparency card so the "reports you filed" count updates immediately
      void qc.invalidateQueries({ queryKey: ['trust-worker'] })
      setCategory(null)
      setDetail('')
      setOpen(false)
    },
    onError: () => {
      toast({ title: t('trErrorToast', lang), variant: 'destructive' })
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) {
          setCategory(null)
          setDetail('')
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'min-h-11 border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950/50',
            className,
          )}
        >
          <Flag className="mr-1.5 h-3.5 w-3.5" /> {t('trReportBtn', lang)}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('trDialogTitle', lang)}</DialogTitle>
          <DialogDescription>{t('trDialogDesc', lang)}</DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={category ?? undefined}
          onValueChange={(v) => setCategory(v as TrustCategory)}
          className="grid gap-2"
          aria-label={t('trDialogTitle', lang)}
        >
          {CATEGORIES.map((c) => {
            const selected = category === c.key
            return (
              <Label
                key={c.key}
                htmlFor={`trust-cat-${c.key}`}
                className={cn(
                  'flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-3 font-normal transition',
                  selected
                    ? 'border-amber-400 bg-amber-50/70 dark:border-amber-700 dark:bg-amber-950/40'
                    : 'border-border hover:border-amber-300/70 hover:bg-accent/40 dark:hover:border-amber-800',
                )}
              >
                <RadioGroupItem id={`trust-cat-${c.key}`} value={c.key} className="mt-1 text-amber-600 dark:text-amber-400" />
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                  {c.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-tight">{t(c.labelKey, lang)}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">{t(c.subKey, lang)}</span>
                </span>
              </Label>
            )
          })}
        </RadioGroup>

        <div className="space-y-1.5">
          <label htmlFor="trust-report-detail" className="text-sm font-medium">
            {t('trDetailLabel', lang)} <span className="text-destructive">*</span>
          </label>
          <Textarea
            id="trust-report-detail"
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            placeholder={t('trDetailPh', lang)}
            rows={3}
            className="min-h-11 resize-none"
          />
          {detail.length > 0 && detail.trim().length < 10 && (
            <p className="text-[11px] text-muted-foreground">{detail.trim().length}/10</p>
          )}
        </div>

        <Button
          className="min-h-11 w-full bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600 dark:text-white dark:hover:bg-amber-500"
          disabled={!valid || mut.isPending}
          onClick={() => mut.mutate()}
        >
          {mut.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          {mut.isPending ? t('trSubmitting', lang) : t('trSubmit', lang)}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
