/**
 * Confirms a remote (libSQL/Turso) database is reachable AND correctly seeded.
 * Run via `npm run db:push-remote`, or directly:
 *
 *   DATABASE_URL=libsql://... DATABASE_AUTH_TOKEN=... npx tsx scripts/verify-remote-db.ts
 */
import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { PrismaClient } from '@prisma/client'

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

  try {
    await db.$queryRaw`SELECT 1`
    console.log(`REMOTE DB OK    connected -> ${url.replace(/\/\/([^.]+)\..*/, '//$1…')}`)

    const [categories, workers, coops, customers, states] = await Promise.all([
      db.serviceCategory.count(),
      db.worker.count(),
      db.cooperative.count(),
      db.customer.count(),
      db.federation.count(),
    ])

    console.log(`REMOTE DB OK    seeded: ${workers} workers, ${coops} cooperatives, ${customers} customers, ${categories} categories, ${states} federations`)

    if (categories === 0 || workers === 0) {
      console.log('REMOTE DB WARN  schema exists but the dataset is EMPTY — run `npm run db:seed` with these env vars set')
    } else {
      // The persona the landing page resolves on first click.
      const rajesh = await db.worker.findFirst({ where: { name: 'Rajesh Kumar', primarySkill: 'plumber' } })
      console.log(rajesh ? `REMOTE DB OK    demo persona present: plumber "Rajesh Kumar" (${rajesh.id})` : 'REMOTE DB WARN  plumber "Rajesh Kumar" not found — seed may be partial')
    }
  } catch (e) {
    // Prisma wraps driver errors, e.g.
    //   "Invalid `prisma.$queryRaw()` invocation: ... Message: `SERVER_ERROR:
    //    Server returned HTTP status 404`"
    // Pull the driver-level reason out so the failure is actionable, and
    // distinguish "database does not exist" from "token is wrong".
    const raw = e instanceof Error ? e.message : String(e)
    const driver = raw.match(/Message:\s*`?([^`\n]+)`?/)?.[1]?.trim()
    const status = raw.match(/HTTP status (\d{3})/)?.[1]
    const reason = driver ?? raw.split('\n').map((s) => s.trim()).find(Boolean) ?? 'unknown error'

    console.log(`REMOTE DB FAIL  ${reason}`)
    if (status === '404') {
      console.log('REMOTE DB FAIL  -> the database in DATABASE_URL does not exist. Run `npm run db:push-remote` and use the URL it prints.')
    } else if (status === '401' || status === '403' || /auth|token|credential/i.test(raw)) {
      console.log('REMOTE DB FAIL  -> the token is wrong or lacks access. Run `npm run db:push-remote` and copy DATABASE_AUTH_TOKEN exactly (no quotes, no spaces).')
    } else {
      console.log('REMOTE DB FAIL  -> re-run `npm run db:push-remote` to recreate the database at app.turso.co and mint a fresh token.')
    }
    process.exitCode = 1
  } finally {
    await db.$disconnect()
  }
}

main()
