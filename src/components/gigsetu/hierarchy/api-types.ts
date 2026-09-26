// Shared API response types for the hierarchy / ecosystem / exchange views
// Contracts come from:
//   GET /api/hierarchy/dashboard?level=government
//   GET /api/hierarchy
//   GET /api/exchange

export interface HierarchyLevel {
  id: string
  level: number
  code: string
  nameEn: string
  nameMr: string
  nameHi: string
  descriptionEn: string
  active: boolean
  orderIndex: number
}

// ---------- Government dashboard ----------

export interface GovIntegration {
  id: string
  name: string
  domain: string
  purpose: string
  status: 'FUTURE' | 'DESIGNED' | string
  dataFlow: string
}

export interface GovRegistrationRecord {
  id: string
  registrationNumber: string
  registeredOn: string
  registeringAuthority: string
  state: string
  district: string
  taluka: string
  societyType: string
  authorizedRepresentative: string
  memberCount: number
  workerCount: number
  serviceCategories: string // JSON string[]
  operationalStatus: string
  verificationStatus: string
  sourceNote: string
  cooperative: { id: string; name: string; sector: string }
}

export interface GovDashboardResponse {
  ok: boolean
  integrations: GovIntegration[]
  registration: GovRegistrationRecord | null
  levels: HierarchyLevel[]
}

// ---------- Hierarchy tree ----------

export interface CoopNode {
  id: string
  name: string
  sector: string
  workerCount: number
}

export interface TalukaNode {
  id: string
  name: string
  cooperatives: CoopNode[]
}

export interface DistrictNode {
  id: string
  name: string
  coordinator: string
  workers: number
  talukas: TalukaNode[]
}

export interface FederationNode {
  id: string
  type: 'STATE' | 'NATIONAL' | string
  name: string
  region: string
  districts: DistrictNode[]
}

export interface HierarchyTreeResponse {
  ok: boolean
  levels: HierarchyLevel[]
  tree: FederationNode[]
}

// ---------- Service exchange ----------

export interface ExchangeRec {
  id: string
  skill: string
  fromCoopId: string
  fromCoopName: string
  toCoopId: string
  toCoopName: string
  districtName: string
  workerCount: number
  distanceKm: number
  expectedDemand: number
  durationDays: number
  rationale: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | string
  approvedBy?: string | null
  decidedAt?: string | null
  createdAt: string
}

export interface ExchangeResponse {
  ok: boolean
  recommendations: ExchangeRec[]
  stats: { pending: number; approved: number; rejected: number; workersMoved: number }
}
