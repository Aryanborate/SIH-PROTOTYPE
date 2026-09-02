import { FileText, Github, Linkedin, Mail } from 'lucide-react'
import Reveal from '../ui/Reveal'
import { ButtonLink } from '../ui/Buttons'
import { useResumeAvailable } from '../../hooks/useResumeAvailable'
import { hasLink, siteConfig } from '../../data/siteConfig'

export default function Contact() {
  const resumeAvailable = useResumeAvailable(siteConfig.resumePath)
  const anyChannel =
    hasLink(siteConfig.email) ||
    hasLink(siteConfig.linkedin) ||
    hasLink(siteConfig.github) ||
    resumeAvailable === true

  return (
    <section id="contact" className="container-pad section-pad scroll-mt-24">
      <Reveal>
        <p className="eyebrow flex items-center gap-3">
          <span className="text-indigo-400/80">08</span>
          <span className="h-px w-8 bg-indigo-400/40" aria-hidden="true" />
          CONTACT
        </p>
        <h2 className="mt-6 font-display text-4xl font-semibold tracking-tight text-slate-100 sm:text-6xl">
          {'Let’s connect.'}
        </h2>
        <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-slate-400 sm:text-base">
          I'm interested in learning, building, collaborating and exploring meaningful technical
          problems. If you're hiring for internships, working on something worth building, or just
          want to talk data — my inbox is open.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          {hasLink(siteConfig.email) && (
            <ButtonLink href={`mailto:${siteConfig.email}`}>
              <Mail size={16} aria-hidden="true" />
              EMAIL
            </ButtonLink>
          )}
          {hasLink(siteConfig.linkedin) && (
            <ButtonLink href={siteConfig.linkedin} target="_blank" rel="noreferrer" variant="ghost">
              <Linkedin size={16} aria-hidden="true" />
              LINKEDIN
            </ButtonLink>
          )}
          {hasLink(siteConfig.github) && (
            <ButtonLink href={siteConfig.github} target="_blank" rel="noreferrer" variant="ghost">
              <Github size={16} aria-hidden="true" />
              GITHUB
            </ButtonLink>
          )}
          {resumeAvailable === true && (
            <ButtonLink href={siteConfig.resumePath} target="_blank" rel="noreferrer" variant="ghost">
              <FileText size={16} aria-hidden="true" />
              RESUME
            </ButtonLink>
          )}
          {!anyChannel && (
            <p className="max-w-md rounded-xl border border-dashed border-white/10 px-5 py-4 font-mono text-[11px] leading-relaxed text-slate-500">
              Contact links are configured in{' '}
              <span className="text-slate-300">src/data/siteConfig.ts</span> — add an email, LinkedIn
              or GitHub URL and the buttons appear here.
            </p>
          )}
        </div>

        <p className="mt-12 font-mono text-[11px] tracking-[0.16em] text-slate-500">
          {siteConfig.location.toUpperCase()} · OPEN TO INTERNSHIPS & COLLABORATIONS
        </p>
      </Reveal>
    </section>
  )
}
