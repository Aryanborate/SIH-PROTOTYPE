import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, ExternalLink, Github, Search } from 'lucide-react'
import SectionHeading from '../ui/SectionHeading'
import Reveal from '../ui/Reveal'
import { Button } from '../ui/Buttons'
import { Chip, StatusChip } from '../ui/Chips'
import { getProject, projects, type Project } from '../../data/projects'
import ProjectVisual from './ProjectVisual'
import CaseStudyModal from './CaseStudyModal'
import { cn } from '../../lib/utils'

function ProjectRow({
  project: p,
  index,
  onOpen,
}: {
  project: Project
  index: number
  onOpen: () => void
}) {
  const reversed = index % 2 === 1
  return (
    <article className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
      <Reveal className={cn('lg:col-span-7', reversed && 'lg:order-2')}>
        <button
          onClick={onOpen}
          className="block w-full cursor-pointer text-left"
          aria-label={`Open case study: ${p.title}`}
        >
          <ProjectVisual
            id={p.id}
            className="transition-transform duration-500 hover:scale-[1.01]"
          />
        </button>
      </Reveal>

      <div className={cn('lg:col-span-5', reversed && 'lg:order-1')}>
        <Reveal>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-[11px] tracking-[0.2em] text-indigo-300/80">
              PROJECT {String(index + 1).padStart(2, '0')}
            </span>
            {p.status && (
              <StatusChip tone={p.status.toLowerCase().includes('live') ? 'live' : 'wip'}>
                {p.status}
              </StatusChip>
            )}
          </div>
          <h3 className="mt-3 font-display text-2xl font-semibold tracking-tight text-slate-100 sm:text-[1.7rem]">
            <button onClick={onOpen} className="cursor-pointer text-left transition-colors hover:text-indigo-200">
              {p.title}
            </button>
          </h3>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-400">{p.summary}</p>

          <div className="mt-5 flex flex-wrap gap-2">
            {p.technologies.map((t) => (
              <Chip key={t}>{t}</Chip>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Button onClick={onOpen} variant="ghost" className="!px-4 !py-2 text-[13px]">
              READ CASE STUDY
              <ArrowRight size={14} aria-hidden="true" />
            </Button>
            {p.githubUrl && (
              <a
                href={p.githubUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-300 transition-colors hover:text-white"
              >
                <Github size={14} aria-hidden="true" /> GitHub
              </a>
            )}
            {p.demoUrl && (
              <a
                href={p.demoUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-300 transition-colors hover:text-white"
              >
                <ExternalLink size={14} aria-hidden="true" /> Live demo
              </a>
            )}
          </div>
        </Reveal>
      </div>
    </article>
  )
}

export default function Projects() {
  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  // Deep-linkable case studies: #case/<id>, back/forward friendly.
  useEffect(() => {
    const apply = () => {
      const match = window.location.hash.match(/^#case\/([\w-]+)$/)
      setOpenId(match && getProject(match[1]) ? match[1] : null)
    }
    apply()
    window.addEventListener('hashchange', apply)
    window.addEventListener('popstate', apply)
    return () => {
      window.removeEventListener('hashchange', apply)
      window.removeEventListener('popstate', apply)
    }
  }, [])

  const open = (id: string) => {
    if (window.location.hash !== `#case/${id}`) {
      window.history.pushState({ case: id }, '', `#case/${id}`)
    }
    setOpenId(id)
  }

  const close = () => {
    if (window.history.state && (window.history.state as { case?: string }).case) {
      window.history.back() // popstate handler clears openId
    } else {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
      setOpenId(null)
    }
  }

  const categories = useMemo(
    () => ['All', ...Array.from(new Set(projects.map((p) => p.category)))],
    [],
  )

  const q = query.trim().toLowerCase()
  const visible = useMemo(
    () =>
      projects.filter(
        (p) =>
          (filter === 'All' || p.category === filter) &&
          (q === '' || `${p.title} ${p.summary} ${p.technologies.join(' ')}`.toLowerCase().includes(q)),
      ),
    [filter, q],
  )

  return (
    <section id="projects" className="section-pad scroll-mt-24">
      <div className="container-pad">
        <SectionHeading
          index="03"
          eyebrow="PROJECTS"
          title="Things I've built."
          description="Projects, experiments and technical work — including the honest stage each one is really at."
        />

        <Reveal className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2" aria-label="Filter projects">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setFilter(c)}
                aria-pressed={filter === c}
                className={cn(
                  'rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all',
                  filter === c
                    ? 'border-indigo-300/40 bg-indigo-400/15 text-indigo-100'
                    : 'border-white/[0.08] bg-white/[0.03] text-slate-400 hover:border-white/[0.16] hover:text-slate-200',
                )}
              >
                {c}
              </button>
            ))}
          </div>
          <label className="relative w-full sm:w-64">
            <span className="sr-only">Search projects</span>
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects..."
              className="w-full rounded-full border border-white/[0.08] bg-white/[0.04] py-2.5 pl-9 pr-4 text-sm text-slate-200 outline-none backdrop-blur-md transition placeholder:text-slate-500 focus:border-indigo-300/40"
            />
          </label>
        </Reveal>

        <div className="mt-14 space-y-20">
          {visible.map((p, i) => (
            <ProjectRow key={p.id} project={p} index={i} onOpen={() => open(p.id)} />
          ))}

          {visible.length === 0 && (
            <Reveal>
              <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center">
                <p className="font-display text-lg text-slate-300">Nothing matches “{query}”.</p>
                <p className="mt-2 text-sm text-slate-500">Try a different term — or reset the filters.</p>
                <Button
                  variant="ghost"
                  className="mt-6"
                  onClick={() => {
                    setFilter('All')
                    setQuery('')
                  }}
                >
                  Reset filters
                </Button>
              </div>
            </Reveal>
          )}
        </div>
      </div>

      <CaseStudyModal project={openId ? getProject(openId) ?? null : null} onClose={close} />
    </section>
  )
}
