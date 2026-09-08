import { getEquipmentConfig, getMasteryConfig, getString, type EquipSlotEnum } from './balance'
import type { EquipmentSlotData, EquipmentSlotId, WeaponMasteryData } from '../types/game'

const EQUIP_SLOT_BY_ID: Record<EquipmentSlotId, EquipSlotEnum> = {
  weapon: 'Weapon',
  helmet: 'Helmet',
  armor: 'Armor',
  gloves: 'Gloves',
  boots: 'Boots',
}

const SLOT_ORDER: EquipmentSlotId[] = ['weapon', 'helmet', 'armor', 'gloves', 'boots']

export const EQUIPMENT_SLOTS: EquipmentSlotData[] = SLOT_ORDER.map((id) => {
  const config = getEquipmentConfig(EQUIP_SLOT_BY_ID[id])
  return {
    id,
    label: getString(config.Name, 'KOR'),
    stat: config.StatType === 'DEF' ? 'def' : 'atk',
  }
})

export function equipmentValuePerLevel(slotId: EquipmentSlotId): number {
  return getEquipmentConfig(EQUIP_SLOT_BY_ID[slotId]).ValuePerLevel
}

export function equipmentUpgradeCost(slotId: EquipmentSlotId, currentLevel: number): number {
  const config = getEquipmentConfig(EQUIP_SLOT_BY_ID[slotId])
  return Math.floor(config.CostBase * config.CostGrowthRate ** currentLevel)
}

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
