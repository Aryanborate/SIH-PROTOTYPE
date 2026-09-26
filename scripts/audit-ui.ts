/**
 * Static UI audit.
 *
 * Targets the three failure classes that silently break a demo:
 *   1. async onClick handlers with no error handling -> unhandled rejection,
 *      the button appears dead and the real reason is never shown
 *   2. dead buttons: no onClick, no type=submit, no asChild/href
 *   3. i18n keys referenced with t('...') but never defined
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = process.cwd()

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    const s = statSync(p)
    if (s.isDirectory()) {
      if (['node_modules', '.next', '.git', 'db', 'public'].includes(e)) continue
      walk(p, out)
    } else if (/\.tsx$/.test(e)) out.push(p)
  }
  return out
}

/** shadcn primitives and generic hooks are not app surfaces — skip them. */
function isAppFile(f: string): boolean {
  const r = relative(ROOT, f).replace(/\\/g, '/')
  if (r.startsWith('src/components/ui/')) return false
  if (r.startsWith('src/hooks/')) return false
  if (/\.stories\.tsx$/.test(r)) return false
  return true
}

function stripCommentsAndStrings(src: string): string {
  // remove /* */ and // comments, and template/string bodies, so we only
  // inspect real code structure.
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/`(?:\\.|[^`\\])*`/g, '``')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
}

const files = walk(join(ROOT, 'src')).filter(isAppFile)
let unhandled = 0
let dead = 0
let i18nMissing = 0
let asyncHandlers = 0
let totalHandlers = 0
let totalButtons = 0
let totalRefHandlers = 0
let totalRefResolved = 0
const unresolvedRefs = new Set<string>()
const notes: string[] = []

// ---------- 1 + 2: handler analysis ----------
for (const f of files) {
  const raw = readFileSync(f, 'utf8')
  const code = stripCommentsAndStrings(raw)
  const rel = relative(ROOT, f)
  const lineOf = (idx: number) => code.slice(0, idx).split('\n').length

  // onClick={ ... } attribute values
  const onClickRe = /onClick\s*=\s*\{/g
  let m: RegExpExecArray | null
  while ((m = onClickRe.exec(code))) {
    // balanced scan of the {...} expression
    let i = code.indexOf('{', m.index)
    let depth = 0
    let j = i
    for (; j < code.length; j++) {
      if (code[j] === '{') depth++
      else if (code[j] === '}') {
        depth--
        if (depth === 0) break
      }
    }
    const body = code.slice(i + 1, j)
    const line = lineOf(i)
    totalHandlers++

    const isAsync = /async\s*(\(|function)/.test(body) || /async\s*\(/.test(body)
    if (isAsync) {
      asyncHandlers++
      const hasCatch = /\bcatch\b/.test(body)
      const isVoided = /void\s+/.test(body)
      // A handler that awaits a helper which itself catches is fine; we only
      // flag the ones with no local catch and no void guard.
      if (!hasCatch && !isVoided) {
        unhandled++
        const preview = body.replace(/\s+/g, ' ').trim().slice(0, 90)
        notes.push(`UNHANDLED  ${rel}:${line}  async onClick with no catch -> ${preview}`)
      }
    }
  }

  // Pass-by-reference handlers: onClick={someAsyncFn}. These are invisible to
  // the inline scanner above, so resolve the identifier against the file's own
  // declarations and apply the same catch rule.
  const declRe = /(?:const|let|function)\s+([A-Za-z0-9_$]+)\s*(?::[^=]*?)?=\s*(async\s*)?\(/g
  const decls = new Map<string, { async: boolean; body: string; line: number }>()
  let dm: RegExpExecArray | null
  while ((dm = declRe.exec(code))) {
    const name = dm[1]
    // capture the balanced body
    let i = code.indexOf('(', dm.index)
    let depth = 0
    let j = i
    for (; j < code.length; j++) {
      if (code[j] === '(') depth++
      else if (code[j] === ')') {
        depth--
        if (depth === 0) break
      }
    }
    // body = braces after the parens
    let b = code.indexOf('{', j)
    if (b === -1) continue
    let bd = 0
    let e = b
    for (; e < code.length; e++) {
      if (code[e] === '{') bd++
      else if (code[e] === '}') {
        bd--
        if (bd === 0) break
      }
    }
    decls.set(name, { async: !!dm[2], body: code.slice(b + 1, e), line: lineOf(dm.index) })
  }

  const refRe = /onClick\s*=\s*\{\s*([A-Za-z0-9_$]+)\s*\}/g
  let rm: RegExpExecArray | null
  let refsSeen = 0
  let refsResolved = 0
  while ((rm = refRe.exec(code))) {
    refsSeen++
    const d = decls.get(rm[1])
    if (!d) continue
    refsResolved++
    if (!d.async) continue
    asyncHandlers++
    if (!/\bcatch\b/.test(d.body) && !/void\s+/.test(d.body)) {
      unhandled++
      notes.push(`UNHANDLED  ${rel}:${d.line}  async fn ${rm[1]}() passed to onClick with no catch -> ${d.body.replace(/\s+/g, ' ').trim().slice(0, 80)}`)
    }
  }
  if (refsSeen) {
    totalRefHandlers += refsSeen
    totalRefResolved += refsResolved
    for (const [name] of decls) {
      if (new RegExp(`onClick\\s*=\\s*\\{\\s*${name}\\s*\\}`).test(code)) continue
      void name
    }
    const refNames = [...code.matchAll(/onClick\s*=\s*\{\s*([A-Za-z0-9_$]+)\s*\}/g)].map((x) => x[1])
    for (const n of refNames) if (!decls.has(n)) unresolvedRefs.add(`${rel}: ${n}`)
  }

  // dead buttons: <Button ...> whose props contain no interaction affordance.
  // Run on the RAW source: the structural pass above strips string bodies,
  // which would erase the literal "submit" from type="submit".
  const btnRe = /<Button\b/g
  let m2: RegExpExecArray | null
  while ((m2 = btnRe.exec(raw))) {
    const start = m2.index
    let depth = 0
    let j = start
    for (; j < raw.length; j++) {
      if (raw[j] === '{') depth++
      else if (raw[j] === '}') depth--
      else if (raw[j] === '>' && depth === 0) break
    }
    const tag = raw.slice(start, j)
    if (/<Button\b/.test(tag) === false) continue
    totalButtons++
    const line = raw.slice(0, start).split('\n').length

    // A <Button> with no onClick is still live if EITHER:
    //  - it is the child of a *Trigger asChild (Dialog/Popover/AlertDialog/...)
    //  - it is type="submit" (or a bare <button type="submit">) inside a form
    const lookBehind = raw.slice(Math.max(0, start - 200), start)
    const hasTriggerParent = /<\w*Trigger\s+asChild\s*>\s*$/.test(lookBehind)
    const hasFormParent = /<form[^>]*>\s*$/.test(lookBehind)

    const hasAction =
      /onClick\s*=/.test(tag) ||
      /type\s*=\s*["'{]?\s*["']?submit/.test(tag) ||
      /asChild/.test(tag) ||
      /href\s*=/.test(tag) ||
      hasTriggerParent ||
      hasFormParent

    if (!hasAction) {
      dead++
      notes.push(
        `DEAD BTN   ${rel}:${line}  <Button> with no onClick and no trigger/form parent\n            ${tag.replace(/\s+/g, ' ').trim().slice(0, 160)}`
      )
    }
  }
}

// ---------- 3: i18n keys ----------
const i18nDir = join(ROOT, 'src', 'lib')
const defined = new Set<string>()
for (const e of readdirSync(i18nDir)) {
  if (!/^i18n.*\.ts$/.test(e)) continue
  const src = readFileSync(join(i18nDir, e), 'utf8')
  for (const km of src.matchAll(/^\s{2}([A-Za-z0-9_]+)\s*:/gm)) defined.add(km[1])
  // also catch nested one-level objects
  for (const km of src.matchAll(/^\s{4}([A-Za-z0-9_]+)\s*:/gm)) defined.add(km[1])
}

const used = new Map<string, string[]>()
for (const f of files) {
  const raw = readFileSync(f, 'utf8')
  for (const km of raw.matchAll(/\bt\(\s*'([A-Za-z0-9_]+)'/g)) {
    const k = km[1]
    if (!used.has(k)) used.set(k, [])
    const l = raw.slice(0, km.index).split('\n').length
    used.get(k)!.push(`${relative(ROOT, f)}:${l}`)
  }
}

console.log('='.repeat(72))
console.log(`checked ${files.length} component files | ${defined.size} i18n keys defined | ${used.size} keys used`)
console.log('='.repeat(72))
if (notes.length) console.log(notes.join('\n'))
console.log('')
for (const [k, locs] of used) {
  if (!defined.has(k)) {
    i18nMissing++
    console.log(`NO I18N KEY '${k}'  <- ${locs.slice(0, 3).join(', ')}`)
  }
}
console.log('')
if (unresolvedRefs.size) {
  console.log(`by-reference handlers NOT resolvable to a local fn (${unresolvedRefs.size}) - manual check:`)
  for (const u of [...unresolvedRefs].sort()) console.log('   ' + u)
  console.log('')
}
console.log(`onClick handlers seen    : ${totalHandlers} inline + ${totalRefHandlers} by-reference (${totalRefResolved} resolved to a local fn)`)
console.log(`  of which async         : ${asyncHandlers} (all inspected for try/catch)`)
console.log(`<Button> tags seen       : ${totalButtons}`)
console.log(`unhandled async handlers : ${unhandled}`)
console.log(`dead buttons             : ${dead}`)
console.log(`missing i18n keys        : ${i18nMissing}`)
