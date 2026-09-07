import { create } from 'zustand'
import {
  EQUIPMENT_SLOTS,
  equipmentUpgradeCost,
  equipmentValuePerLevel,
  MASTERY_WEAPONS,
  masteryAtkMultiplier,
  masteryUpgradeCost,
} from '../data/equipment'
import { EXIST_SPECIAL_UNLOCKS, generateExistTree } from '../data/existTree'
import { generateStage, killsRequiredForStage } from '../data/stages'
import { computeStatValue, statUpgradeCost } from '../data/stats'
import { computeTimeHeistPreview, timeHeistCooldownMs } from '../systems/timeheist/timeHeist'
import { loadTimeHeistState, saveTimeHeistState } from '../systems/timeheist/timeHeistStorage'
import type {
  BattleHit,
  BattleState,
  CurrencyKey,
  EquipmentSlotId,
  RebirthSpentTotals,
  SpecialUnlockId,
  StatKey,
} from '../types/game'

const INITIAL_STAGE = 1
const EXIST_TREE_NODES = generateExistTree()
const persistedTimeHeist = loadTimeHeistState()

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

// 성장 스탯 + 존재력 트리 영구 보너스(가산) + 장비 보너스(가산)
// + 무기 숙련 배율(곱연산, ATK만)을 합친 최종 전투 스탯
function computeEffectiveStats(
  statLevels: Record<StatKey, number>,
  equipmentLevels: Record<EquipmentSlotId, number>,
  masteryLevels: Record<string, number>,
  existTreeBonus: Record<StatKey, number>,
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

  const combined: Record<StatKey, number> = {
    atk: base.atk + equipmentAtk + existTreeBonus.atk,
    def: base.def + equipmentDef + existTreeBonus.def,
    aspd: base.aspd + existTreeBonus.aspd,
    crit: base.crit + existTreeBonus.crit,
    critDmg: base.critDmg + existTreeBonus.critDmg,
    existGain: base.existGain + existTreeBonus.existGain,
  }
  combined.atk *= masteryMultiplier

  return combined
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
  existTreeStatBonus: Record<StatKey, number>
  stats: Record<StatKey, number>
  currentStage: number
  battle: BattleState
  lastHit: BattleHit | null
  unlockedCount: number
  specialUnlocks: Record<SpecialUnlockId, boolean>
  rebirthSpent: RebirthSpentTotals
  timeHeistUsedCount: number
  timeHeistCooldownEndsAt: number | null

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
  unlockNextExistNode: () => boolean
  unlockSpecial: (id: SpecialUnlockId) => boolean
  executeRebirth: () => void
  executeTimeHeist: () => boolean
  resetTimeHeistCooldown: () => void
  resetTimeHeistUsedCount: () => void
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

const initialRebirthSpent: RebirthSpentTotals = {
  growthEnergy: 0,
  gold: 0,
  essence: 0,
}

const initialExistTreeStatBonus: Record<StatKey, number> = {
  atk: 0,
  def: 0,
  aspd: 0,
  crit: 0,
  critDmg: 0,
  existGain: 0,
}

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
  existTreeStatBonus: initialExistTreeStatBonus,
  stats: computeEffectiveStats(
    initialStatLevels,
    initialEquipmentLevels,
    initialMasteryLevels,
    initialExistTreeStatBonus,
  ),
  currentStage: INITIAL_STAGE,
  battle: battleStateForStage(INITIAL_STAGE),
  lastHit: null,
  unlockedCount: 0,
  specialUnlocks: {
    reverse: false,
    timeHeist: false,
  },
  rebirthSpent: initialRebirthSpent,
  timeHeistUsedCount: persistedTimeHeist.usedCount,
  timeHeistCooldownEndsAt: persistedTimeHeist.cooldownEndsAt,

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
      return {
        statLevels,
        stats: computeEffectiveStats(statLevels, state.equipmentLevels, state.masteryLevels, state.existTreeStatBonus),
        rebirthSpent: { ...state.rebirthSpent, growthEnergy: state.rebirthSpent.growthEnergy + cost },
      }
    })
    return true
  },

  maxUpgradeAll: () => {
    const order: StatKey[] = ['atk', 'def', 'aspd', 'crit', 'critDmg', 'existGain']
    const statLevels = { ...get().statLevels }
    let growthEnergy = get().currencies.growthEnergy
    const startingGrowthEnergy = growthEnergy

    for (const key of order) {
      let level = statLevels[key]
      while (growthEnergy >= statUpgradeCost(level)) {
        growthEnergy -= statUpgradeCost(level)
        level += 1
      }
      statLevels[key] = level
    }

    const spent = startingGrowthEnergy - growthEnergy

    set((state) => ({
      statLevels,
      stats: computeEffectiveStats(statLevels, state.equipmentLevels, state.masteryLevels, state.existTreeStatBonus),
      currencies: { ...state.currencies, growthEnergy },
      rebirthSpent: { ...state.rebirthSpent, growthEnergy: state.rebirthSpent.growthEnergy + spent },
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
        stats: computeEffectiveStats(state.statLevels, equipmentLevels, state.masteryLevels, state.existTreeStatBonus),
        rebirthSpent: { ...state.rebirthSpent, gold: state.rebirthSpent.gold + cost },
      }
    })
    return true
  },

  maxUpgradeEquipment: () => {
    const equipmentLevels = { ...get().equipmentLevels }
    let gold = get().currencies.gold
    const startingGold = gold

    for (const slot of EQUIPMENT_SLOTS) {
      let level = equipmentLevels[slot.id]
      while (gold >= equipmentUpgradeCost(level)) {
        gold -= equipmentUpgradeCost(level)
        level += 1
      }
      equipmentLevels[slot.id] = level
    }

    const spent = startingGold - gold

    set((state) => ({
      equipmentLevels,
      stats: computeEffectiveStats(state.statLevels, equipmentLevels, state.masteryLevels, state.existTreeStatBonus),
      currencies: { ...state.currencies, gold },
      rebirthSpent: { ...state.rebirthSpent, gold: state.rebirthSpent.gold + spent },
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
        stats: computeEffectiveStats(state.statLevels, state.equipmentLevels, masteryLevels, state.existTreeStatBonus),
        rebirthSpent: { ...state.rebirthSpent, essence: state.rebirthSpent.essence + cost },
      }
    })
    return true
  },

  maxUpgradeMastery: () => {
    const masteryLevels = { ...get().masteryLevels }
    let essence = get().currencies.essence
    const startingEssence = essence

    for (const weapon of MASTERY_WEAPONS) {
      let level = masteryLevels[weapon.id] ?? 0
      while (essence >= masteryUpgradeCost(level)) {
        essence -= masteryUpgradeCost(level)
        level += 1
      }
      masteryLevels[weapon.id] = level
    }

    const spent = startingEssence - essence

    set((state) => ({
      masteryLevels,
      stats: computeEffectiveStats(state.statLevels, state.equipmentLevels, masteryLevels, state.existTreeStatBonus),
      currencies: { ...state.currencies, essence },
      rebirthSpent: { ...state.rebirthSpent, essence: state.rebirthSpent.essence + spent },
    }))
  },

  setStage: (stage) => set({ currentStage: stage }),

  setBattle: (battle) => set({ battle }),

  unlockNextExistNode: () => {
    const order = get().unlockedCount + 1
    const node = EXIST_TREE_NODES[order - 1]
    if (!node) return false
    if (!get().spendCurrency('exist', node.cost)) return false

    const effect = node.effect
    if (effect.kind === 'currency') {
      get().addCurrency(effect.currency, effect.amount)
      set((state) => ({ unlockedCount: state.unlockedCount + 1 }))
    } else {
      set((state) => {
        const existTreeStatBonus = {
          ...state.existTreeStatBonus,
          [effect.stat]: state.existTreeStatBonus[effect.stat] + effect.value,
        }
        return {
          unlockedCount: state.unlockedCount + 1,
          existTreeStatBonus,
          stats: computeEffectiveStats(state.statLevels, state.equipmentLevels, state.masteryLevels, existTreeStatBonus),
        }
      })
    }

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

  executeRebirth: () => {
    set((state) => ({
      currentStage: INITIAL_STAGE,
      battle: battleStateForStage(INITIAL_STAGE),
      statLevels: initialStatLevels,
      equipmentLevels: initialEquipmentLevels,
      masteryLevels: initialMasteryLevels,
      stats: computeEffectiveStats(
        initialStatLevels,
        initialEquipmentLevels,
        initialMasteryLevels,
        state.existTreeStatBonus,
      ),
      currencies: {
        ...state.currencies,
        growthEnergy: state.currencies.growthEnergy + state.rebirthSpent.growthEnergy,
        gold: state.currencies.gold + state.rebirthSpent.gold,
        essence: state.currencies.essence + state.rebirthSpent.essence,
      },
      rebirthSpent: initialRebirthSpent,
      timeHeistUsedCount: 0,
      timeHeistCooldownEndsAt: null,
    }))
    saveTimeHeistState({ usedCount: 0, cooldownEndsAt: null })
  },

  executeTimeHeist: () => {
    if (!get().specialUnlocks.timeHeist) return false

    const usedCount = get().timeHeistUsedCount
    const cooldownEndsAt = get().timeHeistCooldownEndsAt
    if (cooldownEndsAt !== null && Date.now() < cooldownEndsAt) return false

    const preview = computeTimeHeistPreview(get().currentStage, get().stats.existGain, usedCount)
    if (!get().spendCurrency('timeEnergy', preview.cost)) return false

    get().addCurrency('gold', preview.rewards.gold)
    get().addCurrency('growthEnergy', preview.rewards.growthEnergy)
    get().addCurrency('exist', preview.rewards.exist)

    const nextUsedCount = usedCount + 1
    const nextCooldownEndsAt = Date.now() + timeHeistCooldownMs(usedCount)
    set({ timeHeistUsedCount: nextUsedCount, timeHeistCooldownEndsAt: nextCooldownEndsAt })
    saveTimeHeistState({ usedCount: nextUsedCount, cooldownEndsAt: nextCooldownEndsAt })

    return true
  },

  resetTimeHeistCooldown: () => {
    set({ timeHeistCooldownEndsAt: null })
    saveTimeHeistState({ usedCount: get().timeHeistUsedCount, cooldownEndsAt: null })
  },

  resetTimeHeistUsedCount: () => {
    set({ timeHeistUsedCount: 0 })
    saveTimeHeistState({ usedCount: 0, cooldownEndsAt: get().timeHeistCooldownEndsAt })
  },
}))

// 개발 중 테스트 편의용: 브라우저 콘솔에서 __gameStore.getState().addCurrency('exist', 100000) 처럼 호출
if (import.meta.env.DEV) {
  ;(globalThis as typeof globalThis & { __gameStore?: typeof useGameStore }).__gameStore = useGameStore
}
