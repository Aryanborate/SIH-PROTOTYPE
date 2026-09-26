/**
 * Static audit: every API path the client calls must exist as a real route.
 * Catches the "button throws 404" class of bug without a browser.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    const s = statSync(p)
    if (s.isDirectory()) {
      if (['node_modules', '.next', '.git', 'db', 'public'].includes(e)) continue
      walk(p, out)
    } else if (/\.(tsx?|jsx?)$/.test(e)) out.push(p)
  }
  return out
}

/** Route table from the filesystem: /api/foo/[id]/route.ts -> /api/foo/:id */
function routeTable(): Set<string> {
  const routes = new Set<string>()
  const base = join(ROOT, 'src', 'app')
  const rec = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e)
      if (statSync(p).isDirectory()) rec(p)
      else if (e === 'route.ts') {
        let r = '/' + relative(base, dir).replace(/\\/g, '/')
        r = r.replace(/\[\.\.\.(\w+)\]/g, ':$1').replace(/\[(\w+)\]/g, ':$1')
        routes.add(r)
      }
    }
  }
  rec(base)
  return routes
}

/**
 * Extract the first argument of api.get/post/patch/del(...) with a balanced
 * scanner, so nested template literals like
 *   `/api/coop${orgId ? `?id=${orgId}` : ''}`
 * are captured whole instead of being cut at the inner backtick.
 */
function clientCalls(): { file: string; line: number; verb: string; path: string }[] {
  const files = walk(join(ROOT, 'src'))
  const out: { file: string; line: number; verb: string; path: string }[] = []
  const re = /api\.(get|post|patch|del)(?:<[^>]*>)?\(/g

  for (const f of files) {
    const src = readFileSync(f, 'utf8')
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(src))) {
      const verb = m[1]
      let i = re.lastIndex
      while (i < src.length && /\s/.test(src[i])) i++
      const quote = src[i]
      if (quote !== '`' && quote !== "'" && quote !== '"') continue

      // Walk the string, tracking nesting of the SAME quote char and of ${ }.
      let j = i + 1
      let depth = 0
      let path = ''
      while (j < src.length) {
        const c = src[j]
        if (depth === 0 && c === quote) break
        if (quote === '`' && c === '$' && src[j + 1] === '{') {
          depth++
          j += 2
          continue
        }
        if (quote === '`' && depth > 0) {
          if (c === '}') depth--
          else if (c === '{') depth++
          j++
          continue
        }
        path += c
        j++
      }
      if (depth !== 0) continue
      re.lastIndex = j + 1

      if (path.startsWith('/api/')) {
        out.push({
          file: relative(ROOT, f),
          line: src.slice(0, i).split('\n').length,
          verb,
          path,
        })
      }
    }
  }
  return out
}

const routes = routeTable()
const calls = clientCalls()

/** Normalise a call path into a comparable shape. */
function shape(p: string): string {
  return (
    '/api/' +
    p
      .replace(/^\/api\//, '')
      .split('?')[0]
      .replace(/\$\{[^}]*\}/g, ':x') // template segments -> :x
      .replace(/\/+$/, '')
  )
}

/** Does a concrete route satisfy this call shape? */
function matches(callShape: string): boolean {
  if (routes.has(callShape)) return true
  const parts = callShape.split('/').filter(Boolean)
  for (const r of routes) {
    const rp = r.split('/').filter(Boolean)
    if (rp.length !== parts.length) continue
    let good = true
    for (let i = 0; i < parts.length; i++) {
      if (rp[i].startsWith(':')) continue
      if (rp[i] !== parts[i]) {
        good = false
        break
      }
    }
    if (good) return true
  }
  return false
}

console.log(`routes discovered : ${routes.size}`)
console.log(`client API calls : ${calls.length}\n`)

const missing = calls.filter((c) => !matches(shape(c.path)))
if (missing.length === 0) {
  console.log('OK  every client API call resolves to a real route')
} else {
  console.log(`!! ${missing.length} client call(s) with NO matching route:\n`)
  for (const m of missing) console.log(`   ${m.file}:${m.line}  ${m.verb.toUpperCase()} ${m.path}   -> looked for ${shape(m.path)}`)
}

const dupes = [...routes].filter((r) => r.split('/').filter(Boolean).some((s) => s.startsWith(':')))
console.log(`\ndynamic routes: ${dupes.length}`)
for (const d of dupes.sort()) console.log(`   ${d}`)

process.exit(missing.length ? 1 : 0)
