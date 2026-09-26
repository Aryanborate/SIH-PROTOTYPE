import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { badRequest, conflict, guard, notFound, ok, readJson, requireAnyRole } from '@/lib/http'

export const dynamic = 'force-dynamic'

// Customer address book — saved places for one-tap booking.
// Prototype scope: max 8 places per customer, single default.
const MAX_PLACES = 8

const PlaceSchema = z.object({
  customerId: z.string().min(1).max(60),
  label: z.string().min(1).max(40),
  area: z.string().min(1).max(60),
  address: z.string().min(3).max(160),
  isDefault: z.boolean().optional(),
})
const PatchSchema = z.object({ id: z.string().min(1).max(60), isDefault: z.boolean().optional() })

/**
 * SECURITY FIX: every method resolved ownership from a caller-supplied
 * `customerId`, which is not an authorization check — supplying another
 * customer's id let a caller read, overwrite or delete their saved address.
 * The owner is now taken from the signed session.
 */
function ownerId(user: { role: string; customerId?: string }, requested?: string): string | null {
  if (user.role === 'CUSTOMER' || user.role === 'INSTITUTION') return user.customerId ?? null
  if (user.role === 'PLATFORM_ADMIN' && requested) return requested
  return null
}

export async function GET(req: NextRequest) {
  return guard(async () => {
    const auth = await requireAnyRole(['CUSTOMER', 'INSTITUTION', 'PLATFORM_ADMIN'])
    if (!auth.ok) return auth.res
    const cid = ownerId(auth.user, req.nextUrl.searchParams.get('customerId') ?? undefined)
    if (!cid) return badRequest('No customer scope for this identity.')
    const places = await db.savedPlace.findMany({
      where: { customerId: cid },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      take: MAX_PLACES,
    })
    return ok({ places })
  })
}

export async function POST(req: NextRequest) {
  return guard(async () => {
    const auth = await requireAnyRole(['CUSTOMER', 'INSTITUTION', 'PLATFORM_ADMIN'])
    if (!auth.ok) return auth.res
    const parsed = await readJson(req, PlaceSchema)
    if (!parsed.ok) return parsed.res
    const cid = ownerId(auth.user, parsed.data.customerId)
    if (!cid) return badRequest('No customer scope for this identity.')
    if (cid !== parsed.data.customerId && auth.user.role !== 'PLATFORM_ADMIN') {
      return badRequest('You can only save places on your own account.')
    }

    const count = await db.savedPlace.count({ where: { customerId: cid } })
    if (count >= MAX_PLACES) return conflict(`You can save up to ${MAX_PLACES} places.`)
    const isDefault = parsed.data.isDefault === true || count === 0
    const place = await db.$transaction(async (tx) => {
      if (isDefault) await tx.savedPlace.updateMany({ where: { customerId: cid, isDefault: true }, data: { isDefault: false } })
      return tx.savedPlace.create({ data: { customerId: cid, label: parsed.data.label, area: parsed.data.area, address: parsed.data.address, isDefault } })
    })
    return ok({ place }, 201)
  })
}

export async function PATCH(req: NextRequest) {
  return guard(async () => {
    const auth = await requireAnyRole(['CUSTOMER', 'INSTITUTION', 'PLATFORM_ADMIN'])
    if (!auth.ok) return auth.res
    const parsed = await readJson(req, PatchSchema)
    if (!parsed.ok) return parsed.res
    const place = await db.savedPlace.findUnique({ where: { id: parsed.data.id }, select: { id: true, customerId: true } })
    if (!place) return notFound('Place not found.')
    if (ownerId(auth.user, place.customerId) !== place.customerId) return badRequest('That place belongs to another account.')
    await db.$transaction([
      db.savedPlace.updateMany({ where: { customerId: place.customerId, isDefault: true }, data: { isDefault: false } }),
      db.savedPlace.update({ where: { id: place.id }, data: { isDefault: true } }),
    ])
    return ok({ updated: place.id })
  })
}

export async function DELETE(req: NextRequest) {
  return guard(async () => {
    const auth = await requireAnyRole(['CUSTOMER', 'INSTITUTION', 'PLATFORM_ADMIN'])
    if (!auth.ok) return auth.res
    const id = req.nextUrl.searchParams.get('id') ?? ''
    if (!id) return badRequest('id required')
    const place = await db.savedPlace.findUnique({ where: { id }, select: { id: true, customerId: true, isDefault: true } })
    if (!place) return notFound('Place not found.')
    if (ownerId(auth.user, place.customerId) !== place.customerId) return badRequest('That place belongs to another account.')

    await db.savedPlace.delete({ where: { id: place.id } })
    if (place.isDefault) {
      // Promote the most recent remaining place so there is always a default.
      const next = await db.savedPlace.findFirst({ where: { customerId: place.customerId }, orderBy: { createdAt: 'desc' } })
      if (next) await db.savedPlace.update({ where: { id: next.id }, data: { isDefault: true } })
    }
    return ok({ deleted: place.id })
  })
}
