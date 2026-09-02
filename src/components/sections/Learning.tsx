import {
  BrainCircuit,
  Cloud,
  Code2,
  Database,
  Layers,
  LineChart,
  type LucideIcon,
} from 'lucide-react'
import SectionHeading from '../ui/SectionHeading'
import Reveal from '../ui/Reveal'
import { GlassCard } from '../ui/GlassCard'
import { learning, learningLastUpdated, type LearningCard } from '../../data/learning'

const ICONS: Record<LearningCard['icon'], LucideIcon> = {
  database: Database,
  brain: BrainCircuit,
  chart: LineChart,
  code: Code2,
  cloud: Cloud,
  layers: Layers,
}

export default function Learning() {
  return (
    <section id="learning" className="section-pad scroll-mt-24">
      <div className="container-pad">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeading
            index="07"
            eyebrow="CURRENTLY LEARNING"
            title="What I'm learning right now."
            description="The working list — what has my attention, what I'm experimenting with, and what I plan to build next."
          />
          <p className="mb-1 font-mono text-[10px] tracking-[0.16em] text-slate-600">
            updated as I go · {learningLastUpdated}
          </p>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {learning.map((card, i) => {
            const Icon = ICONS[card.icon]
            return (
              <Reveal key={card.title} delay={0.05 * i} className="h-full">
                <GlassCard hover className="flex h-full flex-col p-6">
                  <div className="flex items-center gap-3">
                    <span className="neu-chip p-2.5" aria-hidden="true">
                      <Icon size={17} className="text-indigo-300" />
                    </span>
                    <h3 className="font-display text-base font-semibold text-slate-100">{card.title}</h3>
                  </div>
                  <dl className="mt-5 space-y-3.5 text-[13px] leading-relaxed">
                    <div>
                      <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-indigo-300/70">
                        Focus
                      </dt>
                      <dd className="mt-1 text-slate-300">{card.focus}</dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-indigo-300/70">
                        Experiment
                      </dt>
                      <dd className="mt-1 text-slate-400">{card.experiment}</dd>
                    </div>
                    <div>
                      <dt className="font-mono text-[9px] uppercase tracking-[0.18em] text-indigo-300/70">
                        Next build
                      </dt>
                      <dd className="mt-1 text-slate-400">{card.next}</dd>
                    </div>
                  </dl>
                </GlassCard>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
