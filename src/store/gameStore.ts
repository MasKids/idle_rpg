import { create } from 'zustand'
import {
  EQUIPMENT_SLOTS,
  equipmentUpgradeCost,
  equipmentValuePerLevel,
  MASTERY_WEAPONS,
  masteryAtkMultiplier,
  masteryUpgradeCost,
} from '../data/equipment'
import { getCommon, getRebirthConfig } from '../data/balance'
import { EXIST_SPECIAL_UNLOCKS, generateExistTree } from '../data/existTree'
import { generateStage, killsRequiredForStage } from '../data/stages'
import { computeStatValue, statUpgradeCost } from '../data/stats'
import { computeOfflineReward, type OfflineRewardResult } from '../systems/battle/offlineReward'
import { computeAllStatBonusPercent, computeRebirthBonusPoints } from '../systems/rebirth/rebirthBonus'
import { computeTimeHeistPreview, timeHeistCooldownEndsAt } from '../systems/timeheist/timeHeist'
import { debugOverrideLastActiveAt, disableAutosave, flushSave, loadGameState, scheduleSave } from './gameStateStorage'
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

// 오프라인 보상 계산용 "이전 세션이 저장된 시각".
// persistedGame은 로드 직후 스토어가 즉시 새 시각으로 덮어쓰므로 별도로 남겨둔다.
const lastSessionEndedAt: number | null = persistedGame?.lastActiveAt ?? null

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
// + 무기 숙련 배율(곱연산, ATK만) + 리버스 회차 보너스(곱연산, 전 스탯)를 합친 최종 전투 스탯
function computeEffectiveStats(
  statLevels: Record<StatKey, number>,
  equipmentLevels: Record<EquipmentSlotId, number>,
  masteryLevels: Record<string, number>,
  existTreeBonus: Record<StatKey, number>,
  rebirthBonusPoint: number,
): Record<StatKey, number> {
  const base = baseStatsFromLevels(statLevels)

  let equipmentAtk = 0
  let equipmentDef = 0
  for (const slot of EQUIPMENT_SLOTS) {
    const bonus = equipmentLevels[slot.id] * equipmentValuePerLevel(slot.id)
    if (slot.stat === 'atk') equipmentAtk += bonus
    else equipmentDef += bonus
  }

  const primaryWeapon = MASTERY_WEAPONS[0]
  const masteryMultiplier = primaryWeapon
    ? masteryAtkMultiplier(primaryWeapon.id, masteryLevels[primaryWeapon.id] ?? 0)
    : 1

  const combined: Record<StatKey, number> = {
    atk: base.atk + equipmentAtk + existTreeBonus.atk,
    def: base.def + equipmentDef + existTreeBonus.def,
    aspd: base.aspd + existTreeBonus.aspd,
    crit: base.crit + existTreeBonus.crit,
    critDmg: base.critDmg + existTreeBonus.critDmg,
    existGain: base.existGain + existTreeBonus.existGain,
  }
  combined.atk *= masteryMultiplier

  const rebirthMultiplier = 1 + computeAllStatBonusPercent(rebirthBonusPoint) / 100
  combined.atk *= rebirthMultiplier
  combined.def *= rebirthMultiplier
  combined.aspd *= rebirthMultiplier
  combined.crit *= rebirthMultiplier
  combined.critDmg *= rebirthMultiplier
  combined.existGain *= rebirthMultiplier

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
  rebirthCount: number
  rebirthBonusPoint: number
  rebirthMaxStage: number
  timeHeistUsedCount: number
  timeHeistLastUsedAt: number | null
  offlineReward: OfflineRewardResult | null

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
  claimOfflineReward: () => void
  setRebirthBonusPoint: (point: number) => void
  resetRebirthBonus: () => void
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
const startRebirthCount = persistedGame?.rebirthCount ?? 0
const startRebirthBonusPoint = persistedGame?.rebirthBonusPoint ?? 0
const startRebirthMaxStage = Math.max(persistedGame?.rebirthMaxStage ?? startStage, startStage)
const startStats = computeEffectiveStats(
  startStatLevels,
  startEquipmentLevels,
  startMasteryLevels,
  startExistTreeStatBonus,
  startRebirthBonusPoint,
)

// 오프라인 보상은 앱 시작 시 단 한 번, 이전 세션이 끝난 시각과 지금의 차이로 계산한다.
// (스테이지는 그대로 두고 재화만 지급 — 실제 battle 진행에는 영향 없음)
const startOfflineReward =
  lastSessionEndedAt !== null ? computeOfflineReward(Date.now() - lastSessionEndedAt, startStage, startStats) : null

const initialCurrencies: Record<CurrencyKey, number> = {
  exist: getCommon('InitialExist'),
  growthEnergy: getCommon('InitialGrowthEnergy'),
  timeEnergy: getCommon('InitialTimeEnergy'),
  gold: getCommon('InitialGold'),
  essence: getCommon('InitialMasteryEssence'),
}

export const useGameStore = create<GameState>((set, get) => ({
  currencies: persistedGame?.currencies ?? initialCurrencies,
  statLevels: startStatLevels,
  equipmentLevels: startEquipmentLevels,
  masteryLevels: startMasteryLevels,
  existTreeStatBonus: startExistTreeStatBonus,
  stats: startStats,
  currentStage: startStage,
  battle: persistedGame?.battle ?? battleStateForStage(startStage),
  lastHit: null,
  unlockedCount: persistedGame?.unlockedCount ?? 0,
  specialUnlocks: persistedGame?.specialUnlocks ?? {
    reverse: false,
    timeHeist: false,
  },
  rebirthSpent: persistedGame?.rebirthSpent ?? initialRebirthSpent,
  rebirthCount: startRebirthCount,
  rebirthBonusPoint: startRebirthBonusPoint,
  rebirthMaxStage: startRebirthMaxStage,
  timeHeistUsedCount: persistedGame?.timeHeistUsedCount ?? 0,
  timeHeistLastUsedAt: persistedGame?.timeHeistLastUsedAt ?? null,
  offlineReward: startOfflineReward,

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
    const cost = statUpgradeCost(key, level)
    if (!get().spendCurrency('growthEnergy', cost)) return false

    set((state) => {
      const statLevels = { ...state.statLevels, [key]: level + 1 }
      return {
        statLevels,
        stats: computeEffectiveStats(
          statLevels,
          state.equipmentLevels,
          state.masteryLevels,
          state.existTreeStatBonus,
          state.rebirthBonusPoint,
        ),
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
      while (growthEnergy >= statUpgradeCost(key, level)) {
        growthEnergy -= statUpgradeCost(key, level)
        level += 1
      }
      statLevels[key] = level
    }

    const spent = startingGrowthEnergy - growthEnergy

    set((state) => ({
      statLevels,
      stats: computeEffectiveStats(
        statLevels,
        state.equipmentLevels,
        state.masteryLevels,
        state.existTreeStatBonus,
        state.rebirthBonusPoint,
      ),
      currencies: { ...state.currencies, growthEnergy },
      rebirthSpent: { ...state.rebirthSpent, growthEnergy: state.rebirthSpent.growthEnergy + spent },
    }))
  },

  upgradeEquipment: (slotId) => {
    const level = get().equipmentLevels[slotId]
    const cost = equipmentUpgradeCost(slotId, level)
    if (!get().spendCurrency('gold', cost)) return false

    set((state) => {
      const equipmentLevels = { ...state.equipmentLevels, [slotId]: level + 1 }
      return {
        equipmentLevels,
        stats: computeEffectiveStats(
          state.statLevels,
          equipmentLevels,
          state.masteryLevels,
          state.existTreeStatBonus,
          state.rebirthBonusPoint,
        ),
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
      while (gold >= equipmentUpgradeCost(slot.id, level)) {
        gold -= equipmentUpgradeCost(slot.id, level)
        level += 1
      }
      equipmentLevels[slot.id] = level
    }

    const spent = startingGold - gold

    set((state) => ({
      equipmentLevels,
      stats: computeEffectiveStats(
        state.statLevels,
        equipmentLevels,
        state.masteryLevels,
        state.existTreeStatBonus,
        state.rebirthBonusPoint,
      ),
      currencies: { ...state.currencies, gold },
      rebirthSpent: { ...state.rebirthSpent, gold: state.rebirthSpent.gold + spent },
    }))
  },

  upgradeMastery: (weaponId) => {
    const level = get().masteryLevels[weaponId] ?? 0
    const cost = masteryUpgradeCost(weaponId, level)
    if (!get().spendCurrency('essence', cost)) return false

    set((state) => {
      const masteryLevels = { ...state.masteryLevels, [weaponId]: level + 1 }
      return {
        masteryLevels,
        stats: computeEffectiveStats(
          state.statLevels,
          state.equipmentLevels,
          masteryLevels,
          state.existTreeStatBonus,
          state.rebirthBonusPoint,
        ),
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
      while (essence >= masteryUpgradeCost(weapon.id, level)) {
        essence -= masteryUpgradeCost(weapon.id, level)
        level += 1
      }
      masteryLevels[weapon.id] = level
    }

    const spent = startingEssence - essence

    set((state) => ({
      masteryLevels,
      stats: computeEffectiveStats(
        state.statLevels,
        state.equipmentLevels,
        masteryLevels,
        state.existTreeStatBonus,
        state.rebirthBonusPoint,
      ),
      currencies: { ...state.currencies, essence },
      rebirthSpent: { ...state.rebirthSpent, essence: state.rebirthSpent.essence + spent },
    }))
  },

  setStage: (stage) =>
    set((state) => ({
      currentStage: stage,
      rebirthMaxStage: Math.max(state.rebirthMaxStage, stage),
    })),

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
          stats: computeEffectiveStats(
            state.statLevels,
            state.equipmentLevels,
            state.masteryLevels,
            existTreeStatBonus,
            state.rebirthBonusPoint,
          ),
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
    const config = getRebirthConfig()

    set((state) => {
      const earnedBonusPoints = computeRebirthBonusPoints(state.currentStage)
      const nextRebirthBonusPoint = state.rebirthBonusPoint + earnedBonusPoints
      const nextRebirthCount = state.rebirthCount + 1
      const nextRebirthMaxStage = Math.max(state.rebirthMaxStage, state.currentStage)

      const nextStage = config.ResetStage ? INITIAL_STAGE : state.currentStage
      const nextStatLevels = config.ResetStats ? initialStatLevels : state.statLevels
      const nextEquipmentLevels = config.ResetEquipment ? initialEquipmentLevels : state.equipmentLevels
      const nextMasteryLevels = config.ResetMastery ? initialMasteryLevels : state.masteryLevels
      const nextExistTreeStatBonus = config.KeepExistTree ? state.existTreeStatBonus : initialExistTreeStatBonus
      const nextUnlockedCount = config.KeepExistTree ? state.unlockedCount : 0
      const nextSpecialUnlocks = config.KeepExistTree
        ? state.specialUnlocks
        : { reverse: false, timeHeist: false }

      return {
        currentStage: nextStage,
        battle: config.ResetStage ? battleStateForStage(nextStage) : state.battle,
        statLevels: nextStatLevels,
        equipmentLevels: nextEquipmentLevels,
        masteryLevels: nextMasteryLevels,
        existTreeStatBonus: nextExistTreeStatBonus,
        unlockedCount: nextUnlockedCount,
        specialUnlocks: nextSpecialUnlocks,
        rebirthCount: nextRebirthCount,
        rebirthBonusPoint: nextRebirthBonusPoint,
        rebirthMaxStage: nextRebirthMaxStage,
        stats: computeEffectiveStats(
          nextStatLevels,
          nextEquipmentLevels,
          nextMasteryLevels,
          nextExistTreeStatBonus,
          nextRebirthBonusPoint,
        ),
        currencies: {
          ...state.currencies,
          growthEnergy: state.currencies.growthEnergy + (config.RefundGrowthEnergy ? state.rebirthSpent.growthEnergy : 0),
          gold: state.currencies.gold + (config.RefundGold ? state.rebirthSpent.gold : 0),
          essence: state.currencies.essence + (config.RefundMasteryEssence ? state.rebirthSpent.essence : 0),
        },
        rebirthSpent: initialRebirthSpent,
        timeHeistUsedCount: 0,
        timeHeistLastUsedAt: null,
      }
    })
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

  claimOfflineReward: () => {
    const reward = get().offlineReward
    if (reward) {
      get().addCurrency('gold', reward.rewards.gold)
      get().addCurrency('growthEnergy', reward.rewards.growthEnergy)
      get().addCurrency('exist', reward.rewards.exist)
    }
    set({ offlineReward: null })
  },

  // 개발자 콘솔 테스트용: 누적 보너스 포인트를 임의 값으로 지정
  setRebirthBonusPoint: (point) =>
    set((state) => ({
      rebirthBonusPoint: point,
      stats: computeEffectiveStats(
        state.statLevels,
        state.equipmentLevels,
        state.masteryLevels,
        state.existTreeStatBonus,
        point,
      ),
    })),

  // 개발자 콘솔 테스트용: 리버스 횟수·누적 보너스 포인트·최고 도달 스테이지 초기화
  resetRebirthBonus: () =>
    set((state) => ({
      rebirthCount: 0,
      rebirthBonusPoint: 0,
      rebirthMaxStage: 0,
      stats: computeEffectiveStats(
        state.statLevels,
        state.equipmentLevels,
        state.masteryLevels,
        state.existTreeStatBonus,
        0,
      ),
    })),
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
    rebirthCount: state.rebirthCount,
    rebirthBonusPoint: state.rebirthBonusPoint,
    rebirthMaxStage: state.rebirthMaxStage,
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

  // 오프라인 보상 테스트용: __setLastActiveHoursAgo(9) 호출 시 마지막 접속 시각을 9시간 전으로
  // 되돌려 저장하고 새로고침한다. offlineReward는 모듈 로드 시점에 한 번만 계산되므로 반드시 새로고침 필요.
  ;(globalThis as typeof globalThis & { __setLastActiveHoursAgo?: (hours: number) => void }).__setLastActiveHoursAgo = (
    hours,
  ) => {
    disableAutosave()
    debugOverrideLastActiveAt(Date.now() - hours * 60 * 60 * 1000)
    window.location.reload()
  }
}
