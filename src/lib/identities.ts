import 'server-only'

// Demo identity resolution (spec §5 — role-based auth with mock login accounts).
// Each of the nine roles maps to a real seeded record so every surface shows
// coherent data. Kept out of the route files so both /api/auth and /api/session
// share one source of truth.

import { db } from '@/lib/db'
import type { SessionUser } from '@/lib/session'
import type { Role } from '@/lib/types'

export async function resolveDemoIdentity(role: Role): Promise<SessionUser | null> {
  if (role === 'CUSTOMER') {
    const c = await db.customer.findFirst({ where: { name: 'Anita Deshmukh' } })
    return c
      ? { id: c.id, name: c.name, role, title: `Household customer · ${c.area}, ${c.city}`, customerId: c.id, orgName: 'Household' }
      : null
  }
  if (role === 'INSTITUTION') {
    const c = await db.customer.findFirst({ where: { type: 'HOSTEL' }, orderBy: { name: 'desc' } })
    return c ? { id: c.id, name: c.name, role, title: `Institutional customer · ${c.type}`, customerId: c.id, orgName: c.name } : null
  }
  if (role === 'WORKER') {
    // Two demo workers are named "Rajesh Kumar" (electrician @ Pune Electrical,
    // plumber @ Haveli Plumbing). The worker demo identity is the electrician.
    const w = await db.worker.findFirst({
      where: { name: 'Rajesh Kumar', primarySkill: 'electrician' },
      include: { cooperative: true },
    })
    return w
      ? {
          id: w.id,
          name: w.name,
          role,
          title: 'Electrician · Skill Passport verified',
          workerId: w.id,
          orgId: w.cooperativeId,
          cooperativeId: w.cooperativeId,
          orgName: w.cooperative.name,
        }
      : null
  }
  if (role === 'COOP_ADMIN') {
    const k = await db.cooperative.findFirst({ where: { featured: true } })
    return k ? { id: k.id, name: k.repName, role, title: `Secretary · ${k.name}`, orgId: k.id, cooperativeId: k.id, orgName: k.name } : null
  }
  if (role === 'TALUKA_COORD') {
    const t = await db.taluka.findFirst({ where: { name: 'Haveli' } })
    return t ? { id: t.id, name: t.coordinator, role, title: `Taluka Coordinator · ${t.name}`, talukaId: t.id, orgName: `${t.name} Taluka Network` } : null
  }
  if (role === 'DISTRICT_COORD') {
    const d = await db.district.findFirst({ where: { name: 'Pune' } })
    return d ? { id: d.id, name: d.coordinator, role, title: `District Coordinator · ${d.name}`, districtId: d.id, orgName: `${d.name} District Cooperative Network` } : null
  }
  if (role === 'STATE_ADMIN') {
    const f = await db.federation.findFirst({ where: { type: 'STATE' } })
    return f ? { id: f.id, name: f.chairperson, role, title: `State Federation Admin · ${f.region}`, federationId: f.id, orgName: f.name } : null
  }
  if (role === 'NATIONAL_ADMIN') {
    const f = await db.federation.findFirst({ where: { type: 'NATIONAL' } })
    return f ? { id: f.id, name: f.chairperson, role, title: 'National Apex Admin', federationId: f.id, orgName: f.name } : null
  }
  // PLATFORM_ADMIN
  return { id: 'platform-admin', name: 'GigSetu Ops', role, title: 'System / Platform Admin', orgName: 'GigSetu Platform' }
}

/** Governance rank — a higher rank satisfies a lower requirement. */
export const ROLE_RANK: Record<Role, number> = {
  CUSTOMER: 0,
  INSTITUTION: 0,
  WORKER: 1,
  COOP_ADMIN: 2,
  TALUKA_COORD: 3,
  DISTRICT_COORD: 4,
  STATE_ADMIN: 5,
  NATIONAL_ADMIN: 6,
  PLATFORM_ADMIN: 7,
}

const customerish = (r: Role) => r === 'CUSTOMER' || r === 'INSTITUTION'

/**
 * Which role switches the demo role switcher is allowed to assume.
 * PLATFORM_ADMIN can become anyone (that is the point of the console);
 * anyone may return to their own role; a governance admin may drop to a lower
 * governance tier. Customer/worker personas are never interchangeable.
 */
export function canSwitchRole(from: Role, own: Role, to: Role): boolean {
  if (to === own) return true
  if (from === 'PLATFORM_ADMIN') return true
  if (customerish(from) || customerish(to)) return customerish(from) && customerish(to)
  return ROLE_RANK[to] <= ROLE_RANK[from]
}
