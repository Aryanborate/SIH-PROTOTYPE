'use client'

import { api } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import { useDemoStore } from '@/store/demo-store'
import type { DemoUser } from '@/lib/types'

/**
 * Phase 6 #50 — SIH demo launch sequence, shared by the app-shell header
 * button AND the landing screen (wired by task 15-c).
 *
 * RESET (POST /api/demo/reset removes demo-engine artifacts: isDemoScript
 * bookings + their notifications/complaints + demo exchange records)
 *   → login as the demo CUSTOMER identity (Anita Deshmukh, Kothrud)
 *   → start the scripted 16-step engine.
 */

/** Wipe every artifact previous demo runs created, then drop stale react-query caches. */
export async function resetDemoState(qc?: { clear: () => void }): Promise<void> {
  await api.post('/api/demo/reset', {}).catch(() => {
    // reset is best-effort — a failed cleanup must never block the demo
  })
  qc?.clear()
}

/** Log the demo customer identity in (without touching demo playback state). */
export async function loginDemoCustomer(): Promise<DemoUser> {
  const res = await api.get<{ ok: boolean; user: DemoUser }>('/api/session?role=CUSTOMER')
  useAppStore.getState().login(res.user)
  return res.user
}

/**
 * The one-call entry point for "▶ Start SIH Demo".
 * Safe to call repeatedly — every call resets first, so the golden path
 * always starts from a clean, judge-ready state.
 * `qc` is the TanStack QueryClient (from useQueryClient()) so dashboards refetch clean.
 */
export async function startSihDemo(qc?: { clear: () => void }): Promise<void> {
  await resetDemoState(qc)
  await loginDemoCustomer()
  useDemoStore.getState().start()
}

/** Stop playback without wiping the artifacts (judges can keep exploring). */
export function stopSihDemo(): void {
  useDemoStore.getState().stop()
}
