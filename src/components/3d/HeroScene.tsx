import { lazy, Suspense, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useCapabilities } from '../../hooks/useCapabilities'
import SceneFallback from './SceneFallback'
import type { FocusInfo } from './DataConstellation'

const DataConstellation = lazy(() => import('./DataConstellation'))

/**
 * Wrapper for the hero 3D scene: capability detection, lazy WebGL bundle,
 * static fallback, and the DOM focus readout driven by node clicks.
 */
export default function HeroScene({ onReady }: { onReady?: () => void }) {
  const caps = useCapabilities()
  const [focus, setFocus] = useState<FocusInfo | null>(null)

  return (
    <div className="relative h-[380px] w-full sm:h-[440px] lg:h-[560px]">
      {caps.webgl ? (
        <Suspense fallback={<SceneFallback compact />}>
          <DataConstellation
            quality={caps.quality}
            reducedMotion={caps.reducedMotion}
            dpr={caps.dpr}
            onFocus={setFocus}
            onReady={onReady}
          />
        </Suspense>
      ) : (
        <SceneFallback onReady={onReady} />
      )}

      <AnimatePresence mode="wait">
        <motion.p
          key={focus?.label ?? 'hint'}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.3 }}
          className="pointer-events-none absolute bottom-3 left-1 max-w-[70%] font-mono text-[10px] tracking-[0.16em] text-slate-500"
        >
          {focus ? (
            <>
              <span className="text-indigo-300">{focus.label}</span>
              <span className="text-slate-500"> — {focus.desc}</span>
            </>
          ) : (
            <span className="animate-pulse-soft">
              {caps.isTouch ? 'tap a node to inspect' : 'hover · click a node to inspect'}
            </span>
          )}
        </motion.p>
      </AnimatePresence>
      <p className="pointer-events-none absolute right-1 top-2 hidden font-mono text-[9px] tracking-[0.14em] text-slate-600 sm:block">
        fig. 01 — data intelligence constellation · live webgl
      </p>
    </div>
  )
}
