'use client'

// Shared client-side CSV snapshot helpers.
// Introduced in the polish round to reuse the cooperative export pattern across
// the cooperative, taluka and district dashboards (no server round-trip — the
// file is generated from already-fetched dashboard data in the browser).

/** Escape a single CSV cell (quotes, commas, newlines). */
export function csvCell(v: unknown): string {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Join cells into one CSV row. */
export function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(',')
}

/** File-name-safe slug (lowercase, hyphenated). */
export function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

/** Build a Blob download with UTF-8 BOM so Excel renders Devanagari correctly. */
export function downloadCsv(name: string, csv: string) {
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
