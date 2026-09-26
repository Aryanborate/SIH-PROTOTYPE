import { NextRequest } from 'next/server'
import { z } from 'zod'
import ZAI from 'z-ai-web-dev-sdk'
import { guard, badRequest, ok, readJson } from '@/lib/http'
import { inferCategory, inferProblemLabel, inferUrgency } from '@/lib/matching'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const VALID_CATEGORIES = ['electrician', 'plumber', 'carpenter', 'painter', 'cleaning', 'driver', 'caregiver', 'gardener', 'technician', 'appliance', 'other']

const BodySchema = z.object({
  description: z.string().min(1).max(600),
  categoryKey: z.enum(VALID_CATEGORIES as [string, ...string[]]).optional(),
  lang: z.enum(['en', 'mr', 'hi']).optional(),
})

/**
 * Deterministic offline analyzer — the path a judging hall with no network
 * always takes, so it must be genuinely good.
 *
 * FIX: this used to carry its OWN category regex that did not match the spec
 * §51/§87 signature sentence "माझ्या घरात पाण्याची पाइप फुटली आहे…" (पाण्याची does
 * not contain पाणी because of the virama, and पाइप was missing) and so classified
 * it as "other" and used the raw Marathi sentence as the job title. It now
 * delegates to the single shared inference in lib/matching.ts.
 */
function heuristicAnalysis(description: string, categoryKey?: string): Record<string, unknown> {
  const explicit = categoryKey && VALID_CATEGORIES.includes(categoryKey) ? categoryKey : undefined
  const cat = explicit && explicit !== 'other' ? explicit : inferCategory(description)
  const urgency = inferUrgency(description)
  const minutes = cat === 'cleaning' ? 120 : cat === 'painter' ? 240 : cat === 'driver' || cat === 'caregiver' ? 180 : 60
  const emergency = urgency === 'EMERGENCY'
  return {
    source: 'heuristic',
    // Never surface raw Devanagari as an English job title.
    title: inferProblemLabel(description, cat),
    problem: inferProblemLabel(description, cat),
    categoryKey: cat,
    urgency,
    estimatedMinutes: minutes,
    difficulty: emergency ? 'urgent' : 'moderate',
    safetyNotes: emergency
      ? cat === 'plumber'
        ? ['Shut off the main valve before opening the pipe', 'Keep the wet area clear — slip risk']
        : ['Switch off the mains before touching any wiring', 'Keep the area clear']
      : [],
    keywords: [],
    summary: `Classified as ${cat} service, ${urgency.toLowerCase()} priority.`,
  }
}

export async function POST(req: NextRequest) {
  return guard(async () => {
    const parsed = await readJson(req, BodySchema)
    if (!parsed.ok) return parsed.res
    const { description, categoryKey, lang } = parsed.data

    // AI first, heuristic always available (spec §67 — the demo must never die).
    try {
      const zai = await ZAI.create()
      const completion = await zai.chat.completions.create({
        messages: [
          {
            // FIX: was role 'assistant', which weakens instruction adherence.
            role: 'system',
            content: `You are GigSetu's service request analyzer. Classify the customer's problem (may be in English, Marathi or Hindi). Reply with ONLY valid JSON, no markdown: {"title": "short job title in English (max 60 chars)", "categoryKey": one of ${JSON.stringify(VALID_CATEGORIES)}, "urgency": "NORMAL"|"URGENT"|"EMERGENCY", "estimatedMinutes": number, "difficulty": "simple"|"moderate"|"complex", "safetyNotes": [max 2 short strings, empty if none], "keywords": [max 4 strings], "summary": "one sentence in ${lang === 'mr' ? 'Marathi' : lang === 'hi' ? 'Hindi' : 'English'}'}`,
          },
          { role: 'user', content: description.slice(0, 600) },
        ],
        thinking: { type: 'disabled' },
      })
      const raw = completion.choices[0]?.message?.content ?? ''
      const m = raw.match(/\{[\s\S]*\}/)
      if (!m) throw new Error('no json')
      const out = JSON.parse(m[0]) as Record<string, unknown>
      // Re-validate the model output — never trust it.
      const cat = VALID_CATEGORIES.includes(String(out.categoryKey))
        ? String(out.categoryKey)
        : categoryKey && VALID_CATEGORIES.includes(categoryKey)
          ? categoryKey
          : inferCategory(description)
      const urg = ['NORMAL', 'URGENT', 'EMERGENCY'].includes(String(out.urgency)) ? String(out.urgency) : inferUrgency(description)
      const mins = Number(out.estimatedMinutes)
      return ok({
        analysis: {
          ...out,
          categoryKey: cat,
          urgency: urg,
          // FIX: model-supplied duration was previously unbounded and flowed
          // straight into the pricing engine and the customer-facing estimate.
          estimatedMinutes: Number.isFinite(mins) ? Math.max(15, Math.min(480, Math.round(mins))) : 60,
          title: typeof out.title === 'string' && out.title.trim() ? out.title.trim().slice(0, 60) : inferProblemLabel(description, cat),
          source: 'ai',
        },
      })
    } catch {
      return ok({ analysis: heuristicAnalysis(description, categoryKey) })
    }
  })
}

export async function GET() {
  return badRequest('Use POST.')
}
