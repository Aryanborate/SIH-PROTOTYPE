'use client'

// Two-sided trust — multi-factor rating (#35, customer side).
// Inline panel extracted/upgraded from the old single-star rating card: overall
// stars + 4 factor mini-selectors (Quality / Timeliness / Behaviour / Communication),
// optional review, transparent-by-design copy. Submits { rating, review, factors }.

import { useState } from 'react'
import { t } from '@/lib/i18n'
import type { Lang } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, MessageSquareText, ShieldCheck, Star } from 'lucide-react'

export interface RatingFactors {
  quality: number
  timeliness: number
  behaviour: number
  communication: number
}
export interface RatingPayload {
  rating: number
  review: string
  factors: RatingFactors
}

const FACTORS: { key: keyof RatingFactors; labelKey: string }[] = [
  { key: 'quality', labelKey: 'rtQuality' },
  { key: 'timeliness', labelKey: 'rtTimeliness' },
  { key: 'behaviour', labelKey: 'rtBehaviour' },
  { key: 'communication', labelKey: 'rtCommunication' },
]

/** 1–5 mini star row used for the factor selectors. */
function FactorStars({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-0.5" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          aria-label={`${label}: ${s}`}
          onClick={() => onChange(s)}
          className="rounded p-0.5 transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring motion-reduce:hover:scale-100"
        >
          <Star className={`h-4.5 w-4.5 ${s <= value ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/40'}`} />
        </button>
      ))}
    </div>
  )
}

export function RatingPanel({
  lang,
  disabled,
  pending,
  onSubmit,
}: {
  lang: Lang
  disabled?: boolean
  pending?: boolean
  onSubmit: (payload: RatingPayload) => void
}) {
  const [rating, setRating] = useState(5)
  const [factors, setFactors] = useState<RatingFactors>({ quality: 5, timeliness: 5, behaviour: 5, communication: 5 })
  const [review, setReview] = useState('')

  return (
    <div className="space-y-3">
      <p className="flex items-start gap-1.5 rounded-lg border border-dashed bg-muted/40 px-2.5 py-2 text-[11px] leading-relaxed text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
        {t('rtTransparent', lang)}
      </p>

      {/* Overall */}
      <div>
        <p className="mb-1 text-xs font-semibold">{t('rtOverall', lang)}</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <button key={s} aria-label={`${s} ${t('bdStars', lang)}`} onClick={() => setRating(s)} className="rounded transition hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring motion-reduce:hover:scale-100">
              <Star className={`h-7 w-7 ${s <= rating ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/40'}`} />
            </button>
          ))}
        </div>
      </div>

      {/* Factor rows */}
      <div>
        <p className="mb-1.5 text-xs font-semibold">{t('rtFactors', lang)}</p>
        <div className="space-y-1.5 rounded-lg border p-2.5">
          {FACTORS.map((f) => (
            <div key={f.key} className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium">{t(f.labelKey, lang)}</span>
              <FactorStars value={factors[f.key]} label={t(f.labelKey, lang)} onChange={(v) => setFactors((prev) => ({ ...prev, [f.key]: v }))} />
            </div>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">{t('rtFactorNote', lang)}</p>
      </div>

      <Textarea value={review} onChange={(e) => setReview(e.target.value)} placeholder={t('bdFeedbackPh', lang)} rows={2} aria-label={t('bdFeedbackPh', lang)} />
      <Button
        className="h-11 w-full"
        disabled={disabled || pending}
        onClick={() => onSubmit({ rating, review, factors })}
      >
        {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquareText className="mr-2 h-4 w-4" />}
        {t('bdSubmitRating', lang)}
      </Button>
    </div>
  )
}
