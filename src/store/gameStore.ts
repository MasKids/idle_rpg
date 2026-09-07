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
import { computeTimeHeistPreview, timeHeistCooldownEndsAt } from '../systems/timeheist/timeHeist'
import { flushSave, loadGameState, scheduleSave } from './gameStateStorage'
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
const persistedGame = loadGameState()

// 오프라인 보상 등 미래 기능이 참고할 "이전 세션이 저장된 시각".
// persistedGame은 로드 직후 스토어가 즉시 새 시각으로 덮어쓰므로 별도로 남겨둔다.
export const lastSessionEndedAt: number | null = persistedGame?.lastActiveAt ?? null

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
  timeHeistLastUsedAt: number | null

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

const startStatLevels = persistedGame?.statLevels ?? initialStatLevels
const startEquipmentLevels = persistedGame?.equipmentLevels ?? initialEquipmentLevels
const startMasteryLevels = persistedGame?.masteryLevels ?? initialMasteryLevels
const startExistTreeStatBonus = persistedGame?.existTreeStatBonus ?? initialExistTreeStatBonus
const startStage = persistedGame?.currentStage ?? INITIAL_STAGE

export const useGameStore = create<GameState>((set, get) => ({
  currencies: persistedGame?.currencies ?? {
    exist: 0,
    growthEnergy: 0,
    timeEnergy: 0,
    gold: 0,
    essence: 0,
  },
  statLevels: startStatLevels,
  equipmentLevels: startEquipmentLevels,
  masteryLevels: startMasteryLevels,
  existTreeStatBonus: startExistTreeStatBonus,
  stats: computeEffectiveStats(startStatLevels, startEquipmentLevels, startMasteryLevels, startExistTreeStatBonus),
  currentStage: startStage,
  battle: persistedGame?.battle ?? battleStateForStage(startStage),
  lastHit: null,
  unlockedCount: persistedGame?.unlockedCount ?? 0,
  specialUnlocks: persistedGame?.specialUnlocks ?? {
    reverse: false,
    timeHeist: false,
  },
  rebirthSpent: persistedGame?.rebirthSpent ?? initialRebirthSpent,
  timeHeistUsedCount: persistedGame?.timeHeistUsedCount ?? 0,
  timeHeistLastUsedAt: persistedGame?.timeHeistLastUsedAt ?? null,

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
      timeHeistLastUsedAt: null,
    }))
  },

  executeTimeHeist: () => {
    if (!get().specialUnlocks.timeHeist) return false

    const usedCount = get().timeHeistUsedCount
    const lastUsedAt = get().timeHeistLastUsedAt
    const cooldownEndsAt = timeHeistCooldownEndsAt(usedCount, lastUsedAt)
    if (cooldownEndsAt !== null && Date.now() < cooldownEndsAt) return false

    const preview = computeTimeHeistPreview(get().currentStage, get().stats.existGain, usedCount)
    if (!get().spendCurrency('timeEnergy', preview.cost)) return false

    get().addCurrency('gold', preview.rewards.gold)
    get().addCurrency('growthEnergy', preview.rewards.growthEnergy)
    get().addCurrency('exist', preview.rewards.exist)

    set({ timeHeistUsedCount: usedCount + 1, timeHeistLastUsedAt: Date.now() })

    return true
  },

  resetTimeHeistCooldown: () => set({ timeHeistLastUsedAt: null }),

  resetTimeHeistUsedCount: () => set({ timeHeistUsedCount: 0, timeHeistLastUsedAt: null }),
}))

// 상태가 바뀔 때마다(전투 틱 포함) 전체 진행 상태를 debounce 저장 큐에 올린다.
// 실제 localStorage 쓰기는 gameStateStorage.ts에서 일정 주기로 묶어서 처리한다.
useGameStore.subscribe((state) => {
  scheduleSave({
    currencies: state.currencies,
    statLevels: state.statLevels,
    equipmentLevels: state.equipmentLevels,
    masteryLevels: state.masteryLevels,
    existTreeStatBonus: state.existTreeStatBonus,
    currentStage: state.currentStage,
    battle: state.battle,
    unlockedCount: state.unlockedCount,
    specialUnlocks: state.specialUnlocks,
    rebirthSpent: state.rebirthSpent,
    timeHeistUsedCount: state.timeHeistUsedCount,
    timeHeistLastUsedAt: state.timeHeistLastUsedAt,
    lastActiveAt: Date.now(),
  })
})

// 새로고침/탭 종료 직전에 대기 중인 저장을 즉시 반영해 최대 2초 분량 유실을 막는다.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushSave)
}

// 개발 중 테스트 편의용: 브라우저 콘솔에서 __gameStore.getState().addCurrency('exist', 100000) 처럼 호출
if (import.meta.env.DEV) {
  ;(globalThis as typeof globalThis & { __gameStore?: typeof useGameStore }).__gameStore = useGameStore
}
