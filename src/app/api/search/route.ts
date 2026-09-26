import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { serverError } from '@/lib/http'

export const dynamic = 'force-dynamic'

/**
 * Phase 6 #45 — Global search across the cooperative network.
 * GET /api/search?q=…  → grouped results with client nav hints.
 *
 * SQLite LIKE via Prisma `contains` is case-insensitive for ASCII.
 * Every result carries a `nav` hint the client translates into view
 * switches (drill-down / booking deep-link) through the app store.
 */

interface Nav {
  view?: string
  focusIds?: { district?: string; taluka?: string; coop?: string }
  bookingRef?: string
  workerTab?: string
}

export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
    if (q.length < 2) return NextResponse.json({ ok: true, q, groups: [] })

    const [workers, coops, federations, services, bookings, districts, talukas, institutions] = await Promise.all([
      db.worker.findMany({
        where: { OR: [{ name: { contains: q } }, { primarySkill: { contains: q } }, { certName: { contains: q } }] },
        include: { cooperative: { select: { name: true } } },
        take: 5,
        orderBy: { rating: 'desc' },
      }),
      db.cooperative.findMany({
        where: { OR: [{ name: { contains: q } }, { sector: { contains: q } }] },
        take: 5,
        orderBy: { workerCount: 'desc' },
      }),
      db.federation.findMany({ where: { OR: [{ name: { contains: q } }, { region: { contains: q } }] }, take: 4 }),
      db.serviceCategory.findMany({
        where: { OR: [{ nameEn: { contains: q } }, { nameMr: { contains: q } }, { nameHi: { contains: q } }, { key: { contains: q } }, { descEn: { contains: q } }] },
        take: 5,
      }),
      db.booking.findMany({
        where: { OR: [{ refCode: { contains: q } }, { title: { contains: q } }, { area: { contains: q } }] },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: { id: true, refCode: true, title: true, status: true, area: true, urgency: true },
      }),
      db.district.findMany({ where: { name: { contains: q } }, take: 4 }),
      db.taluka.findMany({ where: { name: { contains: q } }, take: 4 }),
      db.customer.findMany({
        where: { AND: [{ type: { in: ['SOCIETY', 'SCHOOL', 'HOSPITAL', 'HOSTEL', 'BUSINESS', 'GOVT'] } }, { OR: [{ name: { contains: q } }, { area: { contains: q } }] }] },
        take: 4,
      }),
    ])

    const groups: Array<{ type: string; label: string; results: Array<{ id: string; type: string; title: string; subtitle: string; nav: Nav }> }> = []

    if (workers.length)
      groups.push({
        type: 'worker',
        label: 'Workers',
        results: workers.map((w) => ({
          id: w.id,
          type: 'worker',
          title: w.name,
          subtitle: `${w.primarySkill} · ${w.cooperative.name} · ★ ${w.rating.toFixed(2)}`,
          nav: { view: 'coop', focusIds: { coop: w.cooperativeId }, workerTab: 'home' },
        })),
      })

    if (coops.length)
      groups.push({
        type: 'cooperative',
        label: 'Cooperatives',
        results: coops.map((c) => ({
          id: c.id,
          type: 'cooperative',
          title: c.name,
          subtitle: `${c.sector} · ${c.workerCount} workers`,
          nav: { view: 'coop', focusIds: { coop: c.id } },
        })),
      })

    if (federations.length)
      groups.push({
        type: 'federation',
        label: 'Federations',
        results: federations.map((f) => ({
          id: f.id,
          type: 'federation',
          title: f.name,
          subtitle: `${f.type} federation · ${f.region}`,
          nav: { view: f.type === 'NATIONAL' ? 'national' : 'state' },
        })),
      })

    if (services.length)
      groups.push({
        type: 'service',
        label: 'Services',
        results: services.map((s) => ({
          id: s.id,
          type: 'service',
          title: s.nameEn,
          subtitle: `${s.descEn.slice(0, 70)} · from ₹${s.baseRate}`,
          nav: { view: 'customer' },
        })),
      })

    if (bookings.length)
      groups.push({
        type: 'booking',
        label: 'Bookings',
        results: bookings.map((b) => ({
          id: b.id,
          type: 'booking',
          title: `${b.refCode} — ${b.title}`,
          subtitle: `${b.status} · ${b.area}${b.urgency !== 'NORMAL' ? ` · ${b.urgency}` : ''}`,
          nav: { bookingRef: b.refCode },
        })),
      })

    if (districts.length)
      groups.push({
        type: 'district',
        label: 'Districts',
        results: districts.map((d) => ({
          id: d.id,
          type: 'district',
          title: d.name,
          subtitle: `District network · ${d.workers.toLocaleString('en-IN')} workers · ${d.utilizationPct}% utilization`,
          nav: { view: 'district', focusIds: { district: d.id } },
        })),
      })

    if (talukas.length)
      groups.push({
        type: 'taluka',
        label: 'Talukas',
        results: talukas.map((tl) => ({
          id: tl.id,
          type: 'taluka',
          title: tl.name,
          subtitle: `Taluka network · ${tl.workers.toLocaleString('en-IN')} workers · ${tl.availableWorkers} available`,
          nav: { view: 'taluka', focusIds: { taluka: tl.id } },
        })),
      })

    if (institutions.length)
      groups.push({
        type: 'institution',
        label: 'Institutions',
        results: institutions.map((c) => ({
          id: c.id,
          type: 'institution',
          title: c.name,
          subtitle: `${c.type} · ${c.area}, ${c.city}`,
          nav: { view: 'customer' },
        })),
      })

    return NextResponse.json({ ok: true, q, groups })
  } catch (e) {
    return serverError(e)
  }
}
