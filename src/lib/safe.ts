// Pure, dependency-free safety helpers shared by server AND client code.
// Deliberately has NO `server-only` import so engine modules (matching, pricing,
// geoapify fallback math) can be exercised from scripts and tests as well as
// from Next.js route handlers.

/** Parse a JSON column, falling back to `fallback` on anything malformed. */
export function safeJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try {
    const v = JSON.parse(raw)
    return (v ?? fallback) as T
  } catch {
    return fallback
  }
}

export function safeArray<T = unknown>(raw: string | null | undefined): T[] {
  const v = safeJson<unknown>(raw, [])
  return Array.isArray(v) ? (v as T[]) : []
}

export function safeObject<T extends object>(raw: string | null | undefined): T {
  const v = safeJson<unknown>(raw, {})
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as T) : ({} as T)
}

/** Clamp a number into a range, returning `fallback` for non-finite input. */
export function clampNumber(n: unknown, min: number, max: number, fallback: number): number {
  const v = Number(n)
  if (!Number.isFinite(v)) return fallback
  return Math.max(min, Math.min(max, v))
}

/** Parse a possibly-invalid ISO date; returns `fallback` when unparseable. */
export function safeDate(iso: unknown, fallback: Date): Date {
  if (typeof iso !== 'string' || !iso) return fallback
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? fallback : d
}

/** toISOString that never throws — use anywhere a user string could reach a Date. */
export function safeIso(iso: unknown, fallback = new Date()): string {
  return safeDate(iso, fallback).toISOString()
}

/** Trim + length-cap any untrusted string. */
export function safeStr(v: unknown, max = 200, fallback = ''): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : fallback
}
