import SectionHeading from '../ui/SectionHeading'
import Reveal from '../ui/Reveal'
import { journey } from '../../data/journey'

export default function Journey() {
  return (
    <section id="journey" className="container-pad section-pad scroll-mt-24">
      <SectionHeading
        index="04"
        eyebrow="JOURNEY"
        title="My journey so far."
        description="No fabricated dates — just the order things actually happened in, and where each thread stands today."
      />

      <div className="relative mt-14 max-w-2xl">
        <span
          className="absolute bottom-3 left-[7px] top-3 w-px bg-gradient-to-b from-indigo-400/50 via-white/10 to-transparent"
          aria-hidden="true"
        />
        <ol className="space-y-10">
          {journey.map((item, i) => (
            <li key={item.title} className="relative pl-10">
              <span
                className="absolute left-0 top-1.5 flex h-[15px] w-[15px] items-center justify-center rounded-full border border-indigo-300/40 bg-ink-800"
                aria-hidden="true"
              >
                <span className="h-[5px] w-[5px] rounded-full bg-indigo-400" />
              </span>
              <Reveal delay={0.03 * i}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-indigo-300/80">
                    {item.tag}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
                    · {item.status}
                  </span>
                  {item.period && (
                    <span className="font-mono text-[10px] text-slate-500">{item.period}</span>
                  )}
                </div>
                <h3 className="mt-2 font-display text-lg font-semibold text-slate-100">{item.title}</h3>
                <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-400">{item.detail}</p>
              </Reveal>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
