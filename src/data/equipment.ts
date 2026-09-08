import { getMasteryConfig, getString } from './balance'
import type { WeaponMasteryData } from '../types/game'

// 무기 숙련 — MasteryTable 행 하나당 무기 1종. WeaponId(숫자)를 문자열로 캐스팅해 내부 키로 쓴다.
const MASTERY_WEAPON_IDS = [1]

export const MASTERY_WEAPONS: WeaponMasteryData[] = MASTERY_WEAPON_IDS.map((weaponId) => {
  const config = getMasteryConfig(weaponId)
  return { id: String(weaponId), name: getString(config.Name, 'KOR') }
})

export function masteryAtkMultiplier(weaponId: string, level: number): number {
  const config = getMasteryConfig(Number(weaponId))
  return 1 + level * config.AtkMultiplierPerLevel
}

export function masteryUpgradeCost(weaponId: string, currentLevel: number): number {
  const config = getMasteryConfig(Number(weaponId))
  return Math.floor(config.CostBase * config.CostGrowthRate ** currentLevel)
}
