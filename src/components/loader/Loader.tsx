import { motion } from 'framer-motion'

/** Boot screen — a small animated node system, not a generic spinner. */
export default function Loader() {
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-ink-900"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02, filter: 'blur(8px)' }}
      transition={{ duration: 0.7, ease: 'easeInOut' }}
      aria-hidden="true"
    >
      <div className="relative h-20 w-20">
        <svg viewBox="0 0 80 80" className="h-full w-full">
          <g stroke="rgba(129,140,248,0.45)" strokeWidth="1" fill="none">
            <path d="M40 12 L66 50 L14 50 Z" strokeDasharray="4 4" className="animate-dash" />
            <path d="M40 12 L40 38 M66 50 L40 38 M14 50 L40 38" opacity="0.6" />
          </g>
          <circle cx="40" cy="12" r="3" fill="#818CF8" className="animate-pulse-soft" />
          <circle cx="66" cy="50" r="2.4" fill="#60A5FA" />
          <circle cx="14" cy="50" r="2.4" fill="#60A5FA" />
          <circle cx="40" cy="38" r="5.5" fill="none" stroke="#4F46E5" strokeWidth="1.4" className="animate-pulse-soft" />
        </svg>
      </div>
      <p className="mt-8 font-display text-xs font-medium tracking-[0.34em] text-slate-300">
        ADITYA MENGAR
      </p>
      <p className="mt-3 font-mono text-[10px] tracking-[0.22em] text-indigo-300/80">
        INITIALIZING EXPERIENCE<span className="animate-blink">_</span>
      </p>
      <div className="mt-6 h-px w-44 overflow-hidden bg-white/10">
        <div className="h-full w-1/3 animate-shimmer bg-gradient-to-r from-transparent via-indigo-400 to-transparent" />
      </div>
    </motion.div>
  )
}
