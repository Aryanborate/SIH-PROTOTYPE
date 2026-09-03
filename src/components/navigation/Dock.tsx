import { useEffect, useRef, useState } from 'react'
import {
  FileText,
  FolderKanban,
  Github,
  House,
  Mail,
  Milestone,
  Sparkles,
  User,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '../../lib/utils'

/**
 * Apple/macOS-style magnifying dock — a floating bottom navigation that maps
 * 1:1 to the portfolio's real sections. Distance-based magnification wave
 * (smoothstep falloff from the pointer), GPU transforms only, zero React
 * re-renders during tracking (styles are applied through refs in a rAF loop).
 */

const DOCK_CONFIG = {
  hoverScale: 1.55,
  influenceRadius: 110, // px — how far the magnification wave reaches
  easing: 0.22, // per-frame lerp toward target scale
} as const

interface DockEntry {
  id: string
  label: string
  target: string
  icon: LucideIcon
}

/** Every entry maps to an existing section id — nothing invented. */
const DOCK_ITEMS: DockEntry[] = [
  { id: 'top', label: 'Home', target: '#top', icon: House },
  { id: 'about', label: 'About', target: '#about', icon: User },
  { id: 'skills', label: 'Skills', target: '#skills', icon: Sparkles },
  { id: 'projects', label: 'Projects', target: '#projects', icon: FolderKanban },
  { id: 'journey', label: 'Journey', target: '#journey', icon: Milestone },
  { id: 'github', label: 'GitHub', target: '#github', icon: Github },
  { id: 'contact', label: 'Contact', target: '#contact', icon: Mail },
  { id: 'resume', label: 'Resume', target: '#resume', icon: FileText },
]

export default function Dock() {
  const [activeId, setActiveId] = useState('')
  const [hovered, setHovered] = useState<number | null>(null)

  const itemRefs = useRef<Array<HTMLAnchorElement | null>>([])
  const scales = useRef<number[]>(DOCK_ITEMS.map(() => 1))
  const targets = useRef<number[]>(DOCK_ITEMS.map(() => 1))
  const pointerInside = useRef(false)
  const raf = useRef(0)
  const canMagnify = useRef(false)
  const instantMode = useRef(false)

  useEffect(() => {
    canMagnify.current = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    // reduced motion: magnify instantly on pointer move — no animation frames
    instantMode.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  // active-section tracking — same observer pattern as the navbar
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveId(entry.target.id)
        })
      },
      { rootMargin: '-45% 0px -50% 0px' },
    )
    DOCK_ITEMS.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const apply = () => {
    itemRefs.current.forEach((el, i) => {
      if (el) el.style.transform = `scale(${scales.current[i].toFixed(4)})`
    })
  }

  const tick = () => {
    let settling = false
    for (let i = 0; i < scales.current.length; i++) {
      const target = targets.current[i]
      const next = scales.current[i] + (target - scales.current[i]) * DOCK_CONFIG.easing
      if (Math.abs(target - next) > 0.0015) settling = true
      scales.current[i] = next
    }
    apply()
    if (settling || pointerInside.current) {
      raf.current = requestAnimationFrame(tick)
    } else {
      scales.current = DOCK_ITEMS.map(() => 1)
      apply()
      raf.current = 0
    }
  }

  const wake = () => {
    if (!raf.current) raf.current = requestAnimationFrame(tick)
  }

  /** scale = 1 + (hoverScale-1) · smoothstep(1 - distance / influenceRadius) */
  const updateTargets = (clientX: number | null) => {
    if (!canMagnify.current) return
    if (clientX === null) {
      targets.current = DOCK_ITEMS.map(() => 1)
      return
    }
    itemRefs.current.forEach((el, i) => {
      if (!el) {
        targets.current[i] = 1
        return
      }
      const rect = el.getBoundingClientRect()
      const distance = Math.abs(clientX - (rect.left + rect.width / 2))
      const t = Math.min(1, Math.max(0, 1 - distance / DOCK_CONFIG.influenceRadius))
      const smooth = t * t * (3 - 2 * t)
      targets.current[i] = 1 + (DOCK_CONFIG.hoverScale - 1) * smooth
    })
    if (instantMode.current) {
      scales.current = [...targets.current]
      apply()
    }
  }

  return (
    <nav
      aria-label="Section dock"
      className="fixed left-1/2 z-[55] -translate-x-1/2"
      style={{ bottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      onMouseMove={(e) => {
        pointerInside.current = true
        updateTargets(e.clientX)
        if (!instantMode.current) wake()
      }}
      onMouseLeave={() => {
        pointerInside.current = false
        updateTargets(null)
        if (!instantMode.current) wake()
        setHovered(null)
      }}
    >
      <div
        className="glass flex max-w-[calc(100vw-24px)] items-end gap-1 rounded-3xl px-1.5 pb-2 pt-3 sm:gap-1.5 sm:px-2 md:pt-7"
        style={{
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.07), 0 18px 50px -12px rgba(0,0,0,0.65)',
        }}
      >
        {DOCK_ITEMS.map((item, i) => {
          const Icon = item.icon
          const isActive = activeId === item.id
          return (
            <div key={item.id} className="relative">
              <span
                aria-hidden="true"
                className={cn(
                  'pointer-events-none absolute bottom-full left-1/2 mb-8 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-[#0A0F1F]/90 px-2.5 py-1 font-mono text-[10px] tracking-[0.16em] text-slate-200 backdrop-blur-sm transition-all duration-200',
                  hovered === i ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0',
                )}
              >
                {item.label.toUpperCase()}
              </span>
              <a
                ref={(el) => {
                  itemRefs.current[i] = el
                }}
                href={item.target}
                aria-label={item.label}
                aria-current={isActive ? 'true' : undefined}
                onMouseEnter={() => setHovered(i)}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered(null)}
                onKeyDown={(e) => {
                  // native Enter activation, made explicit for webviews
                  // where untrusted key events skip default actions
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    e.currentTarget.click()
                  }
                }}
                style={{ transformOrigin: 'center bottom', willChange: 'transform', transform: 'scale(1)' }}
                className={cn(
                  'relative flex h-9 w-9 items-center justify-center rounded-2xl border transition-colors duration-200 sm:h-11 sm:w-11 md:h-12 md:w-12',
                  isActive
                    ? 'border-indigo-300/30 bg-indigo-400/15 text-indigo-200'
                    : 'border-white/[0.07] bg-white/[0.05] text-slate-400 hover:bg-white/[0.09] hover:text-slate-100',
                )}
              >
                <Icon className="h-[17px] w-[17px] sm:h-[19px] sm:w-[19px] md:h-5 md:w-5" aria-hidden="true" />
                {isActive && (
                  <span
                    className="absolute -bottom-[5px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-indigo-300"
                    aria-hidden="true"
                  />
                )}
              </a>
            </div>
          )
        })}
      </div>
    </nav>
  )
}
