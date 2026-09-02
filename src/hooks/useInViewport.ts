import { useEffect, useRef, useState } from 'react'

/**
 * Tracks whether an element is in the viewport — used to pause the
 * WebGL render loop for off-screen canvases instead of burning GPU.
 */
export function useInViewport<T extends HTMLElement>(threshold = 0.05) {
  const ref = useRef<T | null>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  return { ref, inView }
}
