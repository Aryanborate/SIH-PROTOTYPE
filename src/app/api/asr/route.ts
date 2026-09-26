import { NextRequest } from 'next/server'
import { z } from 'zod'
import ZAI from 'z-ai-web-dev-sdk'
import { badRequest, callerKey, guard, ok, rateLimit, readJson, requireAnyRole } from '@/lib/http'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Spec §7 step 3 — voice input for the booking description.
 *
 * SECURITY: this was an unauthenticated, UNMETERED, UNBOUNDED relay to a billed
 * third-party API — base64 inflates payloads by ~33%, so a modest request body
 * became hundreds of MB in memory, with no rate limit anywhere in the app. It is
 * now authenticated, size-capped, rate-limited and returns a safe error.
 */
const MAX_BASE64_CHARS = 4_000_000 // ~3 MB of audio

const BodySchema = z.object({
  audio: z.string().min(16).max(MAX_BASE64_CHARS),
  lang: z.enum(['en', 'mr', 'hi']).optional(),
})

export async function POST(req: NextRequest) {
  return guard(async () => {
    const auth = await requireAnyRole(['CUSTOMER', 'INSTITUTION', 'WORKER', 'COOP_ADMIN', 'PLATFORM_ADMIN'])
    if (!auth.ok) return auth.res
    const limited = rateLimit(callerKey(req, 'asr'), 20, 60_000)
    if (limited) return limited

    const parsed = await readJson(req, BodySchema)
    if (!parsed.ok) return parsed.res

    try {
      const zai = await ZAI.create()
      const res = await zai.audio.asr.create({ file_base64: parsed.data.audio })
      return ok({ text: res.text ?? '', lang: parsed.data.lang ?? 'en' })
    } catch {
      // Spec §67: voice input degrades to typed input rather than breaking the flow.
      return badRequest('Voice transcription is unavailable right now. Please type the problem instead.')
    }
  })
}
