import { NextRequest } from 'next/server'
import { buildSkillGap } from '@/lib/skill-gap'
import { guard, ok } from '@/lib/http'

export const dynamic = 'force-dynamic'

/** Spec §61 — GET /skill-gaps. Spec §29 — AI Skill Gap Analysis. */
export async function GET(req: NextRequest) {
  return guard(async () => ok(await buildSkillGap((req.nextUrl.searchParams.get('district') ?? 'Pune').slice(0, 80))))
}
