import type { StatKey } from '../../types/game'

export interface DamageResult {
  amount: number
  isCrit: boolean
}

export function calculateDamage(stats: Record<StatKey, number>): DamageResult {
  const isCrit = Math.random() * 100 < stats.crit
  const amount = Math.max(1, Math.round(isCrit ? stats.atk * (stats.critDmg / 100) : stats.atk))
  return { amount, isCrit }
}
