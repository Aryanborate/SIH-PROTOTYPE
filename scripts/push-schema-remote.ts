/**
 * Applies the Prisma schema to a remote libSQL/Turso database.
 *
 * WHY THIS EXISTS
 * ---------------
 * `prisma db push` cannot target a `libsql://` URL. The Prisma CLI only accepts
 * `file:` for the sqlite provider — the driver adapter that makes libSQL work is
 * a *runtime* concern, and the CLI rejects the URL during config validation
 * (P1012: "the URL must start with the protocol `file:`").
 *
 * libSQL speaks SQLite, so the CLI can still GENERATE the DDL locally and we
 * execute it over the wire instead:
 *
 *   prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
 *
 * That emits authoritative CREATE TABLE / CREATE INDEX statements which we run
 * against the remote database through the same driver the app uses. Idempotent:
 * existing tables are skipped, so re-running is safe.
 */
import { spawnSync } from 'node:child_process'
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { PrismaClient } from '@prisma/client'

const IS_WINDOWS = process.platform === 'win32'
const NPX = IS_WINDOWS ? 'npx.cmd' : 'npx'

function run(cmd: string, args: string[]): { code: number; out: string } {
  const r = spawnSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: IS_WINDOWS })
  return { code: r.status ?? 1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` }
}

/** Split a DDL script into individual statements, ignoring comments and string bodies. */
function splitStatements(sql: string): string[] {
  const out: string[] = []
  let cur = ''
  let inLine = false
  let inBlock = false
  let inStr: string | null = null

  for (let i = 0; i < sql.length; i++) {
    const c = sql[i]
    const n = sql[i + 1]

    if (inLine) {
      if (c === '\n') inLine = false
      cur += c
      continue
    }
    if (inBlock) {
      cur += c
      if (c === '*' && n === '/') {
        cur += n
        i++
        inBlock = false
      }
      continue
    }
    if (inStr) {
      cur += c
      if (c === inStr) inStr = null
      continue
    }
    if (c === '-' && n === '-') {
      inLine = true
      cur += c
      continue
    }
    if (c === '/' && n === '*') {
      inBlock = true
      cur += c
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      inStr = c
      cur += c
      continue
    }
    if (c === ';') {
      const stmt = cur.trim()
      if (stmt) out.push(stmt)
      cur = ''
      continue
    }
    cur += c
  }
  const tail = cur.trim()
  if (tail) out.push(tail)
  return out.map((s) => s.replace(/^(--[^\n]*\n)+/g, '').trim()).filter((s) => s && !/^(--|\/\*)/.test(s))
}

async function main() {
  const url = process.env.DATABASE_URL?.trim() ?? ''
  const token = process.env.DATABASE_AUTH_TOKEN?.trim() ?? ''
  if (!/^libsql:\/\//.test(url) || !token) {
    console.log('SCHEMA PUSH FAIL  needs DATABASE_URL (libsql://…) and DATABASE_AUTH_TOKEN')
    process.exitCode = 1
    return
  }

  // 1. Generate the DDL locally — the CLI is fine with the sqlite provider here
  //    because it never contacts a database, it only diffs the schema.
  const ddl = run(NPX, ['prisma', 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'])
  if (ddl.code !== 0 || !ddl.out.includes('CREATE')) {
    console.log('SCHEMA PUSH FAIL  could not generate DDL from prisma/schema.prisma')
    console.log(ddl.out)
    process.exitCode = 1
    return
  }
  const statements = splitStatements(ddl.out)
  console.log(`SCHEMA PUSH       generated ${statements.length} statements from prisma/schema.prisma`)

  // 2. Execute them over the wire.
  const db = new PrismaClient({ adapter: new PrismaLibSQL({ url, authToken: token }) })
  let created = 0
  let skipped = 0
  try {
    for (const stmt of statements) {
      const isCreate = /^CREATE\s+(TABLE|UNIQUE INDEX|INDEX)/i.test(stmt)
      const name = stmt.match(/^CREATE\s+(?:UNIQUE\s+)?(?:TABLE|INDEX)\s+(?:IF\s+NOT\s+EXISTS\s+)?["`\[]?([\w.]+)/i)?.[1]
      if (/^CREATE\s+INDEX/i.test(stmt) && !/^CREATE\s+UNIQUE/i.test(stmt)) {
        // plain indexes have no IF NOT EXISTS in Prisma's output; skip if present
      }
      try {
        await db.$executeRawUnsafe(stmt)
        created++
        if (isCreate) console.log(`  + ${stmt.slice(0, 60).replace(/\s+/g, ' ')}`)
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (/already exists/i.test(msg)) {
          skipped++
          continue
        }
        console.log(`SCHEMA PUSH FAIL  statement failed: ${stmt.slice(0, 90).replace(/\s+/g, ' ')}`)
        console.log(`                 ${msg.split('\n').find((l) => l.trim()) ?? msg}`)
        if (name) console.log(`                 object: ${name}`)
        process.exitCode = 1
        return
      }
    }
    console.log(`SCHEMA PUSH OK    ${created} applied, ${skipped} already existed`)
  } finally {
    await db.$disconnect()
  }
}

main()
