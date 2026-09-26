import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { guard, notFound, ok, safeObject } from '@/lib/http'

export const dynamic = 'force-dynamic'

/** Spec §61 — GET /cooperatives/:id (the full cooperative record, §4 fields). */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const { id } = await ctx.params
    const c = await db.cooperative.findUnique({
      where: { id },
      include: {
        taluka: { include: { district: { include: { federation: true } } } },
        registration: true,
        amcContracts: { take: 5, orderBy: { createdAt: 'desc' } },
        _count: { select: { workers: true } },
      },
    })
    if (!c) return notFound('Cooperative not found.')

    return ok({
      cooperative: {
        id: c.id,
        name: c.name,
        regNo: c.regNo,
        societyType: c.societyType,
        sector: c.sector,
        repName: c.repName,
        repRole: c.repRole,
        memberCount: c.memberCount,
        workerCount: c.workerCount,
        liveWorkerRows: c._count.workers,
        activeToday: c.activeToday,
        jobsToday: c.jobsToday,
        utilizationPct: c.utilizationPct,
        welfareFundRs: c.welfareFundRs,
        earningsMonthRs: c.earningsMonthRs,
        emergencyPoolSize: c.emergencyPoolSize,
        status: c.status,
        verification: c.verification,
        featured: c.featured,
        pricingPolicy: safeObject<Record<string, unknown>>(c.pricingPolicyJson),
      },
      location: {
        taluka: c.taluka.name,
        district: c.taluka.district.name,
        state: c.taluka.district.federation.region,
        federation: c.taluka.district.federation.name,
      },
      // Spec §4 — government / cooperative registration record.
      // ALWAYS labelled as an external, authorized-integration source.
      registration: c.registration
        ? {
            registrationNumber: c.registration.registrationNumber,
            registeredOn: c.registration.registeredOn,
            registeringAuthority: c.registration.registeringAuthority,
            state: c.registration.state,
            district: c.registration.district,
            taluka: c.registration.taluka,
            societyType: c.registration.societyType,
            authorizedRepresentative: c.registration.authorizedRepresentative,
            memberCount: c.registration.memberCount,
            workerCount: c.registration.workerCount,
            serviceCategories: safeObject<{ serviceCategories?: string[] }>(c.registration.serviceCategories).serviceCategories ?? [],
            operationalStatus: c.registration.operationalStatus,
            verificationStatus: c.registration.verificationStatus,
            sourceNote: c.registration.sourceNote,
          }
        : null,
      governmentRegistrationSource: 'External / Authorized Integration',
      integrationNote: 'Designed for authorized integration with relevant government cooperative databases. No live government feed is connected in this prototype.',
      amcContracts: c.amcContracts.map((a) => ({ id: a.id, title: a.title, status: a.status, units: a.units, monthlyFeeRs: a.monthlyFeeRs })),
    })
  })
}
