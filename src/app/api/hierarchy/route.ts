import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

// Configurable cooperative hierarchy — levels are data, not hard-coded structure
export async function GET() {
  const [levels, federations] = await Promise.all([
    db.hierarchyLevelConfig.findMany({ orderBy: { orderIndex: 'asc' } }),
    db.federation.findMany({ include: { districtsRel: true } }),
  ])

  const tree = federations.map((f) => ({
    id: f.id,
    type: f.type,
    name: f.name,
    region: f.region,
    districts: f.districtsRel.map((d) => ({
      id: d.id,
      name: d.name,
      coordinator: d.coordinator,
      workers: d.workers,
      talukas: [] as Array<{ id: string; name: string; cooperatives: Array<{ id: string; name: string; sector: string; workerCount: number }> }>,
    })),
  }))

  for (const f of tree) {
    for (const d of f.districts) {
      const talukas = await db.taluka.findMany({ where: { districtId: d.id }, include: { cooperativesRel: true } })
      d.talukas = talukas.map((t) => ({
        id: t.id,
        name: t.name,
        cooperatives: t.cooperativesRel.map((c) => ({ id: c.id, name: c.name, sector: c.sector, workerCount: c.workerCount })),
      }))
    }
  }

  return NextResponse.json({ ok: true, levels, tree })
}
