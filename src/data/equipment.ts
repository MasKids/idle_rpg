import { BALANCE } from './balance'
import type { EquipmentSlotData, WeaponMasteryData } from '../types/game'

const { equipmentMastery } = BALANCE

export const EQUIPMENT_SLOTS: EquipmentSlotData[] = [
  { id: 'weapon', label: '무기', stat: 'atk' },
  { id: 'helmet', label: '투구', stat: 'def' },
  { id: 'armor', label: '갑옷', stat: 'def' },
  { id: 'gloves', label: '장갑', stat: 'atk' },
  { id: 'boots', label: '신발', stat: 'def' },
]

export function equipmentValuePerLevel(): number {
  return equipmentMastery.equipmentValuePerLevel
}

export function equipmentUpgradeCost(currentLevel: number): number {
  return Math.floor(equipmentMastery.equipmentCostBase * equipmentMastery.equipmentCostGrowth ** currentLevel)
}

// 무기 숙련 — 1종만 정의. 배열이라 나중에 추가 가능
export const MASTERY_WEAPONS: WeaponMasteryData[] = [{ id: 'sword', name: '기본 검' }]

export function masteryAtkMultiplier(level: number): number {
  return 1 + level * equipmentMastery.masteryMultiplierPerLevel
}

export function masteryUpgradeCost(currentLevel: number): number {
  return Math.floor(equipmentMastery.masteryCostBase * equipmentMastery.masteryCostGrowth ** currentLevel)
}
