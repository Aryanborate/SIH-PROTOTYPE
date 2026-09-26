'use client'

import { useState, useSyncExternalStore } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'framer-motion'
import { useAppStore } from '@/store/app-store'
import { LoginScreen } from './login-screen'
import { AppShell } from './app-shell'
import { DeploymentBanner } from '@/components/deployment-banner'

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
      {/* ThemeProvider lives in app/layout.tsx so it also wraps the Toaster.
          A second, nested provider here would hold a different resolvedTheme
          than the one the document class was set from. */}
      <MotionConfig reducedMotion="user">
        <DeploymentBanner />
        {user ? <AppShell /> : <LoginScreen />}
      </MotionConfig>
    </QueryClientProvider>
  )
}
