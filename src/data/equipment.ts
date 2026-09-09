import { getMasteryConfig, getString, getWeaponTypeConfig, type WeaponTypeEnum } from './balance'
import type { StatKey, WeaponMasteryData } from '../types/game'

const STAT_TYPE_TO_KEY: Record<string, StatKey> = {
  ATK: 'atk',
  DEF: 'def',
  ASPD: 'aspd',
  CRIT: 'crit',
  CRIT_DMG: 'critDmg',
  EXIST_GAIN: 'existGain',
}

// 이 무기 종류의 숙련이 실제로 곱해지는 대상 스탯 (검=ATK, 창=ASPD, 활=CRIT)
export function masteryPrimaryStat(weaponType: string): StatKey {
  const config = getWeaponTypeConfig(weaponType as WeaponTypeEnum)
  return STAT_TYPE_TO_KEY[config.PrimaryStat] ?? 'atk'
}

const WEAPON_TYPES: WeaponTypeEnum[] = ['Sword', 'Spear', 'Bow']

// 무기 숙련 — 종류(검/창/활)별로 하나씩. MasteryTable 행 하나당 무기 종류 1개.
// WeaponMasteryData.id에는 WeaponTypeEnum 값('Sword' 등)이 그대로 들어간다.
export const MASTERY_WEAPONS: WeaponMasteryData[] = WEAPON_TYPES.map((weaponType) => {
  const config = getMasteryConfig(weaponType)
  return { id: weaponType, name: getString(config.Name, 'KOR', weaponType) }
})

// weaponType은 WeaponMasteryData.id(문자열)를 그대로 받아 내부에서 캐스팅한다 —
// 기존 masteryUpgradeCost(weaponId: string)와 동일한 호출 관례를 유지.
export function masteryMultiplier(weaponType: string, level: number): number {
  const config = getMasteryConfig(weaponType as WeaponTypeEnum)
  return 1 + level * config.MultiplierPerLevel
}

export function masteryUpgradeCost(weaponType: string, currentLevel: number): number {
  const config = getMasteryConfig(weaponType as WeaponTypeEnum)
  return Math.floor(config.CostBase * config.CostGrowthRate ** currentLevel)
}
