import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { guard, ok } from '@/lib/http'

export const dynamic = 'force-dynamic'

const Query = z.object({
  skill: z.string().max(40).optional(),
  coopId: z.string().max(60).optional(),
  area: z.string().max(120).optional(),
  take: z.coerce.number().int().min(1).max(200).default(60),
})

/**
 * Spec §61 — GET /workers
 * A single plural, filterable worker directory (the singular `/api/worker`
 * route stays for the worker app's own sections).
 */
export async function GET(req: NextRequest) {
  return guard(async () => {
    const sp = req.nextUrl.searchParams
    const parsed = Query.safeParse({
      skill: sp.get('skill') ?? undefined,
      coopId: sp.get('coopId') ?? undefined,
      area: sp.get('area') ?? undefined,
      take: sp.get('take') ?? undefined,
    })
    if (!parsed.success) return ok({ workers: [], total: 0 })
    const { skill, coopId, area, take } = parsed.data

    const where: Record<string, unknown> = {}
    if (skill) where.primarySkill = skill
    if (coopId) where.cooperativeId = coopId
    if (area) where.serviceAreas = { contains: area }
    if (sp.get('available') === '1') where.availability = 'AVAILABLE'
    if (sp.get('certified') === '1') where.certStatus = { in: ['VERIFIED', 'EXPIRING'] }

    const [rows, total] = await Promise.all([
      db.worker.findMany({
        where,
        include: { cooperative: { select: { id: true, name: true, sector: true } } },
        orderBy: [{ availability: 'asc' }, { rating: 'desc' }],
        take,
      }),
      db.worker.count({ where }),
    ])
    return ok({
      total,
      workers: rows.map((w) => ({
        id: w.id,
        name: w.name,
        primarySkill: w.primarySkill,
        experienceYears: w.experienceYears,
        certStatus: w.certStatus,
        certName: w.certName,
        rating: w.rating,
        completedJobs: w.completedJobs,
        availability: w.availability,
        emergencyPool: w.emergencyPool,
        baseArea: w.baseArea,
        cooperative: w.cooperative,
      })),
    })
  })
}
