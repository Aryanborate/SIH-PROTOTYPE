'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from 'react'

/**
 * Minimal light/dark theme provider — a drop-in replacement for the two
 * `next-themes` call sites this app had.
 *
 * WHY NOT next-themes (v0.4.6)
 * -----------------------------
 * next-themes renders its anti-FOUC bootstrap as a real <script> element from
 * inside a client component:
 *
 *   createElement("script", { suppressHydrationWarning: true, ...,
 *                             dangerouslySetInnerHTML: { __html: "(fn)([...])" } })
 *
 * React 19 refuses to execute scripts produced while rendering a component:
 *
 *   "Encountered a script tag while rendering React component. Scripts inside
 *    React components are never executed when rendering on the client."
 *
 * That is not only a console error. The bootstrap never runs, so a returning
 * visitor with a stored dark theme renders light first and then flips after
 * hydration — a flash of the wrong theme plus a hydration mismatch.
 *
 * The bootstrap therefore lives where scripts DO run: a server-rendered <script>
 * in app/layout.tsx, which sets the `dark`/`light` class on <html> before paint.
 * This provider only mirrors the resolved theme onto that class and persists
 * changes, which needs no script tag at all.
 *
 * The theme is modelled as an external store (localStorage + the document
 * class) and read with useSyncExternalStore, so there is no setState inside an
 * effect and no cascading render.
 *
 * API is compatible with the previous call sites:
 *   const { resolvedTheme, setTheme, theme, toggleTheme } = useTheme()
 */

export const THEME_STORAGE_KEY = 'gigsetu-theme'
export type Theme = 'light' | 'dark'

type ThemeContextValue = {
  theme: Theme
  resolvedTheme: Theme
  setTheme: (t: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/**
 * Safe fallback for components rendered outside the provider. The Toaster used
 * to live in the root layout above the app tree; this mirrors next-themes,
 * whose useTheme() also returns defaults when no provider is present.
 */
const FALLBACK: ThemeContextValue = {
  theme: 'light',
  resolvedTheme: 'light',
  setTheme: () => {},
  toggleTheme: () => {},
}

// ---------- the external store ----------

/** null until the first client effect adopts whatever is in localStorage. */
let current: Theme | null = null
const listeners = new Set<() => void>()

const emit = () => {
  for (const l of listeners) l()
}

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function applyToDocument(theme: Theme) {
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(theme)
  root.style.colorScheme = theme
}

function readStored(fallback: Theme): Theme {
  try {
    const s = window.localStorage.getItem(THEME_STORAGE_KEY)
    return s === 'dark' || s === 'light' ? s : fallback
  } catch {
    return fallback // private mode / storage disabled
  }
}

function writeStored(theme: Theme) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // storage unavailable — the theme still applies for this session
  }
}

// ---------- provider ----------

export function ThemeProvider({ children, defaultTheme = 'light' }: { children: ReactNode; defaultTheme?: Theme }) {
  // Server snapshot === first client snapshot === defaultTheme, so hydration
  // matches. The stored preference is adopted in the effect below, one tick
  // later; the class on <html> was already correct thanks to the layout
  // bootstrap, so nothing flashes.
  const getSnapshot = useCallback(() => current ?? defaultTheme, [defaultTheme])
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => defaultTheme)

  // Adopt the stored preference once. Mutating the store (rather than calling
  // setState) keeps this out of the cascading-render lint.
  useEffect(() => {
    const stored = readStored(defaultTheme)
    if (current === null) {
      current = stored
      applyToDocument(stored)
      emit()
      return
    }
    // A later mount (e.g. a second provider) just re-syncs the class.
    applyToDocument(current)
  }, [defaultTheme])

  const setTheme = useCallback((next: Theme) => {
    current = next
    applyToDocument(next)
    writeStored(next)
    emit()
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(current === 'dark' ? 'light' : 'dark')
  }, [setTheme])

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme: theme, setTheme, toggleTheme }),
    [theme, setTheme, toggleTheme]
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext) ?? FALLBACK
}
