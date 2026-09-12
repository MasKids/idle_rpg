import { getCommon, getGrowthCurveConfig, getString, getWeaponTypePrimaryStat, WEAPON_TYPES, type WeaponTypeEnum } from './balance'
import type { StatKey, WeaponMasteryData } from '../types/game'

const STAT_TYPE_TO_KEY: Record<string, StatKey> = {
  ATK: 'atk',
  ASPD: 'aspd',
  CRIT: 'crit',
  CRIT_DMG: 'critDmg',
  EXIST_GAIN: 'existGain',
}

// 이 무기 종류의 숙련이 실제로 곱해지는 대상 스탯 (검=ATK, 창=ASPD, 활=CRIT)
export function masteryPrimaryStat(weaponType: string): StatKey {
  const primaryStat = getWeaponTypePrimaryStat(weaponType as WeaponTypeEnum)
  return STAT_TYPE_TO_KEY[primaryStat] ?? 'atk'
}

// MasteryTable 삭제(2026-09-10 개편) — 3행 전부 MultiplierPerLevel/CurveKey/MaxLevel이
// 동일했던(WeaponType/Name만 다른) 값이라, 숫자 둘은 CommonTable로, 3종류 고정이라
// 테이블화할 실익이 없는 CurveKey와 이름 StringId는 코드 상수로 옮겼다.
const MASTERY_CURVE_KEY = 'MASTERY_UPGRADE'
const MASTERY_NAME_STRING_ID: Record<WeaponTypeEnum, number> = {
  Sword: 40072,
  Spear: 40073,
  Bow: 40074,
  Axe: 40139,
  Staff: 40140,
}

// 무기 숙련 — 종류(검/창/활)별로 하나씩. WeaponMasteryData.id에는 WeaponTypeEnum
// 값('Sword' 등)이 그대로 들어간다.
export const MASTERY_WEAPONS: WeaponMasteryData[] = WEAPON_TYPES.map((weaponType) => ({
  id: weaponType,
  name: getString(MASTERY_NAME_STRING_ID[weaponType], 'KOR', weaponType),
}))

// weaponType은 WeaponMasteryData.id(문자열)를 그대로 받아 내부에서 캐스팅한다 —
// 기존 masteryUpgradeCost(weaponId: string)와 동일한 호출 관례를 유지.
// v0.3.0 밸런스 개편 — 숙련은 원래도 퍼센트 역할이었지만(레벨당 배율 곱연산)
// 존재력 트리·무기 보유 효과와 같은 "퍼센트 합산" 버킷에 함께 들어가도록,
// 배율(예: 1.25)이 아니라 퍼센트 포인트(레벨당 +5 → 25)를 반환하게 바꿨다.
// 레벨당 실제 성장률(5%)은 그대로다 — CommonTable.MasteryMultiplierPerLevel의
// 단위만 소수(0.05)에서 퍼센트 포인트(5)로 바뀌었다.
export function masteryBonusPercent(_weaponType: string, level: number): number {
  return level * getCommon('MasteryMultiplierPerLevel')
}

export function masteryUpgradeCost(_weaponType: string, currentLevel: number): number {
  const curve = getGrowthCurveConfig(MASTERY_CURVE_KEY)
  return Math.floor(curve.CostBase * curve.CostGrowthRate ** currentLevel)
}
