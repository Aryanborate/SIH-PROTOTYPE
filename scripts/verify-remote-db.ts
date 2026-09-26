/**
 * Checks a remote (libSQL/Turso) database.
 *
 *   npx tsx scripts/verify-remote-db.ts              # connectivity + schema + data
 *   npx tsx scripts/verify-remote-db.ts --connect    # connectivity only
 *
 * Two modes because "is it reachable?" and "is it seeded?" are different
 * questions with different answers on a brand-new database:
 *
 *   a fresh database connects fine (SELECT 1 works) but has no tables yet, so a
 *   single combined check reports failure on exactly the database you most need
 *   to initialise. --connect is what the setup script uses BEFORE pushing the
 *   schema; the full check runs afterwards.
 *
 * Output markers (parsed by setup-remote-db.ts):
 *   REMOTE DB CONNECTED  reachable          (implies auth is valid)
 *   REMOTE DB OK         reachable + schema + seeded
 *   REMOTE DB EMPTY      reachable, schema present, no data yet
 *   REMOTE DB FAIL       not usable
 */
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { PrismaClient } from '@prisma/client'

const CONNECT_ONLY = process.argv.includes('--connect')

/** Prisma P2021 / SQLite "no such table" — the schema has not been pushed. */
function isMissingSchema(e: unknown): boolean {
  const raw = e instanceof Error ? e.message : String(e)
  const code = (e as { code?: string })?.code ?? ''
  return (
    code === 'P2021' ||
    /no such table/i.test(raw) ||
    /does not exist in the database|table .* does not exist/i.test(raw) ||
    P_MISSING.test(raw)
  )
}
const P_MISSING = /The table `.*` does not exist/

function describe(raw: string): string {
  const driver = raw.match(/Message:\s*`?([^`\n]+)`?/)?.[1]?.trim()
  return driver ?? raw.split('\n').map((s) => s.trim()).find(Boolean) ?? 'unknown error'
}

async function main() {
  const url = process.env.DATABASE_URL?.trim() ?? ''
  const token = process.env.DATABASE_AUTH_TOKEN?.trim() ?? ''

  if (!url) {
    console.log('REMOTE DB FAIL  DATABASE_URL is not set')
    process.exitCode = 1
    return
  }
  if (!token) {
    console.log('REMOTE DB FAIL  DATABASE_AUTH_TOKEN is not set')
    process.exitCode = 1
    return
  }
  if (!/^libsql:\/\//.test(url)) {
    console.log(`REMOTE DB FAIL  DATABASE_URL is not a libsql:// URL (got scheme "${url.split(':')[0]}")`)
    process.exitCode = 1
    return
  }

  const db = new PrismaClient({ adapter: new PrismaLibSQL({ url, authToken: token }) })
  const host = url.replace(/:\/\/([^.]+)\..*/, '://$1...')

  try {
    // 1. Can we reach it at all? This also proves the token authenticates.
    await db.$queryRaw`SELECT 1`
    console.log(`REMOTE DB CONNECTED  ${host}`)

    if (CONNECT_ONLY) return

    // 2. Does the schema exist?
    try {
      const [categories, workers, coops, customers, states] = await Promise.all([
        db.serviceCategory.count(),
        db.worker.count(),
        db.cooperative.count(),
        db.customer.count(),
        db.federation.count(),
      ])
      console.log(
        `REMOTE DB OK         seeded: ${workers} workers, ${coops} cooperatives, ${customers} customers, ${categories} categories, ${states} federations`
      )

      if (categories === 0 || workers === 0) {
        console.log('REMOTE DB EMPTY      schema exists but the dataset is EMPTY - run `npm run db:seed`')
        process.exitCode = 1
        return
      }

      // The persona the landing page resolves on the first button click.
      const rajesh = await db.worker.findFirst({ where: { name: 'Rajesh Kumar', primarySkill: 'plumber' } })
      if (rajesh) {
        console.log(`REMOTE DB OK         demo persona present: plumber "Rajesh Kumar" (${rajesh.id})`)
      } else {
        console.log('REMOTE DB EMPTY      plumber "Rajesh Kumar" not found - the seed may be partial')
        process.exitCode = 1
      }
    } catch (e) {
      if (isMissingSchema(e)) {
        // Expected on a database that has not been initialised yet. Not an
        // error as long as the caller knows to push the schema next.
        console.log('REMOTE DB UNINITIALISED  reachable, but the schema is not pushed yet (no tables).')
        console.log('REMOTE DB UNINITIALISED  -> run `npm run db:push-remote` to create the schema and seed it.')
        process.exitCode = 1
        return
      }
      throw e
    }
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e)
    const status = raw.match(/HTTP status (\d{3})/)?.[1]
    console.log(`REMOTE DB FAIL  ${describe(raw)}`)
    if (status === '404') {
      console.log('REMOTE DB FAIL  -> the database in DATABASE_URL does not exist. Create it at app.turso.co and re-run `npm run db:push-remote`.')
    } else if (status === '401' || status === '403' || /auth|token|credential|signature/i.test(raw)) {
      console.log('REMOTE DB FAIL  -> the token is wrong or lacks access. Copy DATABASE_AUTH_TOKEN exactly (no quotes, no spaces).')
    } else {
      console.log('REMOTE DB FAIL  -> re-run `npm run db:push-remote`.')
    }
    process.exitCode = 1
  } finally {
    await db.$disconnect()
  }
}

main()
