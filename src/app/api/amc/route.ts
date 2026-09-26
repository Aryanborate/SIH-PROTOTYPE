import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { badRequest, guard, ok, requireAnyRole, safeArray } from '@/lib/http'

export const dynamic = 'force-dynamic'

/** Spec -33 - AMC / maintenance contract dashboard (institution or cooperative). */
export async function GET(req: NextRequest) {
  return guard(async () => {
    const auth = await requireAnyRole(['CUSTOMER', 'INSTITUTION', 'COOP_ADMIN', 'PLATFORM_ADMIN'])
    if (!auth.ok) return auth.res
    const customerId = req.nextUrl.searchParams.get('customerId')
    const coopId = req.nextUrl.searchParams.get('coopId')
    if (!customerId && !coopId) return badRequest('customerId or coopId required')

    // IDOR guard: contract values are commercially sensitive.
    if ((auth.user.role === 'CUSTOMER' || auth.user.role === 'INSTITUTION') && customerId && customerId !== auth.user.customerId) {
      return badRequest('You can only view your own contracts.')
    }
    if (auth.user.role === 'COOP_ADMIN' && coopId && auth.user.cooperativeId !== coopId) {
      return badRequest('You can only view your own cooperative contracts.')
    }

    const contracts = await db.amcContract.findMany({
      where: customerId ? { customerId } : { cooperativeId: coopId! },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    const coopIds = [...new Set(contracts.map((c) => c.cooperativeId))]
    const coops = await db.cooperative.findMany({ where: { id: { in: coopIds } }, select: { id: true, name: true, repName: true, emergencyPoolSize: true } })
    const coopMap = new Map(coops.map((c) => [c.id, c]))

    const data = contracts.map((c) => ({
      id: c.id,
      title: c.title,
      propertyType: c.propertyType,
      units: c.units,
      services: safeArray(c.servicesJson),
      status: c.status,
      startDate: c.startDate,
      endDate: c.endDate,
      monthlyFeeRs: c.monthlyFeeRs,
      slaHours: c.slaHours,
      slaMetPct: c.slaMetPct,
      monthlyRequests: c.monthlyRequests,
      completedJobs: c.completedJobs,
      pendingJobs: c.pendingJobs,
      workers: safeArray(c.workersJson),
      cooperative: coopMap.get(c.cooperativeId) ?? null,
    }))
    return ok({ contracts: data, note: 'Cooperative maintenance contracts - prototype data, designed for authorized integration.' })
  })
}