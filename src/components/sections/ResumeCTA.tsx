import { ArrowUpRight, Download, FileText } from 'lucide-react'
import Reveal from '../ui/Reveal'
import { ButtonLink } from '../ui/Buttons'
import { useResumeAvailable } from '../../hooks/useResumeAvailable'
import { hasLink, siteConfig } from '../../data/siteConfig'

export default function ResumeCTA() {
  const available = useResumeAvailable(siteConfig.resumePath)

  return (
    <section id="resume" className="container-pad scroll-mt-24">
      <Reveal>
        <div className="glass relative overflow-hidden rounded-3xl px-6 py-14 text-center sm:px-12 sm:py-16">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background: 'radial-gradient(480px 220px at 50% 0%, rgba(79,70,229,0.14), transparent 70%)',
            }}
            aria-hidden="true"
          />
          <p className="eyebrow flex items-center justify-center gap-3">
            <span className="h-px w-8 bg-indigo-400/40" aria-hidden="true" />
            RESUME
            <span className="h-px w-8 bg-indigo-400/40" aria-hidden="true" />
          </p>
          <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl">
            Want the complete picture?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-slate-400">
            One page — education, skills and projects, without the 3D.
          </p>

          <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
            {available === true && (
              <>
                <ButtonLink href={siteConfig.resumePath} target="_blank" rel="noreferrer">
                  <FileText size={16} aria-hidden="true" />
                  VIEW RESUME
                </ButtonLink>
                <ButtonLink href={siteConfig.resumePath} download variant="ghost">
                  <Download size={16} aria-hidden="true" />
                  DOWNLOAD RESUME
                </ButtonLink>
              </>
            )}
            {available === false && (
              <p className="mx-auto max-w-md rounded-xl border border-dashed border-white/10 px-5 py-4 font-mono text-[11px] leading-relaxed text-slate-500">
                resume.pdf not added yet — drop the file into{' '}
                <span className="text-slate-300">/public</span> and these buttons activate
                automatically.
              </p>
            )}
            {hasLink(siteConfig.linkedin) && (
              <ButtonLink href={siteConfig.linkedin} target="_blank" rel="noreferrer" variant="text">
                LINKEDIN INSTEAD
                <ArrowUpRight size={14} aria-hidden="true" />
              </ButtonLink>
            )}
          </div>
        </div>
      </Reveal>
    </section>
  )
}
