/**
 * Static fallback repositories — used only if the GitHub API is unreachable
 * or no username is configured. Keep entries truthful; never invent stars/forks.
 * An empty list means the UI shows its designed "connect GitHub" state.
 */

export interface StaticRepo {
  name: string
  description: string
  language?: string
  url: string
  updated: string
}

export const staticRepos: StaticRepo[] = []
