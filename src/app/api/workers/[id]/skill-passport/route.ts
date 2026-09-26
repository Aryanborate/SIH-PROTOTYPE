import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getWorkerTrust } from '@/lib/trust'
import { guard, notFound, ok, safeArray, safeObject } from '@/lib/http'

export const dynamic = 'force-dynamic'

/**
 * Spec §61 — GET /workers/:id/skill-passport
 * Spec §19 — Digital Skill Passport. Spec §20 — portable professional identity:
 * the record is designed to follow the worker across participating cooperatives
 * with consent and applicable data-sharing rules, and deliberately EXCLUDES
 * sensitive personal data (no Aadhaar, no bank details, no home address).
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return guard(async () => {
    const { id } = await ctx.params
    const w = await db.worker.findUnique({
      where: { id },
      include: {
        cooperative: { include: { taluka: { include: { district: true } } } },
        bookings: { where: { rating: { not: null } }, orderBy: { scheduledAt: 'desc' }, take: 10, select: { rating: true, review: true, ratingJson: true } },
      },
    })
    if (!w) return notFound('Worker not found.')

    const trainings = await db.trainingEnrollment.findMany({ where: { workerId: id }, include: { course: true } })
    const trust = await getWorkerTrust(id)
    const factorAvg: Record<string, number[]> = {}
    w.bookings.forEach((b) => {
      const f = safeObject<Record<string, number>>(b.ratingJson)
      for (const [k, v] of Object.entries(f)) {
        if (typeof v === 'number') factorAvg[k] = factorAvg[k] ?? []
        factorAvg[k].push(v)
      }
    })

    return ok({
      workerId: w.id,
      name: w.name,
      cooperative: {
        id: w.cooperative.id,
        name: w.cooperative.name,
        regNo: w.cooperative.regNo,
        societyType: w.cooperative.societyType,
        taluka: w.cooperative.taluka.name,
        district: w.cooperative.taluka.district.name,
        state: w.cooperative.taluka.district.federationId ? 'Maharashtra' : null,
      },
      primarySkill: w.primarySkill,
      secondarySkills: safeArray<string>(w.secondarySkills),
      skills: safeArray<string>(w.skillsJson),
      experienceYears: w.experienceYears,
      certifications: { name: w.certName, status: w.certStatus, expiry: w.certExpiry },
      safetyTraining: { valid: w.safetyValid, label: w.safetyValid ? 'VALID' : 'LAPSED' },
      training: trainings.map((t) => ({
        course: t.course.title,
        certification: t.course.certification,
        progress: t.progress,
        status: t.status,
      })),
      languages: safeArray<string>(w.languages),
      serviceAreas: safeArray<string>(w.serviceAreas),
      completedJobs: w.completedJobs,
      rating: w.rating,
      completionRate: w.completionRate,
      ratingFactors: Object.fromEntries(
        Object.entries(factorAvg).map(([k, arr]) => [k, Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) / 100]),
      ),
      recentReviews: w.bookings.map((b) => ({ rating: b.rating, review: b.review })),
      openComplaints: trust?.complaintsOpen ?? 0,
      portability: {
        note: 'Portable professional record — follows the worker across participating cooperatives with worker consent and applicable data-sharing rules. Sensitive personal data is never exposed.',
        portableFields: ['Skills', 'Certifications', 'Training', 'Completed jobs', 'Work history', 'Welfare status'],
        excludedFields: ['Government identifiers', 'Bank or payment details', 'Home address', 'Family information'],
      },
      note: 'Prototype Data — synthetic identity. Designed for authorized integration with skill/certification registries.',
    })
  })
}
