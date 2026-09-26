import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getWorkerTrust } from '@/lib/trust'
import { guard, notFound, ok, safeArray } from '@/lib/http'

export const dynamic = 'force-dynamic'

/**
 * Spec §61 — GET /workers/:id  and  GET /workers/:id/skill-passport
 * Spec §19/#20 — the Digital Skill Passport and the portable identity record.
 */
async function load(id: string) {
  return db.worker.findUnique({
    where: { id },
    include: { cooperative: { include: { taluka: { include: { district: true } } } } },
  })
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const { id } = await ctx.params
    const w = await load(id)
    if (!w) return notFound('Worker not found.')
    return ok({
      worker: {
        id: w.id,
        name: w.name,
        primarySkill: w.primarySkill,
        secondarySkills: safeArray<string>(w.secondarySkills),
        experienceYears: w.experienceYears,
        certName: w.certName,
        certStatus: w.certStatus,
        certExpiry: w.certExpiry,
        languages: safeArray<string>(w.languages),
        serviceAreas: safeArray<string>(w.serviceAreas),
        completedJobs: w.completedJobs,
        rating: w.rating,
        completionRate: w.completionRate,
        safetyValid: w.safetyValid,
        availability: w.availability,
        emergencyPool: w.emergencyPool,
        bioEn: w.bioEn,
        cooperative: {
          id: w.cooperative.id,
          name: w.cooperative.name,
          regNo: w.cooperative.regNo,
          societyType: w.cooperative.societyType,
          taluka: w.cooperative.taluka.name,
          district: w.cooperative.taluka.district.name,
        },
      },
    })
  })
}
