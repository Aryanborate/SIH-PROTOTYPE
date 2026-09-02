import { cn } from '../../lib/utils'

/**
 * Bespoke, hand-drawn SVG visuals per project — no stock photos, no fake
 * screenshots. Each one illustrates the project's actual concept.
 */

function AgriVisual() {
  return (
    <svg viewBox="0 0 520 340" className="h-auto w-full" role="img" aria-label="Concept diagram: field sensor nodes feeding an AI monitoring pipeline">
      <defs>
        <linearGradient id="agri-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0B1122" />
          <stop offset="1" stopColor="#070B18" />
        </linearGradient>
        <radialGradient id="agri-glow" cx="0.5" cy="0.35" r="0.65">
          <stop offset="0" stopColor="rgba(79,70,229,0.22)" />
          <stop offset="1" stopColor="rgba(79,70,229,0)" />
        </radialGradient>
      </defs>
      <rect width="520" height="340" rx="16" fill="url(#agri-bg)" />
      <rect width="520" height="340" rx="16" fill="url(#agri-glow)" />

      {/* field grid */}
      <g transform="translate(52 168) skewY(-5)">
        {Array.from({ length: 4 }).map((_, r) =>
          Array.from({ length: 10 }).map((_, c) => {
            const hot = (r === 1 && c === 3) || (r === 2 && c === 6) || (r === 0 && c === 8)
            return (
              <rect
                key={`${r}-${c}`}
                x={c * 42}
                y={r * 32}
                width={34}
                height={24}
                rx={5}
                fill={hot ? 'rgba(34,211,238,0.13)' : 'rgba(99,102,241,0.05)'}
                stroke={hot ? 'rgba(34,211,238,0.45)' : 'rgba(99,102,241,0.2)'}
                strokeWidth="1"
              />
            )
          }),
        )}
      </g>

      {/* telemetry links */}
      <g fill="none" stroke="rgba(96,165,250,0.45)" strokeWidth="1" strokeDasharray="4 4" className="animate-dash">
        <path d="M100 168 L100 118 L244 88" />
        <path d="M312 168 L312 104 L266 84" />
        <path d="M474 168 L474 128 L286 80" />
      </g>
      <circle cx="100" cy="168" r="5" fill="#60A5FA" />
      <circle cx="474" cy="168" r="5" fill="#60A5FA" />
      <circle cx="312" cy="168" r="9" fill="none" stroke="#22D3EE" strokeWidth="1" opacity="0.55" className="animate-pulse-soft" />
      <circle cx="312" cy="168" r="5" fill="#22D3EE" />

      {/* gateway + AI monitor */}
      <line x1="271" y1="52" x2="271" y2="70" stroke="rgba(129,140,248,0.5)" strokeWidth="1" />
      <rect x="236" y="70" width="70" height="26" rx="8" fill="rgba(99,102,241,0.12)" stroke="rgba(129,140,248,0.5)" />
      <text x="271" y="87" textAnchor="middle" fontSize="10" fontFamily="ui-monospace, monospace" fill="#A5B4FC" letterSpacing="2">
        GATEWAY
      </text>
      <rect x="218" y="24" width="106" height="28" rx="8" fill="rgba(99,102,241,0.18)" stroke="rgba(129,140,248,0.6)" />
      <text x="271" y="42" textAnchor="middle" fontSize="10" fontFamily="ui-monospace, monospace" fill="#C7D2FE" letterSpacing="2">
        AI · MONITOR
      </text>

      <text x="34" y="316" fontSize="9" fontFamily="ui-monospace, monospace" fill="#64748B" letterSpacing="2">
        CONCEPT — SENSE → CLASSIFY → TARGET (EXPLORATION STAGE)
      </text>
    </svg>
  )
}

function PortfolioVisual() {
  return (
    <svg viewBox="0 0 520 340" className="h-auto w-full" role="img" aria-label="Miniature browser window showing a live constellation scene">
      <defs>
        <linearGradient id="pf-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0B1122" />
          <stop offset="1" stopColor="#070B18" />
        </linearGradient>
        <radialGradient id="pf-core" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="rgba(129,140,248,0.5)" />
          <stop offset="1" stopColor="rgba(129,140,248,0)" />
        </radialGradient>
      </defs>
      <rect width="520" height="340" rx="16" fill="url(#pf-bg)" />

      {/* browser window */}
      <rect x="90" y="52" width="340" height="222" rx="12" fill="#0A0F1F" stroke="rgba(255,255,255,0.1)" />
      <line x1="90" y1="82" x2="430" y2="82" stroke="rgba(255,255,255,0.08)" />
      <circle cx="108" cy="67" r="3.5" fill="#475569" />
      <circle cx="122" cy="67" r="3.5" fill="#475569" />
      <circle cx="136" cy="67" r="3.5" fill="#475569" />
      <rect x="160" y="58" width="180" height="17" rx="8.5" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.08)" />
      <text x="250" y="70" textAnchor="middle" fontSize="8" fontFamily="ui-monospace, monospace" fill="#64748B">
        aditya-mengar.vercel.app
      </text>

      {/* mini constellation */}
      <circle cx="260" cy="185" r="40" fill="url(#pf-core)" />
      <g stroke="rgba(99,102,241,0.45)" strokeWidth="1">
        <line x1="260" y1="185" x2="196" y2="140" />
        <line x1="260" y1="185" x2="330" y2="136" />
        <line x1="260" y1="185" x2="212" y2="228" />
        <line x1="260" y1="185" x2="318" y2="232" />
        <line x1="196" y1="140" x2="330" y2="136" />
        <line x1="212" y1="228" x2="318" y2="232" />
      </g>
      <circle cx="260" cy="185" r="9" fill="#818CF8" />
      <circle cx="260" cy="185" r="18" fill="none" stroke="rgba(129,140,248,0.35)" className="animate-pulse-soft" />
      <circle cx="196" cy="140" r="4" fill="#60A5FA" />
      <circle cx="330" cy="136" r="4" fill="#60A5FA" />
      <circle cx="212" cy="228" r="4" fill="#60A5FA" />
      <circle cx="318" cy="232" r="4" fill="#60A5FA" />

      <text x="260" y="306" textAnchor="middle" fontSize="9" fontFamily="ui-monospace, monospace" fill="#64748B" letterSpacing="2">
        REACT · TYPESCRIPT · THREE.JS — BUILT FROM SCRATCH
      </text>
    </svg>
  )
}

function GenericVisual() {
  return (
    <svg viewBox="0 0 520 340" className="h-auto w-full" role="img" aria-label="Abstract project diagram">
      <rect width="520" height="340" rx="16" fill="#0A0F1F" />
      <g stroke="rgba(99,102,241,0.3)" strokeWidth="1">
        <line x1="120" y1="110" x2="260" y2="170" />
        <line x1="400" y1="100" x2="260" y2="170" />
        <line x1="180" y1="250" x2="260" y2="170" />
        <line x1="380" y1="240" x2="260" y2="170" />
      </g>
      <circle cx="260" cy="170" r="12" fill="#818CF8" />
      <circle cx="120" cy="110" r="6" fill="#60A5FA" />
      <circle cx="400" cy="100" r="6" fill="#60A5FA" />
      <circle cx="180" cy="250" r="6" fill="#60A5FA" />
      <circle cx="380" cy="240" r="6" fill="#60A5FA" />
      <text x="260" y="306" textAnchor="middle" fontSize="9" fontFamily="ui-monospace, monospace" fill="#64748B" letterSpacing="2">
        VISUAL — ADD IMAGES IN src/data/projects.ts
      </text>
    </svg>
  )
}

export default function ProjectVisual({ id, className }: { id: string; className?: string }) {
  return (
    <figure className={cn('glass relative overflow-hidden rounded-2xl p-4 sm:p-6', className)}>
      {id === 'agri-ai-iot' ? <AgriVisual /> : id === 'live-3d-portfolio' ? <PortfolioVisual /> : <GenericVisual />}
    </figure>
  )
}
