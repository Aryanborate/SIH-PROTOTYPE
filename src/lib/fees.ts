// GigSetu Phase 5 — Configurable fee model (#38 Digital Payments)
// The split is a cooperative policy knob, NOT a hard-coded business model.
// Stored in FeeConfig (single row, editable by platform admin); engine falls
// back to COOP_POLICY-derived defaults when unset.
import { db } from './db'
import { COOP_POLICY } from './pricing'

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

export interface FeeSplit {
  amount: number
  workerShare: number
  coopCommission: number
  welfare: number
  platformFee: number
}

export async function getFeeConfig(): Promise<FeeConfigDTO> {
  const row = await db.feeConfig.findUnique({ where: { id: 'default' } })
  if (!row) {
    return {
      workerSharePct: Math.round((1 - COOP_POLICY.welfareContributionPct - COOP_POLICY.coopCommissionPct - COOP_POLICY.platformFeePct) * 100),
      coopPct: Math.round(COOP_POLICY.coopCommissionPct * 100),
      welfarePct: Math.round(COOP_POLICY.welfareContributionPct * 100),
      platformPct: Math.round(COOP_POLICY.platformFeePct * 100),
      updatedBy: 'system',
      updatedAt: new Date().toISOString(),
      configurable: true,
      note: 'Fee model is a cooperative policy setting — editable by platform admin, not a final business model.',
    }
  }
  return {
    workerSharePct: row.workerSharePct,
    coopPct: row.coopPct,
    welfarePct: row.welfarePct,
    platformPct: row.platformPct,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt.toISOString(),
    configurable: true,
    note: 'Fee model is a cooperative policy setting — editable by platform admin, not a final business model.',
  }
}

/** Split `amount` using the DB-configured percentages (rounded, worker absorbs rounding drift). */
export async function splitWithConfig(amount: number): Promise<FeeSplit & { config: FeeConfigDTO }> {
  const cfg = await getFeeConfig()
  const total = Math.max(0, Math.round(amount))
  const coopCommission = Math.round((total * cfg.coopPct) / 100)
  const welfare = Math.round((total * cfg.welfarePct) / 100)
  const platformFee = Math.round((total * cfg.platformPct) / 100)
  const workerShare = total - coopCommission - welfare - platformFee
  return { amount: total, workerShare, coopCommission, welfare, platformFee, config: cfg }
}

/** Validate a proposed config: shares must sum to 100 and stay within sane bounds. */
export function validateFeeConfig(input: { workerSharePct: number; coopPct: number; welfarePct: number; platformPct: number }): { ok: boolean; error?: string } {
  const vals = [input.workerSharePct, input.coopPct, input.welfarePct, input.platformPct]
  if (vals.some((v) => !Number.isFinite(v) || v < 0 || v > 100)) return { ok: false, error: 'Percentages must be between 0 and 100' }
  const sum = vals.reduce((a, b) => a + b, 0)
  if (Math.round(sum) !== 100) return { ok: false, error: `Shares must total 100% (currently ${sum})` }
  if (input.workerSharePct < 50) return { ok: false, error: 'Worker share below 50% violates cooperative fairness policy' }
  return { ok: true }
}
