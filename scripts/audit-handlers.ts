/**
 * For every onClick={name} reference that the structural audit could not
 * resolve, find the declaration and verify: if it is async, does it catch?
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()
const TARGETS: [string, string[]][] = [
  ['src/components/gigsetu/ai/ai-intelligence.tsx', ['onRetry']],
  ['src/components/gigsetu/app-shell.tsx', ['handleStartDemo', 'logout', 'markAllRead', 'stopSihDemo']],
  ['src/components/gigsetu/coop/coop-reputation.tsx', ['onOpenComplaints']],
  ['src/components/gigsetu/customer/booking-detail.tsx', ['declineAllOffers', 'onBack']],
  ['src/components/gigsetu/customer/booking-flow.tsx', ['onClose']],
  ['src/components/gigsetu/customer/customer-app.tsx', ['useCurrentLocation']],
  ['src/components/gigsetu/customer/diagnose-dialog.tsx', ['endAndRecommend']],
  ['src/components/gigsetu/customer/institution-portal.tsx', ['exportCsv']],
  ['src/components/gigsetu/demo/demo-panel.tsx', ['advance', 'doReset', 'stopSihDemo']],
  ['src/components/gigsetu/hierarchy/district-dashboard.tsx', ['onOpen']],
  ['src/components/gigsetu/hierarchy/hierarchy-view.tsx', ['onToggle']],
  ['src/components/gigsetu/hierarchy/state-dashboard.tsx', ['onOpen']],
  ['src/components/gigsetu/hierarchy/taluka-dashboard.tsx', ['onOpen']],
  ['src/components/gigsetu/hierarchy/taluka-district-kit.tsx', ['onClear', 'onRetry']],
  ['src/components/gigsetu/login-screen.tsx', ['handleStartDemo']],
  ['src/components/gigsetu/shared/about-model.tsx', ['onSelect', 'openInDashboard']],
  ['src/components/gigsetu/shared/notification-center.tsx', ['markAllRead']],
  ['src/components/gigsetu/worker/worker-sections.tsx', ['onRetry']],
]

function bodyAfter(src: string, from: number): string {
  let b = src.indexOf('{', from)
  if (b === -1) return ''
  let d = 0
  for (let e = b; e < src.length; e++) {
    if (src[e] === '{') d++
    else if (src[e] === '}') {
      d--
      if (d === 0) return src.slice(b + 1, e)
    }
  }
  return ''
}

let problems = 0
for (const [file, names] of TARGETS) {
  const p = join(ROOT, file)
  if (!statSync(p).isFile()) {
    console.log(`!! missing ${file}`)
    continue
  }
  const src = readFileSync(p, 'utf8')
  for (const name of names) {
    // find the declaration: either "function name(" or "name = " / "name: ... ="
    const fnRe = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`)
    const varRe = new RegExp(`\\b${name}\\s*(?::[^=\\n]+)?=\\s*(?:async\\s*)?(?:\\([^)]*\\)|function\\s*\\([^)]*\\))\\s*(?:=>)?`, 'm')
    const m1 = fnRe.exec(src)
    const m2i = varRe.exec(src)
    const at = m1 ? m1.index : m2i ? m2i.index : -1
    if (at === -1) {
      console.log(`?? ${relative(ROOT, p)}  ${name}  -- declaration not found (prop or import?)`)
      problems++
      continue
    }
    const isAsync = new RegExp(`(?:async\\s+function\\s+${name}\\b)|(?:\\b${name}\\b[^=\\n]*=\\s*async)`).test(src.slice(Math.max(0, at - 40), at + 120))
    const body = bodyAfter(src, at)
    const hasCatch = /\bcatch\b/.test(body)
    const awaits = /\bawait\b/.test(body)
    const line = src.slice(0, at).split('\n').length
    const flag = isAsync && awaits && !hasCatch ? 'UNHANDLED' : 'ok'
    if (flag === 'UNHANDLED') problems++
    console.log(
      `${flag.padEnd(10)} ${relative(ROOT, p)}:${line}  ${name}  async=${isAsync} awaits=${awaits} catch=${hasCatch}`
    )
    if (flag === 'UNHANDLED') console.log(`            body: ${body.replace(/\s+/g, ' ').trim().slice(0, 150)}`)
  }
}
console.log(`\nunhandled async handlers needing a fix: ${problems}`)
