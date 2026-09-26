/**
 * Push the GigSetu schema + demo seed to a remote libSQL/Turso database, then
 * verify it. For a Vercel deployment.
 *
 *   npm run db:push-remote
 *
 * WHY NO TURSO CLI
 * ----------------
 * The obvious route is the Turso CLI (`turso db create`, `turso db tokens
 * create`), but as of turso-cli v1.0.32 the published binaries are
 * macOS/Linux only — there is no Windows build, and the docs tell Windows users
 * to install WSL first. The `turso_cli-installer.ps1` in the *other* repo
 * (tursodatabase/turso) installs `tursodb.exe`, which is the embedded database,
 * not the cloud CLI: it has no `db create` subcommand at all.
 *
 * The browser dashboard gives you both values directly, so this script takes
 * them as input and does the rest. No install, no WSL, no PATH games.
 *
 * Get the two values from https://app.turso.co :
 *   1. Create a database            -> copy the libsql:// URL
 *   2. Settings -> API Tokens -> Create -> copy the token (shown once)
 *
 * Values may also be supplied up front to skip the prompts:
 *   PowerShell:
 *     $env:DATABASE_URL="libsql://..."; $env:DATABASE_AUTH_TOKEN="..."
 *     npm run db:push-remote
 */

import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createInterface } from 'node:readline'

const IS_WINDOWS = process.platform === 'win32'

/**
 * `npx` is `npx.cmd` on Windows, and Node refuses to spawn a `.cmd`/`.bat`
 * without a shell (EINVAL) since the CVE-2024-27980 hardening. So on Windows we
 * must pass shell:true. Safe here: the database URL and token travel through
 * `env`, never on the command line, and no argument contains shell metacharacters.
 */
const NPX = IS_WINDOWS ? 'npx.cmd' : 'npx'

/** A fresh HMAC key for the session cookie, so the block is pure copy-paste. */
function randomSecret(): string {
  return randomBytes(48).toString('hex')
}

function run(cmd: string, args: string[], env: Record<string, string>): { code: number; out: string } {  const r = spawnSync(cmd, args, {
    encoding: 'utf8',
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: IS_WINDOWS,
  })
  let out = `${r.stdout ?? ''}${r.stderr ?? ''}`
  if (r.error) out += `\nspawn error: ${r.error.message}`
  return { code: r.status ?? 1, out }
}

const URL_RE = /^libsql:\/\/[^\s]+$/

function ask(question: string, fallback = ''): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim() || fallback)
    })
  })
}

let step = 0
const h = (s: string) => console.log(`\n\x1b[1m[${++step}] ${s}\x1b[0m`)
const ok = (s: string) => console.log(`    \x1b[32mOK\x1b[0m  ${s}`)
const bad = (s: string) => console.log(`    \x1b[31m!!\x1b[0m  ${s}`)

async function main() {
  console.log(`
\x1b[1mGigSetu -> remote database setup\x1b[0m
Pushes the schema and demo data to a libSQL/Turso database for Vercel.

If you do not have one yet, create it at https://app.turso.co
  1. "Create database"        -> gives you a libsql:// URL
  2. Settings -> API Tokens   -> "Create Token" (value shown once)
`)

  h('Database URL')
  let url = process.env.DATABASE_URL?.trim() ?? ''
  if (!url) url = await ask('    Paste the libsql:// URL: ')
  if (!URL_RE.test(url)) {
    bad(`"${url}" is not a libsql:// URL.`)
    console.log('    It must look like:  libsql://gigsetu-yourname.turso.io')
    console.log('    Copy it from https://app.turso.co — a file:// or postgres:// URL will not work here.')
    process.exit(1)
  }
  ok(url)

  h('Auth token')
  let token = process.env.DATABASE_AUTH_TOKEN?.trim() ?? ''
  if (!token) token = await ask('    Paste the token: ')
  if (token.length < 20) {
    bad('that token looks too short — copy the whole value.')
    process.exit(1)
  }
  ok(`token received (${token.length} chars)`)

  const env: Record<string, string> = { DATABASE_URL: url, DATABASE_AUTH_TOKEN: token }

  h('Checking the connection')
  // Connectivity ONLY at this point. A brand-new database has no tables yet, so
  // demanding a seeded dataset here would fail on exactly the database that
  // most needs initialising.
  const pre = run(NPX, ['tsx', 'scripts/verify-remote-db.ts', '--connect'], env)
  for (const line of pre.out.split('\n').filter(Boolean)) console.log(`    ${line}`)
  // Fail CLOSED. Empty output means the check never ran (a spawn failure looks
  // identical to success if you only test for the absence of an error string).
  if (!pre.out.trim()) {
    bad('the connection check produced no output - it did not actually run.')
    console.log(`    exit=${pre.code}  command: ${NPX} tsx scripts/verify-remote-db.ts --connect`)
    process.exit(1)
  }
  if (/REMOTE DB FAIL/.test(pre.out)) {
    bad('cannot reach the database - fix the above before continuing.')
    process.exit(1)
  }
  if (!/REMOTE DB CONNECTED/.test(pre.out)) {
    bad('the connection check did not report success.')
    process.exit(1)
  }
  ok('reachable and authenticated')

  h('Pushing the schema')
  // `prisma db push` cannot target a libsql:// URL — the CLI rejects it during
  // config validation (P1012) because the driver adapter is a runtime-only
  // concern. So generate the DDL locally and execute it over the wire instead.
  const push = run(NPX, ['tsx', 'scripts/push-schema-remote.ts'], env)
  for (const line of push.out.split('\n').filter(Boolean)) {
    // The applier is verbose about each table; keep the summary lines only.
    if (/^\s{2}\+ /.test(line)) continue
    console.log(`    ${line}`)
  }
  if (push.code !== 0 || !/SCHEMA PUSH OK/.test(push.out)) {
    bad('schema push failed (see above).')
    process.exit(1)
  }

  h('Seeding the demo dataset')
  const seed = run(NPX, ['tsx', 'prisma/seed.ts'], env)
  if (seed.code !== 0) {
    bad('seed failed:')
    console.log(seed.out)
    process.exit(1)
  }
  ok('seeded (9 demo personas, workers, cooperatives, matching + pricing data)')

  h('Verifying')
  const probe = run(NPX, ['tsx', 'scripts/verify-remote-db.ts'], env)
  for (const line of probe.out.split('\n').filter(Boolean)) console.log(`    ${line}`)
  if (!/REMOTE DB OK/.test(probe.out)) {
    bad('the database is reachable but not correctly seeded - see above.')
    process.exit(1)
  }

  console.log(`
\x1b[1;32m===========================================================\x1b[0m
\x1b[1m  Paste into Vercel -> Settings -> Environment Variables\x1b[0m
\x1b[1;32m===========================================================\x1b[0m

Type = \x1b[1mSecret\x1b[0m for each. Enable Production + Preview + Development.
Paste the value only — no quotes, no trailing spaces.

  DATABASE_URL
${url}

  DATABASE_AUTH_TOKEN
${token}

  AUTH_SECRET
${randomSecret()}

Then \x1b[1mREDEPLOY\x1b[0m — adding environment variables does not rebuild the app.

Check it afterwards:

  curl -i https://YOUR-APP.vercel.app/api/health

Expect HTTP 200 and "status":"healthy".
`)
}

main()
