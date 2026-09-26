'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { DemoUser, Lang, Role } from '@/lib/types'

export type View =
  | 'login'
  | 'customer'
  | 'worker'
  | 'coop'
  | 'taluka'
  | 'district'
  | 'state'
  | 'national'
  | 'government'
  | 'hierarchy'
  | 'exchange'
  | 'ai'
  | 'whatsapp'
  | 'platform'
  | 'map'

/** Drill-down focus: when set, the target dashboard renders that entity instead of the role default. */
export interface FocusIds {
  district?: string
  taluka?: string
  coop?: string
}

interface AppState {
  user: DemoUser | null
  lang: Lang
  view: View
  focusIds: FocusIds
  /** Booking refCode extracted from a clicked notification — customer app deep-opens it in Track Booking. */
  focusBookingRef: string | null
  /** Worker deep-link: tab the worker app should force-open after a notification click. */
  focusWorkerTab: string | null
  login: (u: DemoUser) => void
  logout: () => void
  setLang: (l: Lang) => void
  setView: (v: View) => void
  /** Navigate to a view and focus a specific entity (drill-down). */
  drillTo: (view: View, ids: FocusIds) => void
  /** Remove one or all drill-down focus ids. */
  clearFocus: (keys?: Array<keyof FocusIds>) => void
  /** Jump to the customer Track Booking view and open the booking with this refCode. */
  openBookingByRef: (ref: string) => void
  /** Clear the booking deep-link once consumed by the customer app. */
  clearFocusBooking: () => void
  /** Force the worker app to open this tab (notification deep-link). */
  openWorkerTab: (tab: string) => void
  /** Clear the worker tab deep-link once consumed. */
  clearFocusWorkerTab: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      lang: 'en',
      view: 'login',
      focusIds: {},
      focusBookingRef: null,
      focusWorkerTab: null,
      login: (u) => {
        // Defensive: a null identity used to reach here and blow up on
        // `u.role`, producing a cryptic TypeError that the UI then reported as
        // "SIH demo engine not ready". Fail loudly and legibly instead.
        if (!u || typeof u !== 'object' || !u.role) {
          throw new Error('login() called without a valid identity. Sign in via POST /api/auth first.')
        }
        set({ user: u, view: defaultViewFor(u.role), focusIds: {}, focusBookingRef: null, focusWorkerTab: null })
      },
      logout: () => set({ user: null, view: 'login', focusIds: {}, focusBookingRef: null, focusWorkerTab: null }),
      setLang: (l) => set({ lang: l }),
      setView: (v) => set({ view: v }),
      drillTo: (view, ids) => set({ view, focusIds: { ...get().focusIds, ...ids } }),
      openBookingByRef: (ref) => set({ view: 'customer', focusBookingRef: ref }),
      clearFocusBooking: () => set({ focusBookingRef: null }),
      openWorkerTab: (tab) => set({ view: 'worker', focusWorkerTab: tab }),
      clearFocusWorkerTab: () => set({ focusWorkerTab: null }),
      clearFocus: (keys) => {
        if (!keys) return set({ focusIds: {} })
        const next = { ...get().focusIds }
        keys.forEach((k) => delete next[k])
        set({ focusIds: next })
      },
    }),
    { name: 'gigsetu-session' }
  )
)

export function defaultViewFor(role: Role): View {
  switch (role) {
    case 'CUSTOMER':
    case 'INSTITUTION':
      return 'customer'
    case 'WORKER':
      return 'worker'
    case 'COOP_ADMIN':
      return 'coop'
    case 'TALUKA_COORD':
      return 'taluka'
    case 'DISTRICT_COORD':
      return 'district'
    case 'STATE_ADMIN':
      return 'state'
    case 'NATIONAL_ADMIN':
      return 'national'
    case 'PLATFORM_ADMIN':
      return 'platform'
    default:
      return 'login'
  }
}

export const ROLE_VIEWS: Record<Role, View[]> = {
  CUSTOMER: ['customer', 'whatsapp'],
  INSTITUTION: ['customer', 'whatsapp'],
  WORKER: ['worker'],
  COOP_ADMIN: ['coop', 'exchange', 'ai', 'hierarchy', 'government', 'taluka', 'district', 'map'],
  TALUKA_COORD: ['taluka', 'district', 'exchange', 'ai', 'hierarchy', 'government', 'coop', 'map'],
  DISTRICT_COORD: ['district', 'taluka', 'exchange', 'ai', 'hierarchy', 'government', 'coop', 'map'],
  STATE_ADMIN: ['state', 'district', 'taluka', 'exchange', 'ai', 'hierarchy', 'government', 'map'],
  NATIONAL_ADMIN: ['national', 'state', 'district', 'taluka', 'exchange', 'ai', 'hierarchy', 'government', 'map'],
  PLATFORM_ADMIN: ['platform', 'customer', 'worker', 'coop', 'taluka', 'district', 'state', 'national', 'exchange', 'ai', 'whatsapp', 'hierarchy', 'government', 'map'],
}
