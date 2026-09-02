import { lazy, Suspense } from 'react'
import { MonitorOff } from 'lucide-react'
import SectionHeading from '../ui/SectionHeading'
import Reveal from '../ui/Reveal'
import { GlassCard } from '../ui/GlassCard'
import { skillCategories } from '../../data/skills'
import { useCapabilities } from '../../hooks/useCapabilities'
import { useMediaQuery } from '../../hooks/useMediaQuery'

const SkillNetwork = lazy(() => import('../3d/SkillNetwork'))

export default function Skills() {
  const caps = useCapabilities()
  const isDesktop = useMediaQuery('(min-width: 768px)')
  const show3D = isDesktop && caps.webgl

  return (
    <section id="skills" className="section-pad scroll-mt-24">
      <div className="container-pad">
        <SectionHeading
          index="02"
          eyebrow="SKILLS"
          title="What I work with."
          description="A snapshot of my current toolkit — kept honest. The left column is the checklist; the right is how those skills connect in practice."
        />

        <div className="mt-12 grid gap-10 lg:grid-cols-2">
          <div className="space-y-5">
            {skillCategories.map((cat, ci) => (
              <Reveal key={cat.title} delay={0.06 * ci}>
                <GlassCard hover className="p-6">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-display text-lg font-semibold text-slate-100">{cat.title}</h3>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-indigo-300/70">
                      {cat.note}
                    </span>
                  </div>
                  <ul className="mt-4 space-y-2.5">
                    {cat.skills.map((s) => (
                      <li
                        key={s.name}
                        className="flex items-center justify-between gap-3 border-t border-white/[0.05] pt-2.5 first:border-0 first:pt-0"
                      >
                        <span className="text-sm text-slate-200">{s.name}</span>
                        {s.note && (
                          <span className="shrink-0 font-mono text-[10px] text-slate-500">{s.note}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </GlassCard>
              </Reveal>
            ))}
          </div>

          <div className={show3D ? '' : 'hidden lg:block'}>
            {show3D ? (
              <Reveal delay={0.1}>
                <Suspense fallback={<div className="h-[440px] rounded-2xl border border-white/[0.06] bg-white/[0.02] lg:h-[500px]" />}>
                  <SkillNetwork reducedMotion={caps.reducedMotion} />
                </Suspense>
                <p className="mt-3 text-center font-mono text-[10px] tracking-[0.14em] text-slate-600">
                  fig. 02 — skill constellation · hover a node
                </p>
              </Reveal>
            ) : (
              <Reveal delay={0.1} className="flex h-full items-center">
                <GlassCard className="flex w-full flex-col items-start gap-3 p-6">
                  <MonitorOff size={18} className="text-indigo-300" aria-hidden="true" />
                  <p className="text-sm font-semibold text-slate-200">Interactive skill map unavailable</p>
                  <p className="text-[13px] leading-relaxed text-slate-500">
                    The live 3D constellation needs WebGL, which this browser doesn't expose right
                    now. The structured lists on the left carry exactly the same information.
                  </p>
                </GlassCard>
              </Reveal>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
