import { create } from 'zustand'
import {
  EQUIPMENT_SLOTS,
  equipmentUpgradeCost,
  equipmentValuePerLevel,
  MASTERY_WEAPONS,
  masteryAtkMultiplier,
  masteryUpgradeCost,
} from '../data/equipment'
import { EXIST_SPECIAL_UNLOCKS } from '../data/existTree'
import { generateStage, killsRequiredForStage } from '../data/stages'
import { computeStatValue, statUpgradeCost } from '../data/stats'
import type { BattleState, CurrencyKey, EquipmentSlotId, SpecialUnlockId, StatKey } from '../types/game'

const INITIAL_STAGE = 1

function baseStatsFromLevels(levels: Record<StatKey, number>): Record<StatKey, number> {
  return {
    atk: computeStatValue('atk', levels.atk),
    def: computeStatValue('def', levels.def),
    aspd: computeStatValue('aspd', levels.aspd),
    crit: computeStatValue('crit', levels.crit),
    critDmg: computeStatValue('critDmg', levels.critDmg),
    existGain: computeStatValue('existGain', levels.existGain),
  }
}

// 성장 스탯 + 장비 보너스(가산) + 무기 숙련 배율(곱연산, ATK만)을 합친 최종 전투 스탯
function computeEffectiveStats(
  statLevels: Record<StatKey, number>,
  equipmentLevels: Record<EquipmentSlotId, number>,
  masteryLevels: Record<string, number>,
): Record<StatKey, number> {
  const base = baseStatsFromLevels(statLevels)

  let equipmentAtk = 0
  let equipmentDef = 0
  for (const slot of EQUIPMENT_SLOTS) {
    const bonus = equipmentLevels[slot.id] * equipmentValuePerLevel()
    if (slot.stat === 'atk') equipmentAtk += bonus
    else equipmentDef += bonus
  }

  const primaryWeapon = MASTERY_WEAPONS[0]
  const masteryMultiplier = primaryWeapon ? masteryAtkMultiplier(masteryLevels[primaryWeapon.id] ?? 0) : 1

  return {
    ...base,
    atk: (base.atk + equipmentAtk) * masteryMultiplier,
    def: base.def + equipmentDef,
  }
}

function battleStateForStage(stage: number): BattleState {
  const data = generateStage(stage)
  return {
    stage,
    enemyMaxHp: data.enemyHp,
    enemyHp: data.enemyHp,
    isBossStage: data.isBoss,
    kills: 0,
    killsRequired: killsRequiredForStage(stage),
  }
}

interface GameState {
  currencies: Record<CurrencyKey, number>
  statLevels: Record<StatKey, number>
  equipmentLevels: Record<EquipmentSlotId, number>
  masteryLevels: Record<string, number>
  stats: Record<StatKey, number>
  currentStage: number
  battle: BattleState
  unlockedCount: number
  specialUnlocks: Record<SpecialUnlockId, boolean>

  addCurrency: (key: CurrencyKey, amount: number) => void
  spendCurrency: (key: CurrencyKey, amount: number) => boolean
  upgradeStat: (key: StatKey) => boolean
  maxUpgradeAll: () => void
  upgradeEquipment: (slotId: EquipmentSlotId) => boolean
  maxUpgradeEquipment: () => void
  upgradeMastery: (weaponId: string) => boolean
  maxUpgradeMastery: () => void
  setStage: (stage: number) => void
  setBattle: (battle: BattleState) => void
  unlockNextExistNode: (cost: number) => boolean
  unlockSpecial: (id: SpecialUnlockId) => boolean
}

const initialStatLevels: Record<StatKey, number> = {
  atk: 0,
  def: 0,
  aspd: 0,
  crit: 0,
  critDmg: 0,
  existGain: 0,
}

const initialEquipmentLevels: Record<EquipmentSlotId, number> = {
  weapon: 0,
  helmet: 0,
  armor: 0,
  gloves: 0,
  boots: 0,
}

const initialMasteryLevels: Record<string, number> = Object.fromEntries(
  MASTERY_WEAPONS.map((weapon) => [weapon.id, 0]),
)

export const useGameStore = create<GameState>((set, get) => ({
  currencies: {
    exist: 0,
    growthEnergy: 0,
    timeEnergy: 0,
    gold: 0,
    essence: 0,
  },
  statLevels: initialStatLevels,
  equipmentLevels: initialEquipmentLevels,
  masteryLevels: initialMasteryLevels,
  stats: computeEffectiveStats(initialStatLevels, initialEquipmentLevels, initialMasteryLevels),
  currentStage: INITIAL_STAGE,
  battle: battleStateForStage(INITIAL_STAGE),
  unlockedCount: 0,
  specialUnlocks: {
    reverse: false,
    timeHeist: false,
  },

  addCurrency: (key, amount) =>
    set((state) => ({
      currencies: { ...state.currencies, [key]: state.currencies[key] + amount },
    })),

  spendCurrency: (key, amount) => {
    if (get().currencies[key] < amount) return false
    set((state) => ({
      currencies: { ...state.currencies, [key]: state.currencies[key] - amount },
    }))
    return true
  },

  upgradeStat: (key) => {
    const level = get().statLevels[key]
    const cost = statUpgradeCost(level)
    if (!get().spendCurrency('growthEnergy', cost)) return false

    set((state) => {
      const statLevels = { ...state.statLevels, [key]: level + 1 }
      return { statLevels, stats: computeEffectiveStats(statLevels, state.equipmentLevels, state.masteryLevels) }
    })
    return true
  },

  maxUpgradeAll: () => {
    const order: StatKey[] = ['atk', 'def', 'aspd', 'crit', 'critDmg', 'existGain']
    const statLevels = { ...get().statLevels }
    let growthEnergy = get().currencies.growthEnergy

    for (const key of order) {
      let level = statLevels[key]
      while (growthEnergy >= statUpgradeCost(level)) {
        growthEnergy -= statUpgradeCost(level)
        level += 1
      }
      statLevels[key] = level
    }

    set((state) => ({
      statLevels,
      stats: computeEffectiveStats(statLevels, state.equipmentLevels, state.masteryLevels),
      currencies: { ...state.currencies, growthEnergy },
    }))
  },

  upgradeEquipment: (slotId) => {
    const level = get().equipmentLevels[slotId]
    const cost = equipmentUpgradeCost(level)
    if (!get().spendCurrency('gold', cost)) return false

    set((state) => {
      const equipmentLevels = { ...state.equipmentLevels, [slotId]: level + 1 }
      return {
        equipmentLevels,
        stats: computeEffectiveStats(state.statLevels, equipmentLevels, state.masteryLevels),
      }
    })
    return true
  },

  maxUpgradeEquipment: () => {
    const equipmentLevels = { ...get().equipmentLevels }
    let gold = get().currencies.gold

    for (const slot of EQUIPMENT_SLOTS) {
      let level = equipmentLevels[slot.id]
      while (gold >= equipmentUpgradeCost(level)) {
        gold -= equipmentUpgradeCost(level)
        level += 1
      }
      equipmentLevels[slot.id] = level
    }

    set((state) => ({
      equipmentLevels,
      stats: computeEffectiveStats(state.statLevels, equipmentLevels, state.masteryLevels),
      currencies: { ...state.currencies, gold },
    }))
  },

  upgradeMastery: (weaponId) => {
    const level = get().masteryLevels[weaponId] ?? 0
    const cost = masteryUpgradeCost(level)
    if (!get().spendCurrency('essence', cost)) return false

    set((state) => {
      const masteryLevels = { ...state.masteryLevels, [weaponId]: level + 1 }
      return {
        masteryLevels,
        stats: computeEffectiveStats(state.statLevels, state.equipmentLevels, masteryLevels),
      }
    })
    return true
  },

  maxUpgradeMastery: () => {
    const masteryLevels = { ...get().masteryLevels }
    let essence = get().currencies.essence

    for (const weapon of MASTERY_WEAPONS) {
      let level = masteryLevels[weapon.id] ?? 0
      while (essence >= masteryUpgradeCost(level)) {
        essence -= masteryUpgradeCost(level)
        level += 1
      }
      masteryLevels[weapon.id] = level
    }

    set((state) => ({
      masteryLevels,
      stats: computeEffectiveStats(state.statLevels, state.equipmentLevels, masteryLevels),
      currencies: { ...state.currencies, essence },
    }))
  },

  setStage: (stage) => set({ currentStage: stage }),

  setBattle: (battle) => set({ battle }),

  unlockNextExistNode: (cost) => {
    if (!get().spendCurrency('exist', cost)) return false
    set((state) => ({ unlockedCount: state.unlockedCount + 1 }))
    return true
  },

  unlockSpecial: (id) => {
    if (get().specialUnlocks[id]) return false
    const unlock = EXIST_SPECIAL_UNLOCKS.find((entry) => entry.id === id)
    if (!unlock) return false
    if (get().unlockedCount < unlock.requiredUnlockedCount) return false
    if (!get().spendCurrency('exist', unlock.cost)) return false

    set((state) => ({
      specialUnlocks: { ...state.specialUnlocks, [id]: true },
    }))
    return true
  },
}))
