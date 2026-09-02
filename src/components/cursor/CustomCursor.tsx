import { useEffect, useRef } from 'react'

/**
 * Subtle two-part cursor (dot + trailing ring) for fine-pointer devices.
 * Expands over interactive targets; disabled on touch + reduced motion.
 */
export default function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fine = window.matchMedia('(pointer: fine)').matches
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!fine || reduced) return

    document.documentElement.classList.add('has-cursor')
    const dot = dotRef.current
    const ring = ringRef.current
    let x = -100
    let y = -100
    let rx = -100
    let ry = -100
    let hovering = false
    let raf = 0

    const onMove = (e: MouseEvent) => {
      x = e.clientX
      y = e.clientY
      dot?.style.setProperty('opacity', '1')
      ring?.style.setProperty('opacity', '1')
    }
    const onOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      hovering = !!target?.closest('a, button, [role="button"], [data-cursor="hover"]')
    }
    const onLeave = () => {
      dot?.style.setProperty('opacity', '0')
      ring?.style.setProperty('opacity', '0')
    }
    const loop = () => {
      rx += (x - rx) * 0.16
      ry += (y - ry) * 0.16
      if (dot) dot.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`
      if (ring) {
        ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%) scale(${hovering ? 1.7 : 1})`
        ring.style.borderColor = hovering ? 'rgba(129, 140, 248, 0.7)' : 'rgba(148, 163, 184, 0.35)'
        ring.style.backgroundColor = hovering ? 'rgba(99, 102, 241, 0.08)' : 'transparent'
      }
      raf = requestAnimationFrame(loop)
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('mouseover', onOver, { passive: true })
    document.documentElement.addEventListener('mouseleave', onLeave)
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseover', onOver)
      document.documentElement.removeEventListener('mouseleave', onLeave)
      document.documentElement.classList.remove('has-cursor')
    }
  }, [])

  return (
    <>
      <div
        ref={dotRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[95] h-1.5 w-1.5 rounded-full bg-indigo-300 opacity-0 transition-opacity duration-300"
      />
      <div
        ref={ringRef}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[95] h-8 w-8 rounded-full border border-slate-400/35 opacity-0 transition-opacity duration-300"
      />
    </>
  )
}
