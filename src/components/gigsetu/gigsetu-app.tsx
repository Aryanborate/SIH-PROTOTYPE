'use client'

import { useState, useSyncExternalStore } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'
import { MotionConfig } from 'framer-motion'
import { useAppStore } from '@/store/app-store'
import { LoginScreen } from './login-screen'
import { AppShell } from './app-shell'

function useHydrated() {
  return useSyncExternalStore(
    (cb) => useAppStore.persist.onFinishHydration(cb),
    () => useAppStore.persist.hasHydrated(),
    () => false
  )
}

export function GigSetuApp() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 5000, retry: 1, refetchOnWindowFocus: false } },
      })
  )
  const user = useAppStore((s) => s.user)
  const hydrated = useHydrated()

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">Loading GigSetu…</div>
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
        <MotionConfig reducedMotion="user">
          {user ? <AppShell /> : <LoginScreen />}
        </MotionConfig>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
