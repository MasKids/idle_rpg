import { BALANCE } from './balance'
import type { StatKey } from '../types/game'

const { stats } = BALANCE

export const STAT_BASE: Record<StatKey, number> = {
  atk: stats.statBaseAtk,
  def: stats.statBaseDef,
  aspd: stats.statBaseAspd,
  crit: stats.statBaseCrit,
  critDmg: stats.statBaseCritDmg,
  existGain: stats.statBaseExistGain,
}

export const STAT_GROWTH_PER_LEVEL: Record<StatKey, number> = {
  atk: stats.statGrowthAtk,
  def: stats.statGrowthDef,
  aspd: stats.statGrowthAspd,
  crit: stats.statGrowthCrit,
  critDmg: stats.statGrowthCritDmg,
  existGain: stats.statGrowthExistGain,
}

export function statUpgradeCost(currentLevel: number): number {
  return Math.floor(stats.statUpgradeCostBase * stats.statUpgradeCostGrowth ** currentLevel)
}

export function computeStatValue(key: StatKey, level: number): number {
  return STAT_BASE[key] + level * STAT_GROWTH_PER_LEVEL[key]
}
