import { getGrowthCurveConfig, getStatConfig, type StatTypeEnum } from './balance'
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
  const curve = getGrowthCurveConfig(config.CurveKey)
  return Math.floor(curve.CostBase * curve.CostGrowthRate ** currentLevel)
}

export function computeStatValue(key: StatKey, level: number): number {
  const config = getStatConfig(STAT_TYPE_BY_KEY[key])
  return config.BaseValue + level * config.ValuePerLevel
}

// 스탯 화면의 구성 분해 표시("1,250 = (100 + 400) × 2.5")용 — 깡스탯 합계에서
// "기본값" 부분만 따로 떼어 보여주기 위해 필요하다.
export function getStatBaseValue(key: StatKey): number {
  return getStatConfig(STAT_TYPE_BY_KEY[key]).BaseValue
}
