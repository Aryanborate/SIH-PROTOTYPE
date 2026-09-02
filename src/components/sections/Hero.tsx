import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { ArrowDown, ArrowRight, ArrowUpRight, Github } from 'lucide-react'
import HeroScene from '../3d/HeroScene'
import { profile } from '../../data/profile'
import { hasLink, siteConfig } from '../../data/siteConfig'
import { ButtonLink } from '../ui/Buttons'

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
}

const item: Variants = {
  hidden: { opacity: 0, y: 26 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.75, ease: [0.21, 0.47, 0.32, 0.98] },
  },
}

export default function Hero({
  booted,
  onSceneReady,
}: {
  booted: boolean
  onSceneReady?: () => void
}) {
  const reduced = useReducedMotion()

  return (
    <section id="top" className="relative flex min-h-[100svh] items-center overflow-hidden pb-16 pt-32 sm:pt-36">
      <div className="container-pad grid items-center gap-12 lg:grid-cols-12">
        <motion.div
          className="lg:col-span-7"
          variants={container}
          initial="hidden"
          animate={booted ? 'show' : 'hidden'}
        >
          <motion.p variants={item} className="eyebrow flex items-center gap-3">
            <span className="inline-block h-1.5 w-1.5 animate-pulse-soft rounded-full bg-indigo-400" aria-hidden="true" />
            {profile.eyebrow}
          </motion.p>

          <motion.h1
            variants={item}
            className="mt-6 max-w-2xl font-display text-4xl font-semibold leading-[1.08] tracking-tight text-slate-100 sm:text-5xl lg:text-[3.4rem]"
          >
            {profile.headline.before}{' '}
            <span className="bg-gradient-to-r from-indigo-300 via-sky-300 to-indigo-300 bg-clip-text text-transparent">
              {profile.headline.highlight}
            </span>
          </motion.h1>

          <motion.p variants={item} className="mt-6 max-w-xl text-[15px] leading-relaxed text-slate-400 sm:text-base">
            {profile.intro}
          </motion.p>

          <motion.div variants={item} className="mt-8 flex flex-wrap items-center gap-3">
            <ButtonLink href="#projects">
              EXPLORE MY WORK
              <ArrowRight size={16} aria-hidden="true" />
            </ButtonLink>
            <ButtonLink href="#github" variant="ghost">
              <Github size={16} aria-hidden="true" />
              VIEW GITHUB
            </ButtonLink>
            {hasLink(siteConfig.linkedin) && (
              <ButtonLink href={siteConfig.linkedin} target="_blank" rel="noreferrer" variant="text">
                LINKEDIN
                <ArrowUpRight size={14} aria-hidden="true" />
              </ButtonLink>
            )}
          </motion.div>

          <motion.p
            variants={item}
            className="mt-10 flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[11px] tracking-[0.14em] text-slate-500"
          >
            <span className="text-indigo-300/80">CURRENTLY LEARNING</span>
            <ArrowRight size={12} className="text-slate-600" aria-hidden="true" />
            <span className="text-slate-400">{profile.currentlyLearning.join(' • ')}</span>
          </motion.p>
        </motion.div>

        <motion.div
          className="lg:col-span-5"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={booted ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.9, delay: 0.25, ease: [0.21, 0.47, 0.32, 0.98] }}
        >
          <HeroScene onReady={onSceneReady} />
        </motion.div>
      </div>

      <motion.div
        className="absolute bottom-7 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 lg:flex"
        initial={{ opacity: 0 }}
        animate={booted ? { opacity: 1 } : {}}
        transition={{ delay: 1.4, duration: 0.8 }}
        aria-hidden="true"
      >
        <span className="font-mono text-[9px] tracking-[0.3em] text-slate-600">SCROLL</span>
        {!reduced && (
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}>
            <ArrowDown size={13} className="text-slate-500" />
          </motion.div>
        )}
      </motion.div>
    </section>
  )
}
