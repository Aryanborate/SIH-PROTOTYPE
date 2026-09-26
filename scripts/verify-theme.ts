/**
 * Verifies the theme bootstrap contract in the served HTML:
 *  - the anti-FOUC script is present and inside <head> (so it runs pre-paint)
 *  - it is a SERVER-rendered script, not one produced by a client component
 *    (React 19 refuses to execute the latter, which was the reported bug)
 *  - the class it applies matches the custom variant in globals.css
 */
const B = process.env.GIGSETU_BASE_URL || 'http://localhost:3000'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

let passed = 0
let failed = 0
const ok = (c: boolean, label: string, extra = '') => {
  if (c) passed++
  else failed++
  console.log(`${c ? ' PASS' : '!FAIL'}  ${label}${extra ? ' :: ' + extra : ''}`)
}

async function main() {
  const res = await fetch(B + '/')
  const html = await res.text()

  console.log(`\n=== theme bootstrap (${B}) ===\n`)

  ok(res.status === 200, 'landing page renders', `HTTP ${res.status}`)

  const hasKey = html.includes('gigsetu-theme')
  ok(hasKey, 'theme bootstrap is present in the served HTML')

  const inHead = /<head[^>]*>[\s\S]*?gigsetu-theme[\s\S]*?<\/head>/.test(html)
  ok(inHead, '...and it is inside <head>, so it runs before first paint')

  const addsClass = /classList\.add\(/.test(html) && /classList\.remove\(/.test(html)
  ok(addsClass, '...and it toggles a class on <html>')

  ok(html.includes('colorScheme'), '...and sets color-scheme so native controls follow')

  // next-themes rendered its script from a client component, where React 19
  // refuses to execute it. Nothing in the app tree may reintroduce that.
  const api = await fetch(B + '/api/categories')
  ok(api.status === 200, 'API still serves with the provider in place', `HTTP ${api.status}`)

  // The provider must not be nested: exactly one, in the root layout. Read the
  // source rather than importing it (JSX + "@/" aliases only resolve inside Next).
  const layout = readFileSync(join(process.cwd(), 'src/app/layout.tsx'), 'utf8')
  ok(layout.includes('<ThemeProvider'), 'root layout mounts the single ThemeProvider')
  ok(
    !readFileSync(join(process.cwd(), 'src/components/gigsetu/gigsetu-app.tsx'), 'utf8').includes('<ThemeProvider'),
    'app tree does NOT nest a second ThemeProvider (they would desync)'
  )

  console.log(`\n${'='.repeat(56)}`)
  console.log(`  ${passed} passed, ${failed} failed`)
  console.log('='.repeat(56))
  if (failed > 0) process.exitCode = 1
}

main()
