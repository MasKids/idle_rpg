import type { StatKey } from '../types/game'

export const STAT_BASE: Record<StatKey, number> = {
  atk: 1,
  def: 1,
  aspd: 1,
  crit: 0,
  critDmg: 150,
  existGain: 1,
}

// 레벨당 상승치 — 1차 초안, 실측 후 밸런싱 대상
export const STAT_GROWTH_PER_LEVEL: Record<StatKey, number> = {
  atk: 1,
  def: 1,
  aspd: 0.05,
  crit: 0.5,
  critDmg: 2,
  existGain: 0.02,
}

const UPGRADE_COST_BASE = 8
const UPGRADE_COST_GROWTH = 1.18

export function statUpgradeCost(currentLevel: number): number {
  return Math.floor(UPGRADE_COST_BASE * UPGRADE_COST_GROWTH ** currentLevel)
}

export function computeStatValue(key: StatKey, level: number): number {
  return STAT_BASE[key] + level * STAT_GROWTH_PER_LEVEL[key]
}
