// GigSetu Phase 5 — Collective Procurement (#37)
// Aggregates cooperative workforce demand into bulk-purchase opportunities.
// "100 plumbers require toolkits → bulk procurement opportunity detected."

import { db } from './db'

export interface ProcurementKitItem {
  item: string
  unit: string
  unitCostRs: number
  bulkUnitCostRs: number
}

export interface ProcurementOpportunity {
  skill: string
  workerCount: number
  kitName: string
  items: ProcurementKitItem[]
  retailTotalRs: number
  bulkTotalRs: number
  savingRs: number
  savingPct: number
  federationNote: string
}

export interface ProcurementDTO {
  district: string
  cooperativesScanned: number
  opportunities: ProcurementOpportunity[]
  totalSavingRs: number
  headline: string
  prototypeNote: string
}

const KITS: Record<string, { kitName: string; items: ProcurementKitItem[] }> = {
  plumber: {
    kitName: 'Plumber toolkit',
    items: [
      { item: 'Pipe wrench set', unit: 'set', unitCostRs: 850, bulkUnitCostRs: 640 },
      { item: 'Safety gloves', unit: 'pair', unitCostRs: 120, bulkUnitCostRs: 78 },
      { item: 'PVC pipe cutter', unit: 'piece', unitCostRs: 450, bulkUnitCostRs: 330 },
      { item: 'Thread seal consumables', unit: 'month pack', unitCostRs: 200, bulkUnitCostRs: 140 },
    ],
  },
  electrician: {
    kitName: 'Electrician toolkit',
    items: [
      { item: 'Insulated tool set', unit: 'set', unitCostRs: 1400, bulkUnitCostRs: 1050 },
      { item: 'Safety helmet', unit: 'piece', unitCostRs: 350, bulkUnitCostRs: 240 },
      { item: 'Voltage tester', unit: 'piece', unitCostRs: 300, bulkUnitCostRs: 210 },
      { item: 'Wire rolls (consumables)', unit: 'month pack', unitCostRs: 550, bulkUnitCostRs: 400 },
    ],
  },
  carpenter: {
    kitName: 'Carpenter toolkit',
    items: [
      { item: 'Power drill', unit: 'piece', unitCostRs: 2600, bulkUnitCostRs: 2050 },
      { item: 'Chisel & saw set', unit: 'set', unitCostRs: 700, bulkUnitCostRs: 520 },
      { item: 'Measuring & marking kit', unit: 'set', unitCostRs: 260, bulkUnitCostRs: 180 },
    ],
  },
  painter: {
    kitName: 'Painter kit',
    items: [
      { item: 'Roller & brush set', unit: 'set', unitCostRs: 380, bulkUnitCostRs: 270 },
      { item: 'Safety sheets & tape', unit: 'month pack', unitCostRs: 240, bulkUnitCostRs: 160 },
      { item: 'Protective eyewear', unit: 'piece', unitCostRs: 180, bulkUnitCostRs: 120 },
    ],
  },
  cleaning: {
    kitName: 'Deep-clean kit',
    items: [
      { item: 'Industrial vacuum share', unit: 'month', unitCostRs: 500, bulkUnitCostRs: 350 },
      { item: 'Eco cleaning consumables', unit: 'month pack', unitCostRs: 450, bulkUnitCostRs: 300 },
      { item: 'Uniform set', unit: 'set', unitCostRs: 600, bulkUnitCostRs: 420 },
    ],
  },
  technician: {
    kitName: 'Appliance technician kit',
    items: [
      { item: 'Multimeter', unit: 'piece', unitCostRs: 900, bulkUnitCostRs: 680 },
      { item: 'Refrigerant gauge set', unit: 'set', unitCostRs: 1800, bulkUnitCostRs: 1400 },
      { item: 'Common spares box', unit: 'month pack', unitCostRs: 700, bulkUnitCostRs: 520 },
    ],
  },
}

export async function getProcurementDemand(districtName = 'Pune'): Promise<ProcurementDTO> {
  const district = await db.district.findFirst({ where: { name: { contains: districtName } }, include: { talukas: { include: { cooperativesRel: { include: { workers: { select: { primarySkill: true } } } } } } } })
  const workersBySkill = new Map<string, number>()
  let cooperativesScanned = 0
  for (const t of district?.talukas ?? []) {
    for (const c of t.cooperativesRel) {
      cooperativesScanned++
      for (const w of c.workers) workersBySkill.set(w.primarySkill, (workersBySkill.get(w.primarySkill) ?? 0) + 1)
    }
  }
  // Fallback when the district row isn't found — use featured coop counts
  if (!cooperativesScanned) {
    const groups = await db.worker.groupBy({ by: ['primarySkill'], _count: { primarySkill: true } })
    for (const g of groups) workersBySkill.set(g.primarySkill, g._count.primarySkill)
    cooperativesScanned = await db.cooperative.count()
  }

  const opportunities: ProcurementOpportunity[] = []
  for (const [skill, count] of workersBySkill.entries()) {
    const kit = KITS[skill]
    if (!kit) continue
    const retailTotal = kit.items.reduce((a, i) => a + i.unitCostRs, 0) * count
    const bulkTotal = kit.items.reduce((a, i) => a + i.bulkUnitCostRs, 0) * count
    const saving = retailTotal - bulkTotal
    opportunities.push({
      skill,
      workerCount: count,
      kitName: kit.kitName,
      items: kit.items,
      retailTotalRs: retailTotal,
      bulkTotalRs: bulkTotal,
      savingRs: saving,
      savingPct: Math.round((saving / retailTotal) * 100),
      federationNote: `${count} ${skill}s across ${cooperativesScanned} cooperatives — one federation-level order unlocks the bulk rate.`,
    })
  }
  opportunities.sort((a, b) => b.savingRs - a.savingRs)
  const totalSavingRs = opportunities.reduce((a, o) => a + o.savingRs, 0)
  return {
    district: district?.name ?? districtName,
    cooperativesScanned,
    opportunities: opportunities.slice(0, 6),
    totalSavingRs,
    headline: `Bulk procurement opportunity detected — ₹${totalSavingRs.toLocaleString('en-IN')} potential saving this quarter.`,
    prototypeNote: 'Prototype procurement intelligence — mock catalogue rates; designed for authorized integration with registered suppliers.',
  }
}
