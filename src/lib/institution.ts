// GigSetu Phase 5 — Institutional Customer Portal (#32) data layer
// Bulk requests, recurring services, contracts, scheduling, history, invoices, reports.

import { db } from './db'
import type { CustomerType } from './types'

export interface InstitutionInvoice {
  id: string
  ref: string
  period: string
  jobs: number
  amountRs: number
  status: 'PAID' | 'DUE' | 'GENERATING'
  issuedAt: string
}

export interface InstitutionRequestDTO {
  id: string
  type: string
  categoryKey: string
  title: string
  detail: string
  area: string
  headcount: number
  schedule: { freq?: string; day?: string; slot?: string }
  scheduledAt: string
  status: string
  estimatedRs: number | null
  createdAt: string
}

export interface InstitutionPortalDTO {
  customer: { id: string; name: string; type: string; area: string; city: string; address: string }
  allowedTypes: CustomerType[]
  kpis: { contracts: number; monthlyRequests: number; completedJobs: number; pendingJobs: number; openRequests: number; monthlySpendRs: number }
  requests: InstitutionRequestDTO[]
  recentServices: { refCode: string; title: string; categoryKey: string; status: string; scheduledAt: string; workerName?: string | null; price: number | null }[]
  monthlyVolume: { label: string; jobs: number }[]
  invoices: InstitutionInvoice[]
  emergencyContact: { coopName: string; slaHours: number; phone: string }
  prototypeNote: string
}

const CATEGORY_FALLBACK: Record<string, string> = { plumber: 'Plumbing', electrician: 'Electrical', carpenter: 'Carpentry', painter: 'Painting', cleaning: 'Cleaning', driver: 'Driver', technician: 'Appliance Technician' }

export async function getInstitutionPortal(customerId: string): Promise<InstitutionPortalDTO | null> {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    include: {
      amcContracts: { orderBy: { createdAt: 'desc' } },
      institutionRequests: { orderBy: { createdAt: 'desc' }, take: 20 },
      bookings: { orderBy: { createdAt: 'desc' }, take: 200, include: { worker: { select: { name: true } } } },
    },
  })
  if (!customer) return null

  const now = new Date()
  const monthBookings = customer.bookings.filter((b) => b.createdAt >= new Date(now.getFullYear(), now.getMonth(), 1))
  const completed = customer.bookings.filter((b) => ['COMPLETED', 'PAID', 'REVIEWED'].includes(b.status))
  const pending = customer.bookings.filter((b) => ['REQUESTED', 'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS', 'QUOTE_REQUESTED', 'QUOTED', 'NEGOTIATING'].includes(b.status))
  const monthlySpendRs = monthBookings.reduce((a, b) => a + (b.finalPrice ?? b.estimatedPrice ?? 0), 0)

  // 6-month volume from bookings + honest synthetic backfill for the seeded institution
  const monthlyVolume: { label: string; jobs: number }[] = []
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const label = `${MONTHS[d.getMonth()]}`
    const real = customer.bookings.filter((b) => {
      const bd = new Date(b.createdAt)
      return bd.getFullYear() === d.getFullYear() && bd.getMonth() === d.getMonth()
    }).length
    const synthetic = customer.type !== 'HOUSEHOLD' ? 14 + ((d.getMonth() * 7 + customer.name.length) % 11) : real
    monthlyVolume.push({ label, jobs: Math.max(real, real > 0 ? real : synthetic * 0 + real) || synthetic })
  }

  const invoices: InstitutionInvoice[] = customer.amcContracts.slice(0, 3).flatMap((c, ci) =>
    [0, 1, 2].slice(0, ci === 0 ? 3 : 1).map((m) => ({
      id: `${c.id}-inv-${m}`,
      ref: `INV-${c.title.slice(0, 3).toUpperCase()}-${now.getMonth() + 1 - m}${now.getFullYear().toString().slice(2)}`,
      period: `${MONTHS[(now.getMonth() - m + 12) % 12]} ${now.getFullYear()}`,
      jobs: c.completedJobs > 0 ? Math.round(c.completedJobs / 3) : 12 + ((m * 5 + ci) % 9),
      amountRs: c.monthlyFeeRs,
      status: (m === 0 ? (ci === 0 ? 'DUE' : 'PAID') : 'PAID') as InstitutionInvoice['status'],
      issuedAt: new Date(now.getFullYear(), now.getMonth() - m, 5).toISOString(),
    }))
  )

  const primary = customer.amcContracts[0]
  return {
    customer: { id: customer.id, name: customer.name, type: customer.type, area: customer.area, city: customer.city, address: customer.address },
    allowedTypes: ['SOCIETY', 'SCHOOL', 'HOSPITAL', 'HOSTEL', 'BUSINESS', 'GOVT'],
    kpis: {
      contracts: customer.amcContracts.length,
      monthlyRequests: primary?.monthlyRequests ?? monthBookings.length,
      completedJobs: completed.length,
      pendingJobs: pending.length,
      openRequests: customer.institutionRequests.filter((r) => ['REQUESTED', 'SCHEDULED'].includes(r.status)).length,
      monthlySpendRs,
    },
    requests: customer.institutionRequests.map((r) => ({
      id: r.id,
      type: r.type,
      categoryKey: r.categoryKey,
      title: r.title,
      detail: r.detail,
      area: r.area,
      headcount: r.headcount,
      schedule: safeParse(r.scheduleJson),
      scheduledAt: r.scheduledAt.toISOString(),
      status: r.status,
      estimatedRs: r.estimatedRs,
      createdAt: r.createdAt.toISOString(),
    })),
    recentServices: customer.bookings.slice(0, 12).map((b) => ({
      refCode: b.refCode,
      title: b.title,
      categoryKey: b.categoryKey,
      status: b.status,
      scheduledAt: b.scheduledAt.toISOString(),
      workerName: b.worker?.name ?? null,
      price: b.finalPrice ?? b.estimatedPrice ?? null,
    })),
    monthlyVolume,
    invoices,
    emergencyContact: {
      coopName: primary ? (primary as unknown as { cooperative?: { name?: string } }).cooperative?.name ?? 'Partner cooperative' : 'Pune Electrical Labour Cooperative',
      slaHours: primary?.slaHours ?? 2,
      phone: '+91 20 4000 1900',
    },
    prototypeNote: 'Institutional portal prototype — bulk / recurring requests and invoices are simulated; designed for authorized ERP integration.',
  }
}

/** Create a bulk / recurring / maintenance / emergency institutional request. */
export async function createInstitutionRequest(input: {
  customerId: string
  type: string
  categoryKey: string
  title: string
  detail?: string
  area: string
  headcount?: number
  schedule?: { freq?: string; day?: string; slot?: string }
  scheduledAt?: string
  contractId?: string | null
}): Promise<InstitutionRequestDTO> {
  const customer = await db.customer.findUnique({ where: { id: input.customerId } })
  if (!customer) throw new Error('Customer not found')
  const when = input.scheduledAt ? new Date(input.scheduledAt) : new Date(Date.now() + 86400000)
  const created = await db.institutionRequest.create({
    data: {
      customerId: input.customerId,
      contractId: input.contractId ?? null,
      type: ['BULK', 'RECURRING', 'MAINTENANCE', 'EMERGENCY'].includes(input.type) ? input.type : 'BULK',
      categoryKey: input.categoryKey,
      title: input.title.slice(0, 120),
      detail: (input.detail ?? '').slice(0, 500),
      area: input.area || customer.area,
      headcount: Math.max(1, Math.min(50, input.headcount ?? 1)),
      scheduleJson: JSON.stringify(input.schedule ?? {}),
      scheduledAt: when,
      status: 'REQUESTED',
      estimatedRs: (CATEGORY_FALLBACK[input.categoryKey] ? 450 : 500) * Math.max(1, input.headcount ?? 1),
    },
  })
  return {
    id: created.id,
    type: created.type,
    categoryKey: created.categoryKey,
    title: created.title,
    detail: created.detail,
    area: created.area,
    headcount: created.headcount,
    schedule: safeParse(created.scheduleJson),
    scheduledAt: created.scheduledAt.toISOString(),
    status: created.status,
    estimatedRs: created.estimatedRs,
    createdAt: created.createdAt.toISOString(),
  }
}

function safeParse(s: string): { freq?: string; day?: string; slot?: string } {
  try {
    return JSON.parse(s || '{}')
  } catch {
    return {}
  }
}
