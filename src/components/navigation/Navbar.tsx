import { useEffect, useState } from 'react'
import { siteConfig } from '../../data/siteConfig'
import { cn } from '../../lib/utils'

/**
 * Branding-only header. All navigation (desktop + mobile) lives in the
 * macOS-style dock fixed at the bottom — this is intentionally not a menu.
 */
export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
      <div
        className={cn(
          'glass flex flex-col items-center rounded-2xl px-6 text-center transition-all duration-300',
          scrolled ? 'py-2.5 shadow-card' : 'py-3.5',
        )}
      >
        <a href="#top" className="group flex flex-col items-center" aria-label="Back to top">
          <span className="font-display text-sm font-semibold tracking-[0.18em] text-slate-100 transition-colors group-hover:text-white">
            {siteConfig.name.toUpperCase()}
          </span>
          <span className="mt-0.5 font-mono text-[9px] tracking-[0.2em] text-slate-500">
            {siteConfig.tagline}
          </span>
        </a>
      </div>
    </header>
  )
}
