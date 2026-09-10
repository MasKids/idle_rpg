import { getStatConfig, type StatTypeEnum } from './balance'
import type { StatKey } from '../types/game'

const STAT_TYPE_BY_KEY: Record<StatKey, StatTypeEnum> = {
  atk: 'ATK',
  aspd: 'ASPD',
  crit: 'CRIT',
  critDmg: 'CRIT_DMG',
  existGain: 'EXIST_GAIN',
}

export function statUpgradeCost(key: StatKey, currentLevel: number): number {
  const config = getStatConfig(STAT_TYPE_BY_KEY[key])
  return Math.floor(config.CostBase * config.CostGrowthRate ** currentLevel)
}

export function computeStatValue(key: StatKey, level: number): number {
  const config = getStatConfig(STAT_TYPE_BY_KEY[key])
  return config.BaseValue + level * config.ValuePerLevel
}
