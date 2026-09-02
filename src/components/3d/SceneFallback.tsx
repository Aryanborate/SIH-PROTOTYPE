import { useEffect } from 'react'

/**
 * Designed static fallback — shown when WebGL is unavailable (and while the
 * lazy 3D bundle loads). Not a broken placeholder: a labelled constellation.
 */

const DOTS = [
  { x: 50, y: 44, r: 5, label: 'DATA SCIENCE' },
  { x: 24, y: 28, r: 3.5 },
  { x: 74, y: 24, r: 3.5, label: 'AI' },
  { x: 15, y: 58, r: 3 },
  { x: 36, y: 72, r: 3.5, label: 'SQL' },
  { x: 62, y: 66, r: 3 },
  { x: 85, y: 50, r: 3.5, label: 'ANALYTICS' },
  { x: 46, y: 16, r: 3 },
  { x: 68, y: 86, r: 3, label: 'PROGRAMMING' },
]

const LINES: Array<[number, number]> = [
  [0, 1], [0, 2], [0, 3], [0, 5], [1, 7], [2, 7], [3, 4],
  [4, 6], [5, 8], [6, 8], [0, 4], [2, 6],
]

export default function SceneFallback({
  onReady,
  compact,
}: {
  onReady?: () => void
  compact?: boolean
}) {
  useEffect(() => {
    onReady?.()
  }, [onReady])

  return (
    <div className="relative h-full w-full overflow-hidden" aria-hidden="true">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(340px 240px at 50% 42%, rgba(79,70,229,0.22), transparent 70%)',
        }}
      />
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        {LINES.map(([a, b], i) => (
          <line
            key={i}
            x1={DOTS[a].x}
            y1={DOTS[a].y}
            x2={DOTS[b].x}
            y2={DOTS[b].y}
            stroke="rgba(99,102,241,0.32)"
            strokeWidth="0.18"
          />
        ))}
      </svg>
      {DOTS.map((d, i) => (
        <div
          key={i}
          className="animate-float absolute rounded-full"
          style={{
            left: `${d.x}%`,
            top: `${d.y}%`,
            width: d.r * 2,
            height: d.r * 2,
            transform: 'translate(-50%, -50%)',
            backgroundColor: d.label ? '#A5B4FC' : '#60A5FA',
            boxShadow: '0 0 14px rgba(96,165,250,0.55)',
            animationDelay: `${i * 0.45}s`,
          }}
        />
      ))}
      {!compact &&
        DOTS.filter((d) => d.label).map((d) => (
          <div
            key={d.label}
            className="absolute -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-[#0A0F1F]/80 px-2 py-0.5 font-mono text-[8px] tracking-[0.16em] text-indigo-200/80 backdrop-blur-sm"
            style={{ left: `${d.x}%`, top: `${d.y + 9}%` }}
          >
            {d.label}
          </div>
        ))}
      {compact && (
        <p className="absolute bottom-3 left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-[0.2em] text-slate-500">
          LOADING SCENE
        </p>
      )}
    </div>
  )
}
