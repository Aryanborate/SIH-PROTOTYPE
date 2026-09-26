'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'

type Health = {
  ok: boolean
  status?: string
  database?: { configured: boolean; scheme: string; error?: string; hint?: string }
  env?: Record<string, boolean>
  hint?: string
}

/**
 * Deployment self-check banner.
 *
 * A serverless deploy with missing env vars makes every API route fail. The
 * failure surfaces as a toast on whichever button was clicked first, which
 * looks like a broken app rather than a missing environment variable. This
 * checks /api/health once on mount and, when the deployment is misconfigured,
 * states plainly what is wrong and how to fix it.
 *
 * Deliberately non-blocking: a demo can still be walked through in presentation
 * mode, and the seed data is synthetic anyway.
 */
export function DeploymentBanner() {
  const [health, setHealth] = useState<Health | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/health')
      .then(async (r) => {
        const body = (await r.json()) as Health
        if (!cancelled) setHealth(body)
      })
      .catch(() => {
        // /api/health unreachable is not worth a banner of its own.
        if (!cancelled) setHealth(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (dismissed || !health || health.ok || health.database?.configured) return null

  const missing = Object.entries(health.env ?? {})
    .filter(([, present]) => !present)
    .map(([name]) => name)

  return (
    <div className="sticky top-0 z-50 w-full border-b border-destructive/40 bg-destructive/10 px-4 py-2.5 text-destructive-foreground dark:bg-destructive/20">
      <div className="mx-auto flex w-full max-w-6xl items-start gap-2.5">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1 text-xs">
          <p className="font-semibold">This deployment is not connected to a database</p>
          <p className="mt-0.5 opacity-90">
            {health.database?.error ?? 'DATABASE_URL is not configured.'}
          </p>
          {health.database?.hint && <p className="mt-0.5 font-medium">{health.database.hint}</p>}
          {missing.length > 0 && (
            <p className="mt-0.5 opacity-80">
              Missing environment variable{missing.length > 1 ? 's' : ''}:{' '}
              <code className="font-mono">{missing.join(', ')}</code>
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="shrink-0 rounded p-0.5 opacity-60 transition hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
