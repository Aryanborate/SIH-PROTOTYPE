import { Github, Linkedin, Mail } from 'lucide-react'
import { hasLink, siteConfig } from '../../data/siteConfig'

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06]">
      <div className="container-pad flex flex-col gap-8 py-12 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-display text-sm font-semibold tracking-[0.18em] text-slate-100">
            {siteConfig.name.toUpperCase()}
          </p>
          <p className="mt-2 font-mono text-[10px] tracking-[0.18em] text-slate-500">
            {siteConfig.tagline}
          </p>
        </div>

        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-slate-400">
          <a href="#about" className="transition-colors hover:text-slate-100">
            About
          </a>
          <a href="#skills" className="transition-colors hover:text-slate-100">
            Skills
          </a>
          <a href="#projects" className="transition-colors hover:text-slate-100">
            Projects
          </a>
          <a href="#journey" className="transition-colors hover:text-slate-100">
            Journey
          </a>
          <a href="#contact" className="transition-colors hover:text-slate-100">
            Contact
          </a>
        </nav>

        <div className="flex gap-3">
          {hasLink(siteConfig.github) && (
            <a
              href={siteConfig.github}
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub profile"
              className="neu-chip p-2.5 text-slate-300 transition-colors hover:text-white"
            >
              <Github size={16} aria-hidden="true" />
            </a>
          )}
          {hasLink(siteConfig.linkedin) && (
            <a
              href={siteConfig.linkedin}
              target="_blank"
              rel="noreferrer"
              aria-label="LinkedIn profile"
              className="neu-chip p-2.5 text-slate-300 transition-colors hover:text-white"
            >
              <Linkedin size={16} aria-hidden="true" />
            </a>
          )}
          {hasLink(siteConfig.email) && (
            <a
              href={`mailto:${siteConfig.email}`}
              aria-label="Send an email"
              className="neu-chip p-2.5 text-slate-300 transition-colors hover:text-white"
            >
              <Mail size={16} aria-hidden="true" />
            </a>
          )}
        </div>
      </div>

      <div className="container-pad flex flex-col gap-2 border-t border-white/[0.05] pb-28 pt-6 font-mono text-[10px] tracking-[0.14em] text-slate-600 sm:flex-row sm:items-center sm:justify-between">
        <p>DESIGNED & BUILT BY {siteConfig.name.toUpperCase()}</p>
        <p>© 2026 {siteConfig.name.toUpperCase()} · REACT · THREE.JS</p>
      </div>
    </footer>
  )
}
