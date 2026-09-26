/**
 * Deployment-config regression guard.
 *
 * The bug this prevents: a Vercel deploy with no env vars made every API route
 * return an identical, context-free "Something went wrong" — which reads as an
 * application bug rather than a missing DATABASE_URL. These assertions pin the
 * contract that a misconfigured deployment must satisfy:
 *
 *   - /api/health reports exactly which variable is missing and how to fix it
 *   - data routes return 503 DATABASE_NOT_CONFIGURED, never a bare 500
 *   - no route leaks Prisma/SQLite internals to the client
 *   - a SQLite file URL is rejected on serverless rather than failing obscurely
 *
 * Start a misconfigured server first:
 *   set VERCEL=1 && set DATABASE_URL=file:../db/custom.db && npx next dev -p 3222
 */
const B = process.env.GIGSETU_MISCONFIG_BASE_URL || 'http://localhost:3222'

let passed = 0
let failed = 0
const ok = (c: boolean, label: string, extra = '') => {
  if (c) passed++
  else failed++
  console.log(`${c ? ' PASS' : '!FAIL'}  ${label}${extra ? ' :: ' + extra : ''}`)
}

async function get(path: string): Promise<{ s: number; text: string; json: any }> {
  try {
    const r = await fetch(B + path)
    const text = await r.text()
    let json: any = null
    try {
      json = JSON.parse(text)
    } catch {
      /* leave null */
    }
    return { s: r.status, text, json }
  } catch (e) {
    return { s: 0, text: String(e), json: null }
  }
}

async function main() {
  console.log(`\n=== deployment self-check (${B}) ===\n`)

  if ((await get('/api/categories')).s === 0) {
    console.log('!FAIL  no server answering — start one with:')
    console.log('       set VERCEL=1 && set DATABASE_URL=file:../db/custom.db && npx next dev -p 3222')
    process.exitCode = 1
    return
  }

  const health = await get('/api/health')
  ok(health.s === 503, '/api/health returns 503 when the DB is unusable', `HTTP ${health.s}`)
  ok(health.json?.status === 'misconfigured', '…and labels itself misconfigured', health.json?.status)
  ok(health.json?.database?.configured === false, '…and reports database.configured = false')
  ok(Boolean(health.json?.database?.error), '…and states the actual reason', health.json?.database?.error)
  ok(Boolean(health.json?.database?.hint), '…and gives a remedy', health.json?.database?.hint)
  ok(
    Boolean(health.json?.database?.hint?.includes('libsql')),
    '…that names a serverless-capable option, not just "set DATABASE_URL"'
  )

  // The SQLite-file-on-serverless trap must be called out explicitly, because
  // that is the mistake that produced the original report.
  ok(
    /no writable filesystem/i.test(health.json?.database?.error ?? ''),
    'a file: URL on serverless is diagnosed as a filesystem problem',
    health.json?.database?.error
  )

  // Every DB-backed route must fail the same legible way.
  for (const p of ['/api/categories', '/api/auth/identities', '/api/hierarchy/dashboard?level=national']) {
    const r = await get(p)
    ok(r.s === 503, `GET ${p} -> 503, not a bare 500`, `HTTP ${r.s}`)
    ok(r.json?.code === 'DATABASE_NOT_CONFIGURED', `GET ${p} carries the error code`, r.json?.code)
  }

  // No route may leak driver internals.
  const leaks: string[] = []
  for (const p of ['/api/health', '/api/categories', '/api/auth/identities', '/api/hierarchy/dashboard?level=national']) {
    const r = await get(p)
    if (/Prisma|prisma\.|Invalid `|invocation:|datasource|Query engine|at Object\.|node_modules/i.test(r.text)) {
      leaks.push(p)
    }
  }
  ok(leaks.length === 0, 'no route leaks Prisma/driver internals to the client', leaks.join(', ') || 'clean')

  // Session must still answer — it needs no database when nobody is signed in.
  const sess = await get('/api/session')
  ok(sess.s === 200 && sess.json?.ok === true, 'GET /api/session still works without a DB', `HTTP ${sess.s}`)

  console.log(`\n${'='.repeat(60)}`)
  console.log(`  ${passed} passed, ${failed} failed`)
  console.log('='.repeat(60))
  if (failed > 0) process.exitCode = 1
}

main()
