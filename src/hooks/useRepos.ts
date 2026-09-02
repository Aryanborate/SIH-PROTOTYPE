import { useEffect, useState } from 'react'

export interface Repo {
  name: string
  description: string | null
  language: string | null
  stargazers_count: number
  forks_count: number
  html_url: string
  pushed_at: string
  fork: boolean
}

export type RepoState =
  | { status: 'idle' } // no username configured
  | { status: 'loading' }
  | { status: 'ok'; repos: Repo[] }
  | { status: 'error' }

const CACHE_KEY = 'gh-repos-v1'
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes

interface CacheEntry {
  ts: number
  repos: Repo[]
}

function readCache(): Repo[] | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CacheEntry
    if (Date.now() - parsed.ts > CACHE_TTL) return null
    return parsed.repos
  } catch {
    return null
  }
}

/** Fetches public GitHub repositories for a username. Never fabricates data. */
export function useRepos(username: string): RepoState {
  const [state, setState] = useState<RepoState>(() =>
    username ? { status: 'loading' } : { status: 'idle' },
  )

  useEffect(() => {
    if (!username) {
      setState({ status: 'idle' })
      return
    }
    const cached = readCache()
    if (cached) {
      setState({ status: 'ok', repos: cached })
      return
    }
    const controller = new AbortController()
    setState({ status: 'loading' })
    fetch(
      `https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=pushed&per_page=6`,
      { signal: controller.signal, headers: { Accept: 'application/vnd.github+json' } },
    )
      .then((res) => {
        if (!res.ok) throw new Error(`GitHub API ${res.status}`)
        return res.json() as Promise<Repo[]>
      })
      .then((data) => {
        const repos = data
          .filter((r) => !r.fork)
          .slice(0, 6)
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), repos } satisfies CacheEntry))
        } catch {
          /* storage unavailable — fine */
        }
        setState({ status: 'ok', repos })
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        console.warn('GitHub repositories unavailable:', err)
        setState({ status: 'error' })
      })
    return () => controller.abort()
  }, [username])

  return state
}
