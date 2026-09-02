import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, X } from 'lucide-react'
import { siteConfig } from '../../data/siteConfig'
import { cn } from '../../lib/utils'
import { ButtonLink } from '../ui/Buttons'

const LINKS = [
  { label: 'About', id: 'about' },
  { label: 'Skills', id: 'skills' },
  { label: 'Projects', id: 'projects' },
  { label: 'Journey', id: 'journey' },
  { label: 'Contact', id: 'contact' },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState('')

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id)
        })
      },
      { rootMargin: '-40% 0px -55% 0px' },
    )
    LINKS.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4">
        <nav
          aria-label="Primary"
          className={cn(
            'glass flex w-full max-w-6xl items-center justify-between rounded-2xl px-4 transition-all duration-300 sm:px-5',
            scrolled ? 'py-2.5 shadow-card' : 'py-4',
          )}
        >
          <a href="#top" className="group flex flex-col" aria-label="Back to top">
            <span className="font-display text-sm font-semibold tracking-[0.18em] text-slate-100 transition-colors group-hover:text-white">
              {siteConfig.name.toUpperCase()}
            </span>
            <span className="mt-0.5 font-mono text-[9px] tracking-[0.2em] text-slate-500">
              {siteConfig.tagline}
            </span>
          </a>

          <div className="hidden items-center gap-0.5 md:flex">
            {LINKS.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                className={cn(
                  'relative rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors',
                  active === link.id ? 'text-white' : 'text-slate-400 hover:text-slate-100',
                )}
              >
                {active === link.id && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-full border border-indigo-300/25 bg-indigo-400/10"
                    transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative">{link.label}</span>
              </a>
            ))}
            <ButtonLink href="#resume" variant="primary" className="ml-3 !px-4 !py-2 text-[13px]">
              Resume
            </ButtonLink>
          </div>

          <button
            className="rounded-full border border-white/10 bg-white/[0.04] p-2.5 text-slate-200 transition hover:bg-white/[0.08] md:hidden"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label="Open menu"
          >
            <Menu size={18} aria-hidden="true" />
          </button>
        </nav>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            className="fixed inset-0 z-[60] flex flex-col bg-ink-900/95 backdrop-blur-xl md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <div className="flex items-center justify-between px-5 pt-6">
              <span className="font-display text-sm font-semibold tracking-[0.18em] text-slate-100">
                {siteConfig.name.toUpperCase()}
              </span>
              <button
                className="rounded-full border border-white/10 bg-white/[0.04] p-2.5 text-slate-200 transition hover:bg-white/[0.08]"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="Mobile" className="flex flex-1 flex-col justify-center gap-2 px-8">
              {LINKS.map((link, i) => (
                <motion.a
                  key={link.id}
                  href={`#${link.id}`}
                  onClick={() => setOpen(false)}
                  className="border-b border-white/[0.06] py-4 font-display text-3xl font-semibold tracking-tight text-slate-200 transition-colors hover:text-white"
                  initial={{ opacity: 0, x: -18 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.06 * i + 0.1, duration: 0.4, ease: [0.21, 0.47, 0.32, 0.98] }}
                >
                  <span className="mr-4 font-mono text-xs text-indigo-300/70">0{i + 1}</span>
                  {link.label}
                </motion.a>
              ))}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.45, duration: 0.4 }}
                className="pt-8"
              >
                <ButtonLink href="#resume" onClick={() => setOpen(false)} className="w-full">
                  VIEW RESUME
                </ButtonLink>
              </motion.div>
            </nav>
            <p className="px-8 pb-10 font-mono text-[10px] tracking-[0.2em] text-slate-500">
              {siteConfig.tagline}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
