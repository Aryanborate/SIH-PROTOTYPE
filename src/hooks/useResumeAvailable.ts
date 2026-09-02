import { useEffect, useState } from 'react'

/**
 * Checks (HEAD request) whether the resume PDF actually exists at the given
 * path, so the UI never renders broken download buttons.
 * null = still checking.
 */
export function useResumeAvailable(path: string): boolean | null {
  const [available, setAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    let alive = true
    fetch(path, { method: 'HEAD' })
      .then((res) => {
        if (alive) setAvailable(res.ok)
      })
      .catch(() => {
        if (alive) setAvailable(false)
      })
    return () => {
      alive = false
    }
  }, [path])

  return available
}
