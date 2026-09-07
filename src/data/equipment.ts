import type { EquipmentSlotData, WeaponMasteryData } from '../types/game'

export const EQUIPMENT_SLOTS: EquipmentSlotData[] = [
  { id: 'weapon', label: '무기', stat: 'atk' },
  { id: 'helmet', label: '투구', stat: 'def' },
  { id: 'armor', label: '갑옷', stat: 'def' },
  { id: 'gloves', label: '장갑', stat: 'atk' },
  { id: 'boots', label: '신발', stat: 'def' },
]

// 레벨당 상승치 / 강화 비용(GOLD) 곡선 — 1차 초안, 실측 후 밸런싱 대상
const EQUIPMENT_VALUE_PER_LEVEL = 2
const EQUIPMENT_COST_BASE = 15
const EQUIPMENT_COST_GROWTH = 1.22

export function equipmentValuePerLevel(): number {
  return EQUIPMENT_VALUE_PER_LEVEL
}

export function equipmentUpgradeCost(currentLevel: number): number {
  return Math.floor(EQUIPMENT_COST_BASE * EQUIPMENT_COST_GROWTH ** currentLevel)
}

// 무기 숙련 — 1종만 정의. 배열이라 나중에 추가 가능
export const MASTERY_WEAPONS: WeaponMasteryData[] = [{ id: 'sword', name: '기본 검' }]

// 레벨당 ATK 배율 상승 / 숙련 비용(MASTERY_ESSENCE) 곡선 — 1차 초안, 실측 후 밸런싱 대상
const MASTERY_MULTIPLIER_PER_LEVEL = 0.05
const MASTERY_COST_BASE = 10
const MASTERY_COST_GROWTH = 1.25

export function masteryAtkMultiplier(level: number): number {
  return 1 + level * MASTERY_MULTIPLIER_PER_LEVEL
}

export function masteryUpgradeCost(currentLevel: number): number {
  return Math.floor(MASTERY_COST_BASE * MASTERY_COST_GROWTH ** currentLevel)
}
