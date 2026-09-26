// GigSetu shared types (client + server)

export type Role =
  | 'CUSTOMER'
  | 'INSTITUTION'
  | 'WORKER'
  | 'COOP_ADMIN'
  | 'TALUKA_COORD'
  | 'DISTRICT_COORD'
  | 'STATE_ADMIN'
  | 'NATIONAL_ADMIN'
  | 'PLATFORM_ADMIN'

export type Lang = 'en' | 'mr' | 'hi'

export interface DemoUser {
  id: string
  name: string
  role: Role
  title: string
  orgName?: string
  orgId?: string
  workerId?: string
  customerId?: string
  districtId?: string
  talukaId?: string
  federationId?: string
  /** Explicit cooperative id for a cooperative-admin identity (equals orgId). */
  cooperativeId?: string
}

export type Availability = 'AVAILABLE' | 'BUSY' | 'OFFLINE'
export type Urgency = 'NORMAL' | 'URGENT' | 'EMERGENCY'
export type BookingMode = 'INSTANT' | 'QUOTE'

export type BookingStatus =
  | 'QUOTE_REQUESTED'
  | 'QUOTED'
  | 'NEGOTIATING'
  | 'REQUESTED'
  | 'ACCEPTED'
  | 'ON_THE_WAY'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'PAID'
  | 'REVIEWED'
  | 'CANCELLED'

export interface ServiceCategoryDTO {
  id: string
  key: string
  nameEn: string
  nameMr: string
  nameHi: string
  icon: string
  baseRate: number
  avgDurationMin: number
  descEn: string
  descMr: string
  descHi: string
}

export interface WorkerDTO {
  id: string
  name: string
  phone: string
  cooperativeId: string
  cooperativeName?: string
  primarySkill: string
  secondarySkills: string[]
  experienceYears: number
  certName: string
  certStatus: string
  certExpiry?: string | null
  languages: string[]
  serviceAreas: string[]
  baseArea: string
  completedJobs: number
  rating: number
  completionRate: number
  safetyValid: boolean
  availability: Availability
  emergencyPool: boolean
  activeJobsToday: number
  earningsMonthRs: number
  welfareBalanceRs: number
  trainingsDone: number
  skills: string[]
  bioEn: string
}

export interface TimelineEntry {
  status: string
  at: string
  note?: string
}

export interface QuoteRound {
  by: 'WORKER' | 'CUSTOMER'
  price: number
  note: string
  at: string
}

export interface PaymentRecord {
  method: string
  amount: number
  workerShare: number
  coopCommission: number
  welfare: number
  platformFee: number
  paidAt: string
  txnId: string
}

export interface EvidenceRecord {
  notes: string
  photo?: string
  at: string
  by?: string
}

export interface BookingDTO {
  id: string
  refCode: string
  customerId: string
  customerName?: string
  customerType?: string
  customerPhone?: string
  categoryKey: string
  categoryName?: string
  title: string
  description: string
  media: string[]
  area: string
  address: string
  scheduledAt: string
  urgency: Urgency
  mode: BookingMode
  status: BookingStatus
  analysis?: Record<string, unknown> | null
  cooperativeId?: string | null
  cooperativeName?: string
  workerId?: string | null
  workerName?: string
  workerPhone?: string
  workerSkill?: string
  estimatedPrice?: number | null
  finalPrice?: number | null
  quotes: QuoteRound[]
  quoteOffers?: QuoteOffer[]
  payment?: PaymentRecord | null
  evidence?: EvidenceRecord | null
  rating?: number | null
  ratingFactors?: { quality: number; timeliness: number; behaviour: number; communication: number } | null
  review?: string | null
  timeline: TimelineEntry[]
  createdAt: string
}

export interface MatchedWorkerDTO {
  id: string
  name: string
  cooperativeName: string
  primarySkill: string
  distanceKm: number
  etaMin: number
  rating: number
  completedJobs: number
  certStatus: string
  certName: string
  availability: Availability
  emergencyPool: boolean
  languages: string[]
  experienceYears: number
  estimatedEarning: number
  score: number
  skills: string[]
  factors?: MatchFactor[]
  matchedReasons?: string[]
  policyNotes?: string[]
}

export interface MatchFactor {
  key: string
  label: string
  weightPct: number
  raw: number
  weighted: number
  detail: string
  pass: boolean
}

export interface MatchWeightsDTO {
  skillMatch: number
  certification: number
  distance: number
  availability: number
  workload: number
  serviceHistory: number
  updatedBy: string
  updatedAt: string | null
}

// ---------- Phase 3: Demand Forecast (prototype, synthetic) ----------

export interface ForecastDayPoint {
  date: string
  label: string // "Mon 12"
  isWeekend: boolean
  volumes: Record<string, number> // categoryKey → expected jobs
}

export interface ForecastCategoryPulse {
  categoryKey: string
  name: string
  icon: string
  baseWeekend: number
  expectedWeekend: number
  pct: number // +31 means +31%
  trend: 'up' | 'down' | 'flat'
  drivers: string[] // explainable drivers, e.g. "Monsoon leak calls"
}

export interface ForecastResponse {
  ok: boolean
  label: string // "Pune Zone 4"
  zone: string
  generatedAt: string
  disclaimer: string
  horizonDays: number
  series: ForecastDayPoint[]
  categories: ForecastCategoryPulse[]
  zoneOptions: string[]
}

// ---------- Phase 3: Skill Gap Intelligence ----------

export interface SkillGapRow {
  categoryKey: string
  name: string
  icon: string
  expectedDemand: number // 30-day expected jobs
  certifiedWorkers: number
  activeWorkers: number
  gap: number // demand - capacity (workers needed)
  gapLevel: 'OK' | 'TIGHT' | 'CRITICAL'
  trainingRecommendation: string | null
  courseTitle: string | null
  employmentOpportunity: string // "≈ ₹X.XL/month additional member income"
  incomePotentialRs: number
}

export interface SkillGapResponse {
  ok: boolean
  districtName: string
  disclaimer: string
  rows: SkillGapRow[]
  totalGap: number
  criticalSkills: string[]
}

// ---------- Phase 3: Workforce Allocation Engine ----------

export interface AllocateResponse {
  ok: boolean
  aiLabel: string
  input: { categoryKey: string; area: string; urgency: Urgency; scheduledAt: string }
  recommended: MatchedWorkerDTO | null
  alternatives: MatchedWorkerDTO[]
  explain: string[]
  policyNotes: string[]
  factorTable: Array<{ label: string; weightPct: number; score: string; detail: string }>
  etaMin: number | null
  priceRange: { floor: number; ceiling: number } | null
}

// ---------- Phase 3: Preventive Maintenance (mock module) ----------

export interface MaintenanceSignal {
  key: string
  label: string
  value: string
  trend: 'up' | 'down' | 'flat' | 'warn'
  note: string
}

export interface MaintenanceRecommendation {
  id: string
  categoryKey: string
  title: string
  severity: 'LOW' | 'MEDIUM' | 'HIGH'
  detail: string
  action: string
  suggestedWindow: string
  estCostRange: [number, number]
}

export interface MaintenanceProfile {
  id: string
  name: string
  type: string
  buildingAgeYears: number
  units: number
  area: string
  healthScore: number
  lastInspectionMonthsAgo: number
  signals: MaintenanceSignal[]
  recommendations: MaintenanceRecommendation[]
  disclaimer: string
}

export interface MaintenanceResponse {
  ok: boolean
  profiles: MaintenanceProfile[]
  disclaimer: string
}

// ---------- Phase 4: WhatsApp booking bot ----------

export interface WaQuickReply {
  label: string
  value: string
  kind?: 'primary' | 'normal' | 'danger'
}

export interface WaWorkerCard {
  workerId: string
  workerName: string
  coopName: string
  rating: number
  distanceKm: number
  etaMin: number
  priceFloor: number
  priceCeiling: number
  certStatus: string
}

export interface WaBotResponse {
  ok: boolean
  replies: Array<{ text: string; delayMs?: number }>
  quickReplies: WaQuickReply[]
  workerCard?: WaWorkerCard | null
  /** present when the bot has everything needed and can create the booking */
  pendingSlot?: {
    categoryKey: string
    title: string
    description: string
    area: string
    address: string
    scheduledAt: string
    urgency: Urgency
  } | null
  /** set after CONFIRM BOOKING succeeded */
  bookingRef?: string | null
  bookingId?: string | null
  lang: Lang
  /** opaque conversation state — echo it back with the next message */
  state: object
}

// ---------- Phase 4: Emergency escalation ----------

export interface EmergencyLevelResult {
  level: 0 | 1 | 2 | 3
  name: string // "Local cooperative", "Taluka reserve", "District reserve", "Federation emergency pool"
  detail: string
  workersFound: number
  dispatched: { id: string; name: string; coopName: string; distanceKm: number; etaMin: number; rating: number } | null
  active: boolean // the level that actually dispatched
}

export interface EmergencyEscalationResponse {
  ok: boolean
  categoryKey: string
  area: string
  urgency: 'EMERGENCY'
  ladder: EmergencyLevelResult[]
  dispatchedFrom: string | null
  totalEtaMin: number | null
  disclaimer: string
}

// ---------- Phase 4: Quote offers (3 eligible workers) ----------

export interface QuoteOffer {
  workerId: string
  workerName: string
  coopName: string
  price: number
  availableAt: string // human label e.g. "Today 5 PM"
  etaMin: number
  rating: number
  certStatus: string
}

export interface PriceBreakdown {
  /** Labour component after duration + skill-level scaling. */
  base: number
  /** Travel component — road distance × cooperative per-km rate (§10). */
  travel: number
  /** Material component — trade default or the request's explicit figure (§10). */
  material: number
  urgencySurcharge: number
  eveningSurcharge: number
  total: number
  floor: number
  ceiling: number
  estimatedMinutes: number
  welfareNote: string
  policyNote: string
}

export interface MatchResponse {
  ok: boolean
  best: MatchedWorkerDTO | null
  alternatives: MatchedWorkerDTO[]
  priceEstimate: PriceBreakdown
  pipeline: Array<{ stage: string; detail: string; count: number }>
}

export interface NotificationDTO {
  id: string
  audience: string
  audienceId: string
  title: string
  body: string
  type: string
  read: boolean
  createdAt: string
}

export interface SavedPlaceDTO {
  id: string
  customerId: string
  label: string
  area: string
  address: string
  isDefault: boolean
  createdAt: string
}

export interface ExchangeDTO {
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
  status: string
  approvedBy?: string | null
  decidedAt?: string | null
  createdAt: string
}

export interface AreaCoords {
  [area: string]: { x: number; y: number }
}

export const BOOKING_STATUS_ORDER: BookingStatus[] = [
  'REQUESTED',
  'ACCEPTED',
  'ON_THE_WAY',
  'IN_PROGRESS',
  'COMPLETED',
  'PAID',
  'REVIEWED',
]

export const STATUS_LABELS: Record<string, string> = {
  QUOTE_REQUESTED: 'Quote requested',
  QUOTED: 'Quote received',
  NEGOTIATING: 'Negotiating',
  REQUESTED: 'Finding worker',
  ACCEPTED: 'Worker accepted',
  ON_THE_WAY: 'On the way',
  IN_PROGRESS: 'Work in progress',
  COMPLETED: 'Completed',
  PAID: 'Paid',
  REVIEWED: 'Reviewed',
  CANCELLED: 'Cancelled',
}

export const DEMO_AREAS = [
  'Kothrud', 'Karve Nagar', 'Warje', 'Sinhagad Road', 'Shivajinagar', 'Aundh', 'Baner', 'Bavdhan',
  'Erandwane', 'Deccan', 'Swargate', 'Parvati', 'Sahakarnagar', 'Katraj', 'Kondhwa', 'Wanowrie',
  'Hadapsar', 'Viman Nagar', 'Chandan Nagar', 'Yerawada', 'Dhanori', 'Vishrantwadi', 'Pimple Saudagar',
  'Pimpri', 'Chinchwad', 'Nigdi', 'Akurdi', 'Wakad', 'Hinjewadi', 'Balewadi', 'Pashan', 'Bibwewadi',
  'Balaji Nagar', 'Dhankawadi', 'Gultekdi', 'Market Yard', 'Kharadi', 'Wagholi',
]

// ===================== Phase 5 DTOs =====================

export type CustomerType = 'HOUSEHOLD' | 'SOCIETY' | 'SCHOOL' | 'HOSPITAL' | 'HOSTEL' | 'BUSINESS' | 'GOVT'

// #21 Worker Welfare Wallet
export interface WelfareWalletDTO {
  insurance: { status: string; policy: string; coverRs: number; renewal: string }
  training: { status: string; lastCourse: string; lastCompletedAt: string; nextDue: string }
  certification: { status: string; name: string; expiry: string }
  socialSecurity: { status: string; id: string; scheme: string }
  benefits: { name: string; status: string; detail: string; valueRs?: number }[]
  emergencySupport: { status: string; fundRs: number; note: string }
  walletBalanceRs: number
  totalContributionsRs: number
  totalBenefitsRs: number
  prototypeNote: string
}

// #32 Institutional portal
export interface InstitutionPortalDTO {
  customer: { id: string; name: string; type: string; area: string; city: string; address: string }
  kpis: { contracts: number; monthlyRequests: number; completedJobs: number; pendingJobs: number; openRequests: number; monthlySpendRs: number }
  requests: { id: string; type: string; categoryKey: string; title: string; detail: string; area: string; headcount: number; schedule: { freq?: string; day?: string; slot?: string }; scheduledAt: string; status: string; estimatedRs: number | null; createdAt: string }[]
  recentServices: { refCode: string; title: string; categoryKey: string; status: string; scheduledAt: string; workerName?: string | null; price: number | null }[]
  monthlyVolume: { label: string; jobs: number }[]
  invoices: { id: string; ref: string; period: string; jobs: number; amountRs: number; status: string; issuedAt: string }[]
  emergencyContact: { coopName: string; slaHours: number; phone: string }
  prototypeNote: string
}

// #33 AMC contract
export interface AmcContractDTO {
  id: string
  title: string
  propertyType: string
  units: number
  services: string[]
  status: string
  startDate: string
  endDate: string
  monthlyFeeRs: number
  slaHours: number
  slaMetPct: number
  monthlyRequests: number
  completedJobs: number
  pendingJobs: number
  workers: { id?: string; name: string; skill?: string; role?: string }[]
  cooperative: { id: string; name: string; repName?: string; emergencyPoolSize?: number } | null
}

// #34 Service evidence (extends booking evidence)
export interface ServiceEvidenceDTO {
  jobRef: string
  beforePhoto?: string
  problem: string
  workPerformed: string
  materialUsed?: string
  afterPhoto?: string
  workerName: string
  workerVerified: boolean
  customerApproval: string // PENDING | APPROVED
  warrantyDays: number
  warrantyUntil: string
}

// #35 Two-sided trust
export interface TrustWorkerDTO {
  workerId: string
  workerName: string
  totalRatings: number
  average: number
  factors: { key: string; label: string; avg: number }[]
  complaintsOpen: number
  reportsAgainst: number
  note: string
}

// #36 Cooperative reputation
export interface CoopReputationDTO {
  coopId: string
  name: string
  jobsCompleted: number
  onTimePct: number
  complaintRatePct: number
  avgRating: number
  verifiedWorkersPct: number
  emergencyResponseMin: number
  repeatCustomerPct: number
  workerCount: number
  memberCount: number
  verificationBadges: string[]
  note: string
}

// #37 Collective procurement
export interface ProcurementDTO {
  district: string
  cooperativesScanned: number
  opportunities: { skill: string; workerCount: number; kitName: string; items: { item: string; unit: string; unitCostRs: number; bulkUnitCostRs: number }[]; retailTotalRs: number; bulkTotalRs: number; savingRs: number; savingPct: number; federationNote: string }[]
  totalSavingRs: number
  headline: string
  prototypeNote: string
}

// #38 Digital payments
export interface FeeConfigDTO {
  workerSharePct: number
  coopPct: number
  welfarePct: number
  platformPct: number
  updatedBy: string
  updatedAt: string
  configurable: boolean
  note: string
}

export interface PaymentHistoryDTO {
  refCode: string
  title: string
  method: string
  amount: number
  workerShare: number
  coopCommission: number
  welfare: number
  platformFee: number
  txnId: string
  paidAt: string
}

// #39 Worker earnings
export interface WorkerEarningsDTO {
  today: number
  week: number
  month: number
  pending: number
  completedJobs: number
  todayJobs: number
  weekSeries: { day: string; date: string; amount: number; jobs: number }[]
  categoryMix: { key: string; label: string; amount: number; pct?: number }[]
  prototypeNote: string
}

// #40 Cooperative economics
export interface EconomicsDTO {
  sources: { key: string; label: string; priceRs: number; unit: string; active: boolean; note: string }[]
  projectedMonthlyRs: number
  note: string
  updatedBy: string
  updatedAt: string
}

// #42 Geo map
export interface GeoDTO {
  role: string
  refId: string
  title: string
  pins: { id: string; kind: string; label: string; sub: string; x: number; y: number; area: string; status?: string; skill?: string; value?: number }[]
  zones: { key: string; label: string; x: number; y: number; r: number; level: string; kind: string }[]
  summary: { workers: number; available: number; jobs: number; emergencyZones: number }
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
  note: string
}

// #43 Admin overview
export interface AdminOverviewDTO {
  counts: Record<string, number>
  payments: { settledCount: number; settledRs: number; workerRs: number; coopRs: number; welfareRs: number; platformRs: number }
  demandByCategory: { key: string; count: number }[]
  bookingsByStatus: { status: string; count: number }[]
  bookingsByDay: { label: string; count: number }[]
  coopCapacity: { name: string; workers: number; activeToday: number; utilizationPct: number }[]
  emergencyResponse: { label: string; minutes: number }[]
  integrations: { name: string; domain: string; status: string; purpose: string }[]
  aiSettings: { weightsConfiguredBy: string; weightsUpdatedAt: string } | null
  note: string
}

// #44 Verification
export interface CoopVerificationDTO {
  coopId: string
  name: string
  badges: { key: string; label: string; emoji: string; earned: boolean; checks: { key: string; label: string; pass: boolean; basis: string }[] }[]
  overallPct: number
  note: string
}

export interface WorkerVerificationDTO {
  workerId: string
  name: string
  checks: { key: string; label: string; pass: boolean; basis: string }[]
  earnedPct: number
  note: string
}

/**
 * One address-autocomplete suggestion (spec §42).
 *
 * Lives here, in the shared types module, because BOTH the GeoApify route and
 * the booking flow consume it. It previously lived in lib/geoapify.ts while the
 * client re-declared its own copy asserting `area: string` — a field the server
 * never actually sent. The result: picking an address set the service area to
 * `undefined`, and the next POST /api/match failed with
 * "categoryKey and area required". Sharing one definition makes that class of
 * drift impossible.
 */
export interface PlaceSuggestion {
  id: string
  label: string
  lat: number
  lon: number
  type: string
  /** Resolved service area (e.g. "Kothrud"). REQUIRED, never undefined. */
  area: string
  city?: string
  stateDistrict?: string
  suburb?: string
  postcode?: string
}
