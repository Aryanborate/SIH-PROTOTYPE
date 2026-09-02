import { useRef, useState } from 'react'
import { BadgeCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import SectionHeading from '../ui/SectionHeading'
import Reveal from '../ui/Reveal'
import { GlassCard } from '../ui/GlassCard'
import Modal from '../ui/Modal'
import { StatusChip } from '../ui/Chips'
import { certifications, type CertType, type Certification } from '../../data/certifications'
import { achievements } from '../../data/achievements'

const typeTone: Record<CertType, 'live' | 'active' | 'wip' | 'neutral'> = {
  Participation: 'wip',
  Completion: 'live',
  Learning: 'active',
  Certification: 'live',
}

function monogram(title: string): string {
  return title
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .map((w) => w[0].toUpperCase())
    .slice(0, 3)
    .join('')
}

export default function Certifications() {
  const scroller = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<Certification | null>(null)

  const scroll = (dir: 1 | -1) =>
    scroller.current?.scrollBy({ left: dir * 320, behavior: 'smooth' })

  return (
    <section id="certifications" className="section-pad scroll-mt-24">
      <div className="container-pad">
        <div className="flex items-end justify-between gap-6">
          <SectionHeading
            index="05"
            eyebrow="CERTIFICATIONS"
            title="Learning, on the record."
            description="Programs and study tracks from my learning journey — labelled honestly as participation, completion or active learning. Credential links appear as the real documents are added."
          />
          <div className="hidden shrink-0 gap-2 md:flex">
            <button onClick={() => scroll(-1)} aria-label="Scroll certificates left" className="neu-chip p-2.5">
              <ChevronLeft size={16} aria-hidden="true" />
            </button>
            <button onClick={() => scroll(1)} aria-label="Scroll certificates right" className="neu-chip p-2.5">
              <ChevronRight size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      <div className="container-pad mt-12">
        <div
          ref={scroller}
          className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:-mx-8 sm:px-8 [&::-webkit-scrollbar]:hidden"
        >
          {certifications.map((cert, i) => (
            <Reveal key={cert.title} delay={0.03 * i} className="shrink-0 snap-start">
              <GlassCard
                hover
                role="button"
                tabIndex={0}
                aria-label={`Open certificate details: ${cert.title}`}
                onClick={() => setSelected(cert)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelected(cert)
                  }
                }}
                className="flex w-[270px] cursor-pointer flex-col p-5 sm:w-[300px]"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="neu-chip p-2" aria-hidden="true">
                    <BadgeCheck size={15} className="text-indigo-300" />
                  </span>
                  <StatusChip tone={typeTone[cert.type]}>{cert.type}</StatusChip>
                </div>
                <h3 className="mt-4 font-display text-[15px] font-semibold leading-snug text-slate-100">
                  {cert.title}
                </h3>
                <p className="mt-1 text-[13px] text-slate-500">{cert.issuer ?? cert.area}</p>
                {cert.note && <p className="mt-3 text-xs leading-relaxed text-slate-400">{cert.note}</p>}
                <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-600">
                    {cert.date ?? cert.issuer ?? 'learning track'}
                  </span>
                  <span className="font-mono text-[10px] text-indigo-300/60">details →</span>
                </div>
              </GlassCard>
            </Reveal>
          ))}
        </div>
      </div>

      {/* Beyond the code — honest participation highlights */}
      <div className="container-pad mt-20">
        <Reveal>
          <div className="hairline" />
        </Reveal>
        <Reveal className="mt-10">
          <p className="eyebrow flex items-center gap-3">
            <span className="h-px w-8 bg-indigo-400/40" aria-hidden="true" />
            BEYOND THE CODE
          </p>
        </Reveal>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {achievements.map((a, i) => (
            <Reveal key={a.title} delay={0.05 * i} className="h-full">
              <div className="h-full rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                <StatusChip tone="neutral">{a.type}</StatusChip>
                <p className="mt-3 text-sm font-semibold text-slate-100">{a.title}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">{a.detail}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      {/* Certificate viewer */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        label={selected ? `Certificate: ${selected.title}` : 'Certificate'}
      >
        {selected && (
          <div className="p-6 sm:p-8">
            <div className="relative flex h-48 items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-br from-ink-800 to-ink-900">
              {selected.image ? (
                <img
                  src={selected.image}
                  alt={`Certificate — ${selected.title}`}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="px-6 text-center">
                  <p className="font-display text-4xl font-semibold text-indigo-300/80">
                    {monogram(selected.title)}
                  </p>
                  <p className="mt-2 font-mono text-[10px] tracking-[0.18em] text-slate-600">
                    CERTIFICATE PREVIEW
                  </p>
                  <p className="mx-auto mt-3 max-w-xs text-xs leading-relaxed text-slate-500">
                    Scan not uploaded yet — add an image path in{' '}
                    <span className="font-mono text-slate-400">src/data/certifications.ts</span> and it
                    renders here.
                  </p>
                </div>
              )}
            </div>

            <h3 className="mt-6 font-display text-xl font-semibold text-slate-100">{selected.title}</h3>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">Issuer</dt>
                <dd className="mt-1 text-slate-300">{selected.issuer ?? '—'}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">Area</dt>
                <dd className="mt-1 text-slate-300">{selected.area}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">Type</dt>
                <dd className="mt-1 text-slate-300">{selected.type}</dd>
              </div>
              <div>
                <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">Date</dt>
                <dd className="mt-1 text-slate-300">{selected.date ?? '—'}</dd>
              </div>
            </dl>
            {selected.note && <p className="mt-4 text-[13px] leading-relaxed text-slate-400">{selected.note}</p>}
            {selected.credentialUrl && (
              <a
                href={selected.credentialUrl}
                target="_blank"
                rel="noreferrer"
                className="btn-primary mt-6"
              >
                VIEW CREDENTIAL ↗
              </a>
            )}
          </div>
        )}
      </Modal>
    </section>
  )
}
