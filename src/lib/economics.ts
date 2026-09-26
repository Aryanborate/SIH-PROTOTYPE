// GigSetu Phase 5 — Cooperative Economics (#40)
// Configurable business-model canvas. All pricing is data, not code — stored in
// EconomicsConfig and editable from the platform admin console.

import { db } from './db'

export interface RevenueSource {
  key: string
  label: string
  priceRs: number
  unit: string // per job / per month / per year / pct
  active: boolean
  note: string
}

export interface EconomicsDTO {
  sources: RevenueSource[]
  projectedMonthlyRs: number
  note: string
  updatedBy: string
  updatedAt: string
}

export const DEFAULT_SOURCES: RevenueSource[] = [
  { key: 'household_fee', label: 'Household service fee', priceRs: 4, unit: '% per job', active: true, note: 'Small platform share inside the cooperative settlement split' },
  { key: 'institutional_sub', label: 'Institutional subscription', priceRs: 2500, unit: 'per month', active: true, note: 'Schools / hospitals / societies pay a flat portal subscription' },
  { key: 'amc', label: 'AMC contracts', priceRs: 8, unit: '% of AMC value', active: true, note: 'Coordination share on annual maintenance contracts' },
  { key: 'tech_subscription', label: 'Cooperative technology subscription', priceRs: 500, unit: 'per coop / month', active: true, note: 'SaaS-style fee paid by cooperatives, waived for year one' },
  { key: 'federation_analytics', label: 'Federation analytics', priceRs: 12000, unit: 'per year', active: false, note: 'District/state dashboards for federations (planned)' },
  { key: 'training', label: 'Training & certification', priceRs: 300, unit: 'per worker / course', active: true, note: 'Shared with certified training providers' },
  { key: 'procurement', label: 'Procurement services', priceRs: 3, unit: '% of order value', active: true, note: 'Handling share on collective bulk procurement' },
]

export async function getEconomics(): Promise<EconomicsDTO> {
  const row = await db.economicsConfig.findUnique({ where: { id: 'default' } })
  let sources = DEFAULT_SOURCES
  let updatedBy = 'system'
  let updatedAt = new Date().toISOString()
  let note = 'Prototype economics — pricing under cooperative review, NOT a final business model.'
  if (row) {
    try {
      const parsed = JSON.parse(row.revenueJson) as RevenueSource[]
      if (Array.isArray(parsed) && parsed.length) sources = parsed
      updatedBy = row.updatedBy
      updatedAt = row.updatedAt.toISOString()
      note = row.note || note
    } catch {
      /* fall back to defaults */
    }
  }
  const active = sources.filter((s) => s.active)
  // Honest synthetic projection: baseline volumes for the featured network
  const projectedMonthlyRs = Math.round(
    active.reduce((acc, s) => {
      switch (s.key) {
        case 'household_fee':
          return acc + 9000 * 450 * (s.priceRs / 100) // ~9k jobs/month across pilot coops
        case 'institutional_sub':
          return acc + 40 * s.priceRs
        case 'amc':
          return acc + 25 * 42000 * (s.priceRs / 100)
        case 'tech_subscription':
          return acc + 60 * s.priceRs
        case 'federation_analytics':
          return acc + s.priceRs / 12
        case 'training':
          return acc + 350 * s.priceRs
        case 'procurement':
          return acc + 8 * 900000 * (s.priceRs / 100)
        default:
          return acc
      }
    }, 0)
  )
  return { sources, projectedMonthlyRs, note, updatedBy, updatedAt }
}

export async function saveEconomics(sources: RevenueSource[], updatedBy: string): Promise<EconomicsDTO> {
  const data = JSON.stringify(sources)
  await db.economicsConfig.upsert({
    where: { id: 'default' },
    update: { revenueJson: data, updatedBy },
    create: { id: 'default', revenueJson: data, updatedBy },
  })
  return getEconomics()
}
