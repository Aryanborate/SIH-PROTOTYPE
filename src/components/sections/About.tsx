import { GraduationCap } from 'lucide-react'
import SectionHeading from '../ui/SectionHeading'
import Reveal from '../ui/Reveal'
import { GlassCard } from '../ui/GlassCard'
import { StatusChip } from '../ui/Chips'
import { profile } from '../../data/profile'
import { education } from '../../data/education'

export default function About() {
  return (
    <section id="about" className="container-pad section-pad scroll-mt-24">
      <div className="grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <SectionHeading index="01" eyebrow="ABOUT" title={profile.aboutTitle} />
          <Reveal delay={0.1}>
            <p className="mt-8 max-w-md font-display text-xl leading-snug text-slate-200 sm:text-2xl">
              “{profile.aboutLead}”
            </p>
          </Reveal>
          <Reveal delay={0.18} className="mt-10">
            <GlassCard className="p-5">
              <div className="flex items-start gap-4">
                <span className="neu-chip p-2.5" aria-hidden="true">
                  <GraduationCap size={18} className="text-indigo-300" />
                </span>
                <div>
                  {education.map((e) => (
                    <div key={e.degree}>
                      <p className="text-sm font-semibold text-slate-100">{e.degree}</p>
                      <p className="mt-1 text-[13px] text-slate-400">{e.institution}</p>
                      <p className="text-[13px] text-slate-500">{e.university}</p>
                    </div>
                  ))}
                  <StatusChip tone="active" className="mt-3">
                    Ongoing
                  </StatusChip>
                </div>
              </div>
            </GlassCard>
          </Reveal>
        </div>

        <div className="lg:col-span-7">
          {profile.aboutStory.map((para, i) => (
            <Reveal key={i} delay={0.06 * i}>
              <p className="mb-5 text-[15px] leading-relaxed text-slate-400 sm:text-base">{para}</p>
            </Reveal>
          ))}

          <Reveal delay={0.15}>
            <div className="mt-8 flex flex-wrap items-center gap-2">
              <span className="mr-1 self-center font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
                I learn by
              </span>
              {profile.method.map((m) => (
                <span key={m} className="neu-chip">
                  {m}
                </span>
              ))}
            </div>
          </Reveal>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {profile.principles.map((p, i) => (
              <Reveal key={p.title} delay={0.08 * i} className="h-full">
                <div className="h-full rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
                  <p className="font-mono text-[10px] text-indigo-300/70">0{i + 1}</p>
                  <p className="mt-2 text-sm font-semibold text-slate-100">{p.title}</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-slate-500">{p.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
