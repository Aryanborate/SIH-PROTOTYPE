// GigSetu Phase 5 — Worker Welfare Wallet (#21)
// Aggregates insurance, social security, training, certifications, benefits and
// emergency support into one welfare profile per worker.
// PROTOTYPE welfare integration — no live insurer / ESIC / EPFO APIs are connected.

import { db } from './db'

export interface WelfareBenefit {
  name: string
  status: 'AVAILABLE' | 'ACTIVE' | 'CLAIMED' | 'EXPIRED'
  detail: string
  valueRs?: number
}

export interface WelfareProfile {
  insurance: { status: 'ACTIVE' | 'PENDING' | 'EXPIRED'; policy: string; coverRs: number; renewal: string }
  training: { status: 'UP_TO_DATE' | 'DUE' | 'OVERDUE'; lastCourse: string; lastCompletedAt: string; nextDue: string }
  certification: { status: 'VALID' | 'EXPIRING' | 'EXPIRED'; name: string; expiry: string }
  socialSecurity: { status: 'LINKED' | 'PENDING' | 'NOT_LINKED'; id: string; scheme: string }
  benefits: WelfareBenefit[]
  emergencySupport: { status: 'ELIGIBLE' | 'NOT_ELIGIBLE'; fundRs: number; note: string }
  walletBalanceRs: number
  totalContributionsRs: number
  totalBenefitsRs: number
  prototypeNote: string
}

function defaultProfile(worker: {
  certName: string
  certStatus: string
  certExpiry: string | null
  trainingsDone: number
  welfareBalanceRs: number
  safetyValid: boolean
  experienceYears: number
}): Omit<WelfareProfile, 'walletBalanceRs' | 'totalContributionsRs' | 'totalBenefitsRs'> {
  const certOk = worker.certStatus === 'VERIFIED'
  const expiry = worker.certExpiry ?? new Date(Date.now() + 300 * 86400000).toISOString().slice(0, 10)
  return {
    insurance: {
      status: 'ACTIVE',
      policy: `GS-INS-${worker.experienceYears}${worker.certName.length}92`,
      coverRs: 200000,
      renewal: new Date(Date.now() + 180 * 86400000).toISOString().slice(0, 10),
    },
    training: {
      status: worker.trainingsDone > 0 ? 'UP_TO_DATE' : 'DUE',
      lastCourse: worker.certName,
      lastCompletedAt: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10),
      nextDue: new Date(Date.now() + 275 * 86400000).toISOString().slice(0, 10),
    },
    certification: {
      status: certOk ? 'VALID' : worker.certStatus === 'PENDING' ? 'EXPIRING' : 'EXPIRED',
      name: worker.certName,
      expiry,
    },
    socialSecurity: {
      status: 'LINKED',
      id: `SS-${worker.certName.slice(0, 2).toUpperCase()}${worker.trainingsDone}4${worker.experienceYears}7`,
      scheme: 'e-Shram + ESIC (prototype linkage)',
    },
    benefits: [
      { name: 'Skill upgrade scholarship', status: 'AVAILABLE', detail: '50% fee support for the next certified training course', valueRs: 1500 },
      { name: 'Tool purchase loan', status: 'AVAILABLE', detail: 'Interest-free loan from the welfare fund', valueRs: 5000 },
      { name: 'Family medical camp', status: 'ACTIVE', detail: 'Quarterly camp at the cooperative office — next on the 2nd Sunday' },
    ],
    emergencySupport: {
      status: 'ELIGIBLE',
      fundRs: Math.min(worker.welfareBalanceRs * 3, 10000),
      note: 'Cooperative emergency advance against welfare balance, approved by the office bearer.',
    },
    prototypeNote: 'Prototype welfare integration — designed for authorized linking with insurers, e-Shram / ESIC registries and training providers.',
  }
}

export async function getWelfareProfile(workerId: string): Promise<WelfareProfile | null> {
  const worker = await db.worker.findUnique({ where: { id: workerId } })
  if (!worker) return null

  const ledger = await db.welfareLedger.findMany({ where: { workerId }, orderBy: { createdAt: 'desc' } })
  const totalContributionsRs = ledger.filter((l) => l.type === 'CONTRIBUTION').reduce((a, l) => a + l.amount, 0)
  const totalBenefitsRs = ledger.filter((l) => l.type === 'BENEFIT').reduce((a, l) => a + l.amount, 0)

  let parsed: Partial<WelfareProfile> = {}
  try {
    parsed = JSON.parse(worker.welfareJson || '{}')
  } catch {
    parsed = {}
  }
  const base = defaultProfile(worker)
  return {
    insurance: (parsed.insurance as WelfareProfile['insurance']) ?? base.insurance,
    training: (parsed.training as WelfareProfile['training']) ?? base.training,
    certification: (parsed.certification as WelfareProfile['certification']) ?? base.certification,
    socialSecurity: (parsed.socialSecurity as WelfareProfile['socialSecurity']) ?? base.socialSecurity,
    benefits: (parsed.benefits as WelfareBenefit[]) ?? base.benefits,
    emergencySupport: (parsed.emergencySupport as WelfareProfile['emergencySupport']) ?? base.emergencySupport,
    prototypeNote: base.prototypeNote,
    walletBalanceRs: worker.welfareBalanceRs,
    totalContributionsRs,
    totalBenefitsRs,
  }
}
