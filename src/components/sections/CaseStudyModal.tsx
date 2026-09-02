import { ExternalLink, Github } from 'lucide-react'
import Modal from '../ui/Modal'
import { Chip, StatusChip } from '../ui/Chips'
import { ButtonLink } from '../ui/Buttons'
import type { Project } from '../../data/projects'
import { cn } from '../../lib/utils'

function CaseSection({
  n,
  title,
  children,
}: {
  n: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-9">
      <h3 className="flex items-baseline gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-indigo-300/80">
        <span className="text-indigo-400/60">{n}</span>
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3 text-sm leading-relaxed text-slate-400">
          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-indigo-400/70" aria-hidden="true" />
          {item}
        </li>
      ))}
    </ul>
  )
}

/**
 * Immersive case study — deep-linkable via #case/<id>.
 * Sections render only when their data exists; numbers stay sequential.
 */
export default function CaseStudyModal({
  project,
  onClose,
}: {
  project: Project | null
  onClose: () => void
}) {
  const sections: Array<{ title: string; body: React.ReactNode }> = []

  if (project) {
    sections.push(
      { title: 'Overview', body: <p className="text-[15px] leading-relaxed text-slate-300">{project.summary}</p> },
      { title: 'Problem', body: <p className="text-sm leading-relaxed text-slate-400">{project.problem}</p> },
    )
    if (project.whyItMatters) {
      sections.push({
        title: 'Why it matters',
        body: <p className="text-sm leading-relaxed text-slate-400">{project.whyItMatters}</p>,
      })
    }
    sections.push({
      title: 'Solution',
      body: <p className="text-sm leading-relaxed text-slate-400">{project.solution}</p>,
    })
    if (project.architecture && project.architecture.length > 0) {
      sections.push({ title: 'Architecture', body: <Bullets items={project.architecture} /> })
    }
    sections.push({
      title: 'Technologies',
      body: (
        <div className="flex flex-wrap gap-2">
          {project.technologies.map((t) => (
            <Chip key={t}>{t}</Chip>
          ))}
        </div>
      ),
    })
    if (project.contribution) {
      sections.push({
        title: 'My contribution',
        body: <p className="text-sm leading-relaxed text-slate-400">{project.contribution}</p>,
      })
    }
    if (project.challenges && project.challenges.length > 0) {
      sections.push({ title: 'Challenges', body: <Bullets items={project.challenges} /> })
    }
    if (project.lessonsLearned && project.lessonsLearned.length > 0) {
      sections.push({ title: 'What I learned', body: <Bullets items={project.lessonsLearned} /> })
    }
    if (project.futureImprovements && project.futureImprovements.length > 0) {
      sections.push({ title: 'Future improvements', body: <Bullets items={project.futureImprovements} /> })
    }
    sections.push({
      title: 'Links',
      body:
        project.githubUrl || project.demoUrl ? (
          <div className="flex flex-wrap gap-3">
            {project.githubUrl && (
              <ButtonLink href={project.githubUrl} target="_blank" rel="noreferrer" variant="ghost" className="!py-2 text-[13px]">
                <Github size={14} aria-hidden="true" /> GITHUB
              </ButtonLink>
            )}
            {project.demoUrl && (
              <ButtonLink href={project.demoUrl} target="_blank" rel="noreferrer" variant="ghost" className="!py-2 text-[13px]">
                <ExternalLink size={14} aria-hidden="true" /> LIVE DEMO
              </ButtonLink>
            )}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-white/10 px-4 py-3 font-mono text-[11px] leading-relaxed text-slate-500">
            Links not attached yet — add a repository URL in{' '}
            <span className="text-slate-300">src/data/projects.ts</span> and the button appears.
          </p>
        ),
    })
  }

  return (
    <Modal
      open={!!project}
      onClose={onClose}
      label={project ? `Case study: ${project.title}` : 'Case study'}
      wide
    >
      {project && (
        <article className="p-6 sm:p-10">
          <header>
            <p className={cn('eyebrow flex items-center gap-3')}>
              <span className="h-px w-8 bg-indigo-400/40" aria-hidden="true" />
              CASE STUDY
            </p>
            <h2 className="mt-3 pr-10 font-display text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">
              {project.title}
            </h2>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Chip>{project.category}</Chip>
              {project.year && <Chip>{project.year}</Chip>}
              {project.status && (
                <StatusChip tone={project.status.toLowerCase().includes('live') ? 'live' : 'wip'}>
                  {project.status}
                </StatusChip>
              )}
            </div>
          </header>

          {sections.map((section, i) => (
            <CaseSection key={section.title} n={String(i + 1).padStart(2, '0')} title={section.title}>
              {section.body}
            </CaseSection>
          ))}
        </article>
      )}
    </Modal>
  )
}
