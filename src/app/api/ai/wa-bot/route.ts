import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { handleWaMessage, normalizeWaState } from '@/lib/wa-bot'
import { guard, ok, readJson, requireAnyRole, serverError } from '@/lib/http'
import { recordAudit } from '@/lib/audit'

export const dynamic = 'force-dynamic'

/**
 * SECURITY FIX: `state` used to be taken verbatim from the request body and
 * spread into the engine, so a caller could pre-seed `pendingSlot` and skip
 * every conversational guard — creating a booking for ANY customer with ANY
 * category/urgency/date, including an invalid date and a raw urgency string in a
 * plain DB column. The state is now allowlisted and the pendingSlot is rebuilt
 * server-side by the conversation machine only.
 */
const SlotSchema = z.object({
  categoryKey: z.string().max(40),
  title: z.string().max(160),
  description: z.string().max(600),
  area: z.string().max(120),
  address: z.string().max(300),
  scheduledAt: z.string().max(40),
  urgency: z.enum(['NORMAL', 'URGENT', 'EMERGENCY']),
})

const StateSchema = z.object({
  stage: z.enum(['new', 'awaiting_service', 'awaiting_problem', 'awaiting_location', 'awaiting_time', 'ready', 'done']),
  categoryKey: z.string().max(40).optional(),
  problem: z.string().max(600).optional(),
  area: z.string().max(120).optional(),
  dateWord: z.enum(['now', 'today', 'tomorrow']).optional(),
  slot: z.enum(['morning', 'afternoon', 'evening', 'night']).optional(),
  urgency: z.enum(['NORMAL', 'URGENT', 'EMERGENCY']).optional(),
  lastLang: z.enum(['en', 'mr', 'hi']).optional(),
  pendingSlot: SlotSchema.optional(),
})

const BodySchema = z.object({
  customerId: z.string().min(1).max(60),
  message: z.string().max(2000).optional(),
  lang: z.enum(['en', 'mr', 'hi']).optional(),
  state: StateSchema.optional(),
  confirm: z.boolean().optional(),
  quote: z.boolean().optional(),
  /** Only the SIH demo engine may flag a booking for RESET DEMO (#66). */
  demoScript: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  return guard(async () => {
    const auth = await requireAnyRole(['CUSTOMER', 'INSTITUTION', 'PLATFORM_ADMIN', 'COOP_ADMIN'])
    if (!auth.ok) return auth.res

    const parsed = await readJson(req, BodySchema)
    if (!parsed.ok) return parsed.res
    const b = parsed.data

    // A customer may only drive the bot for their own account.
    const customerId =
      auth.user.role === 'PLATFORM_ADMIN' || auth.user.role === 'COOP_ADMIN' ? b.customerId : (auth.user.customerId ?? b.customerId)
    if (customerId !== b.customerId && auth.user.role !== 'PLATFORM_ADMIN' && auth.user.role !== 'COOP_ADMIN') {
      return serverError(Object.assign(new Error('You can only use the booking assistant for your own account.'), { status: 403 }))
    }
    const customer = await db.customer.findUnique({ where: { id: customerId }, select: { id: true } })
    if (!customer) return serverError(Object.assign(new Error('Unknown customer.'), { status: 400 }))

    const state = normalizeWaState(b.state)
    const demoScript = auth.user.role === 'PLATFORM_ADMIN' && !!b.demoScript
    const result = await handleWaMessage({
      message: b.message ?? '',
      lang: b.lang ?? 'en',
      state,
      customerId,
      confirm: !!b.confirm,
      quote: !!b.quote,
      demoScript,
    })
    if (result.bookingId) {
      await recordAudit({
        action: 'BOOKING_CREATED',
        entity: 'Booking',
        entityId: result.bookingId,
        detail: `${result.bookingRef} created via the WhatsApp booking assistant (${b.lang ?? 'en'})`,
      })
    }
    return ok(result)
  })
}
