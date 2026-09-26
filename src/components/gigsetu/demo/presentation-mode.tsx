'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Logo } from '../shared/ui-kit'
import { useDemoStore, DEMO_STEP_COUNT } from '@/store/demo-store'
import { X } from 'lucide-react'

/**
 * Phase 6 #78 — Presentation Mode chrome.
 * When the demo is active AND presentation is on, app-shell hides the standard
 * header/footer and renders this slim strip instead — the ViewRouter content
 * itself is never hidden.
 */
export function PresentationStrip() {
  const stepIndex = useDemoStore((s) => s.stepIndex)
  const phase = useDemoStore((s) => s.phase)
  const setPresentation = useDemoStore((s) => s.setPresentation)
  return (
    <div className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-12 max-w-7xl items-center gap-2 px-3 sm:gap-3 sm:px-6">
        <Logo compact />
        <Badge className="hidden gap-1.5 border-red-200 bg-red-600 px-2 text-[10px] font-bold tracking-wide text-white hover:bg-red-600 sm:inline-flex dark:border-red-800">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-hidden />
          SIH DEMO
        </Badge>
        <p className="min-w-0 flex-1 truncate text-xs font-semibold sm:text-sm">
          Emergency Plumbing Request — <span className="text-muted-foreground">मराठी WhatsApp → full cooperative loop</span>
        </p>
        {phase === 'done' ? (
          <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-[10px] font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            Complete
          </Badge>
        ) : (
          <span className="shrink-0 text-[11px] font-medium tabular-nums text-muted-foreground">
            Step {stepIndex + 1} / {DEMO_STEP_COUNT}
          </span>
        )}
        <Button variant="outline" size="sm" className="h-7 gap-1 px-2 text-[11px]" onClick={() => setPresentation(false)}>
          <X className="h-3 w-3" /> Exit
        </Button>
      </div>
    </div>
  )
}
