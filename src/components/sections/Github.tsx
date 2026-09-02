import { ArrowUpRight, GitFork, Star } from 'lucide-react'
import SectionHeading from '../ui/SectionHeading'
import Reveal from '../ui/Reveal'
import { GlassCard } from '../ui/GlassCard'
import { ButtonLink } from '../ui/Buttons'
import { useRepos, type Repo } from '../../hooks/useRepos'
import { githubUsername, hasLink, siteConfig } from '../../data/siteConfig'
import { staticRepos } from '../../data/github'
import { timeAgo } from '../../lib/utils'

function RepoCard({ repo }: { repo: Repo }) {
  return (
    <GlassCard hover className="flex h-full flex-col p-5">
      <div className="flex items-center justify-between gap-3">
        <a
          href={repo.html_url}
          target="_blank"
          rel="noreferrer"
          className="truncate font-display text-[15px] font-semibold text-slate-100 transition-colors hover:text-indigo-200"
        >
          {repo.name}
        </a>
        {repo.language && (
          <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] text-slate-500">
            <span className="h-2 w-2 rounded-full bg-indigo-400/70" aria-hidden="true" />
            {repo.language}
          </span>
        )}
      </div>
      <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-slate-400">
        {repo.description ?? 'No description yet.'}
      </p>
      <div className="mt-auto flex items-center gap-4 pt-4 font-mono text-[11px] text-slate-500">
        <span className="flex items-center gap-1" aria-label={`${repo.stargazers_count} stars`}>
          <Star size={12} aria-hidden="true" />
          {repo.stargazers_count}
        </span>
        <span className="flex items-center gap-1" aria-label={`${repo.forks_count} forks`}>
          <GitFork size={12} aria-hidden="true" />
          {repo.forks_count}
        </span>
        <span className="ml-auto">updated {timeAgo(repo.pushed_at)}</span>
      </div>
    </GlassCard>
  )
}

/**
 * Repositories come live from the GitHub API (with a session cache).
 * Without a configured username the section shows a designed, honest
 * setup state — numbers are never faked.
 */
export default function GithubSection() {
  const username = githubUsername()
  const state = useRepos(username)
  const profileLinked = hasLink(siteConfig.github)

  return (
    <section id="github" className="section-pad scroll-mt-24">
      <div className="container-pad">
        <SectionHeading
          index="06"
          eyebrow="GITHUB"
          title="Open source, experiments & code."
          description="See what I'm building when nobody is watching."
        />

        <div className="mt-12">
          {state.status === 'loading' && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-36 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]" />
              ))}
            </div>
          )}

          {state.status === 'ok' && (
            <>
              <Reveal>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {state.repos.map((repo) => (
                    <RepoCard key={repo.name} repo={repo} />
                  ))}
                </div>
              </Reveal>
              {profileLinked && (
                <Reveal className="mt-8 text-center">
                  <ButtonLink href={siteConfig.github} target="_blank" rel="noreferrer" variant="ghost">
                    VIEW FULL PROFILE
                    <ArrowUpRight size={14} aria-hidden="true" />
                  </ButtonLink>
                </Reveal>
              )}
            </>
          )}

          {state.status === 'error' &&
            (staticRepos.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {staticRepos.map((repo) => (
                  <GlassCard key={repo.name} hover className="flex h-full flex-col p-5">
                    <a
                      href={repo.url}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate font-display text-[15px] font-semibold text-slate-100 transition-colors hover:text-indigo-200"
                    >
                      {repo.name}
                    </a>
                    <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-slate-400">
                      {repo.description}
                    </p>
                    <div className="mt-auto flex items-center justify-between pt-4 font-mono text-[11px] text-slate-500">
                      {repo.language && <span>{repo.language}</span>}
                      <span className="ml-auto">updated {timeAgo(repo.updated)}</span>
                    </div>
                  </GlassCard>
                ))}
              </div>
            ) : (
              <Reveal>
                <GlassCard className="p-8">
                  <p className="font-display text-lg font-semibold text-slate-100">
                    Couldn't reach GitHub just now.
                  </p>
                  <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-400">
                    The repositories are still public — the API is most likely rate-limiting this
                    visit. Everything lives on the profile itself.
                  </p>
                  {profileLinked && (
                    <ButtonLink href={siteConfig.github} target="_blank" rel="noreferrer" variant="ghost" className="mt-6">
                      OPEN GITHUB
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </ButtonLink>
                  )}
                </GlassCard>
              </Reveal>
            ))}

          {state.status === 'idle' && (
            <Reveal>
              <GlassCard className="flex flex-col items-start gap-5 p-8 sm:flex-row sm:items-center">
                <span
                  className="neu-chip grid h-12 w-12 shrink-0 place-items-center rounded-2xl font-display text-lg font-semibold text-indigo-300"
                  aria-hidden="true"
                >
                  {'</>'}
                </span>
                <div className="flex-1">
                  <p className="font-display text-lg font-semibold text-slate-100">
                    Repositories connect here.
                  </p>
                  <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-400">
                    This section is wired for the GitHub REST API and fills itself in once a profile
                    is linked — set the username in{' '}
                    <span className="font-mono text-[12px] text-indigo-200/90">src/data/siteConfig.ts</span>{' '}
                    and redeploy. Repository numbers are pulled live, never written by hand.
                  </p>
                </div>
              </GlassCard>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  )
}
