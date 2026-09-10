import { create } from 'zustand'
import { MASTERY_WEAPONS, masteryMultiplier, masteryPrimaryStat, masteryUpgradeCost } from '../data/mastery'
import { BALANCE_TABLES, getCommon, getRebirthConfig, getRebirthDiamondReward, getWeaponFusionConfig } from '../data/balance'
import { EXIST_SPECIAL_UNLOCKS, generateExistTree } from '../data/existTree'
import { generateStage, killsRequiredForStage } from '../data/stages'
import { computeStatValue, statUpgradeCost } from '../data/stats'
import { computeOfflineReward, type OfflineRewardResult } from '../systems/battle/offlineReward'
import { computeActiveRelicEffects, computeRelicSlotCount, RELIC_SLOT_MAX, rollRelicGacha } from '../systems/relic/relic'
import { computeRebirthBonusPoints, computeRefundMultiplier } from '../systems/rebirth/rebirthBonus'
import { computeTimeHeistPreview, timeHeistCooldownEndsAt } from '../systems/timeheist/timeHeist'
import {
  canBreakthrough,
  canMerge,
  computeWeaponBonusBreakdown,
  currentGachaLevelConfig,
  nextBreakthroughStep,
  nextWeaponIdForMerge,
  parseWeaponId,
  rollWeaponGacha,
  weaponLevelUpCost,
  weaponMaxLevel,
} from '../systems/weapon/weapon'
import { debugOverrideLastActiveAt, disableAutosave, flushSave, loadGameState, scheduleSave } from './gameStateStorage'
import type {
  ActiveRelicSlots,
  BattleHit,
  BattleState,
  CurrencyKey,
  OwnedWeapons,
  RebirthSpentTotals,
  RelicGachaPullResult,
  SpecialUnlockId,
  StatKey,
  WeaponGachaPullResult,
  WeaponInstance,
} from '../types/game'

const INITIAL_STAGE = 1
const EXIST_TREE_NODES = generateExistTree()
const persistedGame = loadGameState()
const STAT_KEYS: StatKey[] = ['atk', 'aspd', 'crit', 'critDmg', 'existGain']

// 오프라인 보상 계산용 "이전 세션이 저장된 시각".
// persistedGame은 로드 직후 스토어가 즉시 새 시각으로 덮어쓰므로 별도로 남겨둔다.
const lastSessionEndedAt: number | null = persistedGame?.lastActiveAt ?? null

function baseStatsFromLevels(levels: Record<StatKey, number>): Record<StatKey, number> {
  return {
    atk: computeStatValue('atk', levels.atk),
    aspd: computeStatValue('aspd', levels.aspd),
    crit: computeStatValue('crit', levels.crit),
    critDmg: computeStatValue('critDmg', levels.critDmg),
    existGain: computeStatValue('existGain', levels.existGain),
  }
}

// 새로 얻는(또는 처음 보는) 무기 타입은 레벨1/돌파0으로 시작한다. 합성 결과물의
// 초기 레벨/돌파(WeaponFusionTable.ResultLevel/ResultBreakthroughCount)만 예외적으로
// freshLevel/freshBreakthroughCount로 넘겨 받는다 — 그 외(가챠, 콘솔 지급)는 기본값(1/0) 사용.
function grantWeaponEntry(
  owned: OwnedWeapons,
  weaponId: string,
  amount: number,
  freshLevel = 1,
  freshBreakthroughCount = 0,
): OwnedWeapons {
  const existing = owned[weaponId]
  const nextEntry: WeaponInstance = existing
    ? { ...existing, count: existing.count + amount }
    : { count: amount, level: freshLevel, breakthroughCount: freshBreakthroughCount }
  return { ...owned, [weaponId]: nextEntry }
}

// 성장 스탯 + 존재력 트리 영구 보너스(가산) + 활성 유물 스탯형 효과(가산)를 먼저 합치고,
// 모든 보유 무기의 공통 기본 공격력(종류 불문)을 ATK에 가산한다. 장착 중인 무기가
// 있으면 그 종류의 특화 스탯(ATK/ASPD/CRIT)에 추가로 보유·장착 효과를 가산한 뒤,
// 그 종류의 숙련 배율을 곱연산으로 적용한다 — 검이면 특화 스탯도 ATK라 배율이
// ATK 전체에 걸리고, 창/활이면 ATK는 기본 공격력만 남고 특화 스탯(ASPD/CRIT)에만
// 배율이 걸린다. 무기 종류를 바꿔도 ATK가 0으로 꺼지지 않는다.
// 리버스 회차 보너스는 리버스 환급량에만 영향을 주고 이 계산에는 관여하지 않는다.
function computeEffectiveStats(
  statLevels: Record<StatKey, number>,
  masteryLevels: Record<string, number>,
  existTreeBonus: Record<StatKey, number>,
  ownedWeapons: OwnedWeapons,
  equippedWeaponId: string | null,
  activeRelics: ActiveRelicSlots,
): Record<StatKey, number> {
  const base = baseStatsFromLevels(statLevels)

  const combined: Record<StatKey, number> = {
    atk: base.atk + existTreeBonus.atk,
    aspd: base.aspd + existTreeBonus.aspd,
    crit: base.crit + existTreeBonus.crit,
    critDmg: base.critDmg + existTreeBonus.critDmg,
    existGain: base.existGain + existTreeBonus.existGain,
  }

  const relicEffects = computeActiveRelicEffects(activeRelics)
  for (const key of STAT_KEYS) combined[key] += relicEffects.statBonus[key]

  const weaponBonus = computeWeaponBonusBreakdown(ownedWeapons, equippedWeaponId)
  combined.atk += weaponBonus.baseAtkTotal

  if (equippedWeaponId) {
    const { type } = parseWeaponId(equippedWeaponId)
    const primaryStat = masteryPrimaryStat(type)
    combined[primaryStat] += weaponBonus.specialtyOwnTotal + weaponBonus.specialtyEquipBonus
    combined[primaryStat] *= masteryMultiplier(type, masteryLevels[type] ?? 0)
  }

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

  // 무기
  ownedWeapons: OwnedWeapons
  equippedWeaponId: string | null
  gachaCount: number
  gachaLevel: number

  // 유물
  ownedRelics: number[]
  activeRelics: ActiveRelicSlots

  // 성장 탭 자동 업그레이드 (존재력 트리는 대상 아님 — 항상 수동)
  autoUpgradeStats: boolean

  addCurrency: (key: CurrencyKey, amount: number) => void
  spendCurrency: (key: CurrencyKey, amount: number) => boolean
  upgradeStat: (key: StatKey) => boolean
  maxUpgradeAll: () => void
  upgradeMastery: (weaponType: string) => boolean
  maxUpgradeMastery: (weaponType?: string) => void
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

  // 무기
  grantWeapon: (weaponId: string, count: number) => void
  pullWeaponGacha: () => WeaponGachaPullResult | null
  pullWeaponGachaTimes: (times: number) => WeaponGachaPullResult[]
  equipWeapon: (weaponId: string) => boolean
  levelUpWeapon: (weaponId: string) => boolean
  maxLevelUpWeapon: (weaponId: string) => void
  breakthroughWeapon: (weaponId: string) => boolean
  mergeWeapon: (weaponId: string) => boolean

  // 유물
  pullRelicGacha: () => RelicGachaPullResult | null
  setRelicSlot: (slotIndex: number, relicId: number | null) => boolean

  setAutoUpgradeStats: (enabled: boolean) => void
}

const initialStatLevels: Record<StatKey, number> = {
  atk: 0,
  aspd: 0,
  crit: 0,
  critDmg: 0,
  existGain: 0,
}

const initialMasteryLevels: Record<string, number> = Object.fromEntries(
  MASTERY_WEAPONS.map((weapon) => [weapon.id, 0]),
)

const initialOwnedWeapons: OwnedWeapons = {}
const initialActiveRelics: ActiveRelicSlots = Array(RELIC_SLOT_MAX).fill(null)

const initialRebirthSpent: RebirthSpentTotals = {
  growthEnergy: 0,
  gold: 0,
  essence: 0,
}

const initialExistTreeStatBonus: Record<StatKey, number> = {
  atk: 0,
  aspd: 0,
  crit: 0,
  critDmg: 0,
  existGain: 0,
}

const startStatLevels = persistedGame?.statLevels ?? initialStatLevels
const startMasteryLevels = persistedGame?.masteryLevels ?? initialMasteryLevels
const startExistTreeStatBonus = persistedGame?.existTreeStatBonus ?? initialExistTreeStatBonus
const startStage = persistedGame?.currentStage ?? INITIAL_STAGE
const startRebirthCount = persistedGame?.rebirthCount ?? 0
const startRebirthBonusPoint = persistedGame?.rebirthBonusPoint ?? 0
const startRebirthMaxStage = Math.max(persistedGame?.rebirthMaxStage ?? startStage, startStage)
const startOwnedWeapons = persistedGame?.ownedWeapons ?? initialOwnedWeapons
const startEquippedWeaponId = persistedGame?.equippedWeaponId ?? null
const startGachaCount = persistedGame?.gachaCount ?? 0
const startGachaLevel = persistedGame?.gachaLevel ?? currentGachaLevelConfig(startGachaCount).GachaLevel
const startOwnedRelics = persistedGame?.ownedRelics ?? []
const startActiveRelics = persistedGame?.activeRelics ?? initialActiveRelics
const startStats = computeEffectiveStats(
  startStatLevels,
  startMasteryLevels,
  startExistTreeStatBonus,
  startOwnedWeapons,
  startEquippedWeaponId,
  startActiveRelics,
)

// 오프라인 보상은 앱 시작 시 단 한 번, 이전 세션이 끝난 시각과 지금의 차이로 계산한다.
// (스테이지는 그대로 두고 재화만 지급 — 실제 battle 진행에는 영향 없음)
const startGoldGainBonusPercent = computeActiveRelicEffects(startActiveRelics).goldGainBonusPercent
const startOfflineReward =
  lastSessionEndedAt !== null
    ? computeOfflineReward(Date.now() - lastSessionEndedAt, startStage, startStats, startGoldGainBonusPercent)
    : null

const initialCurrencies: Record<CurrencyKey, number> = {
  exist: getCommon('InitialExist'),
  growthEnergy: getCommon('InitialGrowthEnergy'),
  timeEnergy: getCommon('InitialTimeEnergy'),
  gold: getCommon('InitialGold'),
  essence: getCommon('InitialMasteryEssence'),
  diamond: getCommon('InitialDiamond'),
}

export const useGameStore = create<GameState>((set, get) => ({
  currencies: persistedGame?.currencies ?? initialCurrencies,
  statLevels: startStatLevels,
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

  ownedWeapons: startOwnedWeapons,
  equippedWeaponId: startEquippedWeaponId,
  gachaCount: startGachaCount,
  gachaLevel: startGachaLevel,

  ownedRelics: startOwnedRelics,
  activeRelics: startActiveRelics,

  autoUpgradeStats: persistedGame?.autoUpgradeStats ?? false,

  addCurrency: (key, amount) => {
    set((state) => {
      const currencies = { ...state.currencies, [key]: state.currencies[key] + amount }
      if (key !== 'growthEnergy' || !state.autoUpgradeStats) {
        return { currencies }
      }

      // 가장 싼 스탯부터 반복 구매(순환 결과와 동일) — 존재력 트리는 여기서 건드리지 않는다.
      const statLevels = { ...state.statLevels }
      let growthEnergy = currencies.growthEnergy
      let spent = 0
      for (;;) {
        let cheapestKey: StatKey | null = null
        let cheapestCost = Infinity
        for (const key of STAT_KEYS) {
          const cost = statUpgradeCost(key, statLevels[key])
          if (cost < cheapestCost) {
            cheapestCost = cost
            cheapestKey = key
          }
        }
        if (cheapestKey === null || growthEnergy < cheapestCost) break
        growthEnergy -= cheapestCost
        spent += cheapestCost
        statLevels[cheapestKey] += 1
      }
      if (spent === 0) return { currencies }

      return {
        currencies: { ...currencies, growthEnergy },
        statLevels,
        stats: computeEffectiveStats(
          statLevels,
          state.masteryLevels,
          state.existTreeStatBonus,
          state.ownedWeapons,
          state.equippedWeaponId,
          state.activeRelics,
        ),
        rebirthSpent: { ...state.rebirthSpent, growthEnergy: state.rebirthSpent.growthEnergy + spent },
      }
    })
  },

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
          state.masteryLevels,
          state.existTreeStatBonus,
          state.ownedWeapons,
          state.equippedWeaponId,
          state.activeRelics,
        ),
        rebirthSpent: { ...state.rebirthSpent, growthEnergy: state.rebirthSpent.growthEnergy + cost },
      }
    })
    return true
  },

  maxUpgradeAll: () => {
    const order: StatKey[] = ['atk', 'aspd', 'crit', 'critDmg', 'existGain']
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
        state.masteryLevels,
        state.existTreeStatBonus,
        state.ownedWeapons,
        state.equippedWeaponId,
        state.activeRelics,
      ),
      currencies: { ...state.currencies, growthEnergy },
      rebirthSpent: { ...state.rebirthSpent, growthEnergy: state.rebirthSpent.growthEnergy + spent },
    }))
  },

  upgradeMastery: (weaponType) => {
    const level = get().masteryLevels[weaponType] ?? 0
    const cost = masteryUpgradeCost(weaponType, level)
    if (!get().spendCurrency('essence', cost)) return false

    set((state) => {
      const masteryLevels = { ...state.masteryLevels, [weaponType]: level + 1 }
      return {
        masteryLevels,
        stats: computeEffectiveStats(
          state.statLevels,
          masteryLevels,
          state.existTreeStatBonus,
          state.ownedWeapons,
          state.equippedWeaponId,
          state.activeRelics,
        ),
        rebirthSpent: { ...state.rebirthSpent, essence: state.rebirthSpent.essence + cost },
      }
    })
    return true
  },

  maxUpgradeMastery: (weaponType) => {
    const masteryLevels = { ...get().masteryLevels }
    let essence = get().currencies.essence
    const startingEssence = essence
    const targets = weaponType ? MASTERY_WEAPONS.filter((weapon) => weapon.id === weaponType) : MASTERY_WEAPONS

    for (const weapon of targets) {
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
        masteryLevels,
        state.existTreeStatBonus,
        state.ownedWeapons,
        state.equippedWeaponId,
        state.activeRelics,
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
            state.masteryLevels,
            existTreeStatBonus,
            state.ownedWeapons,
            state.equippedWeaponId,
            state.activeRelics,
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
      // 이번 리버스에서 도달 스테이지로 얻는 포인트를 먼저 누적한 뒤, 그 누적치를
      // 바로 이번 환급 배율 계산에도 반영한다 — "깊이 갈수록 이득"이 첫 리버스부터
      // 즉시 체감되게 하기 위함(이전엔 직전까지의 누적 포인트만 반영돼 첫 리버스는
      // 도달 스테이지와 무관하게 항상 ×1.00이었다).
      const earnedBonusPoints = computeRebirthBonusPoints(state.currentStage)
      const nextRebirthBonusPoint = state.rebirthBonusPoint + earnedBonusPoints
      const refundMultiplier = computeRefundMultiplier(nextRebirthBonusPoint)
      const diamondReward = getRebirthDiamondReward(state.currentStage)
      const nextRebirthCount = state.rebirthCount + 1
      const nextRebirthMaxStage = Math.max(state.rebirthMaxStage, state.currentStage)

      const nextStage = config.ResetStage ? INITIAL_STAGE : state.currentStage
      const nextStatLevels = config.ResetStats ? initialStatLevels : state.statLevels
      const nextMasteryLevels = config.ResetMastery ? initialMasteryLevels : state.masteryLevels
      const nextExistTreeStatBonus = config.KeepExistTree ? state.existTreeStatBonus : initialExistTreeStatBonus
      const nextUnlockedCount = config.KeepExistTree ? state.unlockedCount : 0
      const nextSpecialUnlocks = config.KeepExistTree
        ? state.specialUnlocks
        : { reverse: false, timeHeist: false }

      // 무기는 전부 소멸, 유물은 전부 초기화. 가챠 레벨/누적 뽑기 횟수는 유지.
      // 다이아는 환급 대상이 아니라(rebirthSpent가 추적하지 않음) 도달 스테이지 기준으로
      // 매번 새로 지급된다 — 다이아의 유일한 획득 경로.
      const nextOwnedWeapons = initialOwnedWeapons
      const nextEquippedWeaponId = null
      const nextOwnedRelics: number[] = []
      const nextActiveRelics = initialActiveRelics

      return {
        currentStage: nextStage,
        battle: config.ResetStage ? battleStateForStage(nextStage) : state.battle,
        statLevels: nextStatLevels,
        masteryLevels: nextMasteryLevels,
        existTreeStatBonus: nextExistTreeStatBonus,
        unlockedCount: nextUnlockedCount,
        specialUnlocks: nextSpecialUnlocks,
        rebirthCount: nextRebirthCount,
        rebirthBonusPoint: nextRebirthBonusPoint,
        rebirthMaxStage: nextRebirthMaxStage,
        ownedWeapons: nextOwnedWeapons,
        equippedWeaponId: nextEquippedWeaponId,
        ownedRelics: nextOwnedRelics,
        activeRelics: nextActiveRelics,
        stats: computeEffectiveStats(
          nextStatLevels,
          nextMasteryLevels,
          nextExistTreeStatBonus,
          nextOwnedWeapons,
          nextEquippedWeaponId,
          nextActiveRelics,
        ),
        currencies: {
          ...state.currencies,
          growthEnergy:
            state.currencies.growthEnergy +
            (config.RefundGrowthEnergy ? Math.floor(state.rebirthSpent.growthEnergy * refundMultiplier) : 0),
          gold:
            state.currencies.gold + (config.RefundGold ? Math.floor(state.rebirthSpent.gold * refundMultiplier) : 0),
          essence:
            state.currencies.essence +
            (config.RefundMasteryEssence ? Math.floor(state.rebirthSpent.essence * refundMultiplier) : 0),
          diamond: state.currencies.diamond + diamondReward,
        },
        rebirthSpent: initialRebirthSpent,
        timeHeistUsedCount: 0,
        timeHeistLastUsedAt: null,
      }
    })
  },

  executeTimeHeist: () => {
    if (!get().specialUnlocks.timeHeist) return false

    const relicEffects = computeActiveRelicEffects(get().activeRelics)
    const usedCount = get().timeHeistUsedCount
    const lastUsedAt = get().timeHeistLastUsedAt
    const cooldownEndsAt = timeHeistCooldownEndsAt(usedCount, lastUsedAt, relicEffects.timeHeistCooldownReductionPercent)
    if (cooldownEndsAt !== null && Date.now() < cooldownEndsAt) return false

    const preview = computeTimeHeistPreview(
      get().currentStage,
      get().stats.existGain,
      usedCount,
      relicEffects.goldGainBonusPercent,
      relicEffects.timeHeistCooldownReductionPercent,
    )
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

  // 개발자 콘솔 테스트용: 누적 보너스 포인트를 임의 값으로 지정 (환급 배율에만 영향, 스탯은 무관)
  setRebirthBonusPoint: (point) => set({ rebirthBonusPoint: point }),

  // 개발자 콘솔 테스트용: 리버스 횟수·누적 보너스 포인트·최고 도달 스테이지 초기화
  resetRebirthBonus: () => set({ rebirthCount: 0, rebirthBonusPoint: 0, rebirthMaxStage: 0 }),

  // 무기 타입을 count만큼 지급(없으면 신규 생성, 있으면 count만 증가). 가챠/합성/개발자
  // 콘솔 지급이 전부 이 액션을 공유한다.
  grantWeapon: (weaponId, count) =>
    set((state) => {
      const ownedWeapons = grantWeaponEntry(state.ownedWeapons, weaponId, count)
      return {
        ownedWeapons,
        stats: computeEffectiveStats(
          state.statLevels,
          state.masteryLevels,
          state.existTreeStatBonus,
          ownedWeapons,
          state.equippedWeaponId,
          state.activeRelics,
        ),
      }
    }),

  pullWeaponGacha: () => {
    const cost = currentGachaLevelConfig(get().gachaCount).PullCostDiamond
    if (!get().spendCurrency('diamond', cost)) return null

    const weaponId = rollWeaponGacha(get().gachaCount)
    const isDuplicate = (get().ownedWeapons[weaponId]?.count ?? 0) > 0

    set((state) => {
      const nextGachaCount = state.gachaCount + 1
      const ownedWeapons = grantWeaponEntry(state.ownedWeapons, weaponId, 1)
      return {
        ownedWeapons,
        gachaCount: nextGachaCount,
        gachaLevel: currentGachaLevelConfig(nextGachaCount).GachaLevel,
        stats: computeEffectiveStats(
          state.statLevels,
          state.masteryLevels,
          state.existTreeStatBonus,
          ownedWeapons,
          state.equippedWeaponId,
          state.activeRelics,
        ),
      }
    })
    return { weaponId, isDuplicate }
  },

  // 1회 뽑기를 n번 반복 — 도중에 다이아가 부족해지면 그 시점에서 멈춘다.
  pullWeaponGachaTimes: (times) => {
    const results: WeaponGachaPullResult[] = []
    for (let i = 0; i < times; i++) {
      const result = get().pullWeaponGacha()
      if (!result) break
      results.push(result)
    }
    return results
  },

  equipWeapon: (weaponId) => {
    const entry = get().ownedWeapons[weaponId]
    if (!entry || entry.count <= 0) return false

    set((state) => ({
      equippedWeaponId: weaponId,
      stats: computeEffectiveStats(
        state.statLevels,
        state.masteryLevels,
        state.existTreeStatBonus,
        state.ownedWeapons,
        weaponId,
        state.activeRelics,
      ),
    }))
    return true
  },

  levelUpWeapon: (weaponId) => {
    const entry = get().ownedWeapons[weaponId]
    if (!entry) return false
    if (entry.level >= weaponMaxLevel(entry.breakthroughCount)) return false

    const { grade } = parseWeaponId(weaponId)
    const cost = weaponLevelUpCost(grade, entry.level)
    if (!get().spendCurrency('gold', cost)) return false

    set((state) => {
      const current = state.ownedWeapons[weaponId]
      if (!current) return {}
      const ownedWeapons = { ...state.ownedWeapons, [weaponId]: { ...current, level: current.level + 1 } }
      return {
        ownedWeapons,
        stats: computeEffectiveStats(
          state.statLevels,
          state.masteryLevels,
          state.existTreeStatBonus,
          ownedWeapons,
          state.equippedWeaponId,
          state.activeRelics,
        ),
        rebirthSpent: { ...state.rebirthSpent, gold: state.rebirthSpent.gold + cost },
      }
    })
    return true
  },

  maxLevelUpWeapon: (weaponId) => {
    const entry = get().ownedWeapons[weaponId]
    if (!entry) return
    const { grade } = parseWeaponId(weaponId)
    const maxLevel = weaponMaxLevel(entry.breakthroughCount)

    let level = entry.level
    let gold = get().currencies.gold
    let spent = 0
    while (level < maxLevel) {
      const cost = weaponLevelUpCost(grade, level)
      if (gold < cost) break
      gold -= cost
      spent += cost
      level += 1
    }
    if (spent === 0) return

    set((state) => {
      const current = state.ownedWeapons[weaponId]
      if (!current) return {}
      const ownedWeapons = { ...state.ownedWeapons, [weaponId]: { ...current, level } }
      return {
        ownedWeapons,
        currencies: { ...state.currencies, gold },
        stats: computeEffectiveStats(
          state.statLevels,
          state.masteryLevels,
          state.existTreeStatBonus,
          ownedWeapons,
          state.equippedWeaponId,
          state.activeRelics,
        ),
        rebirthSpent: { ...state.rebirthSpent, gold: state.rebirthSpent.gold + spent },
      }
    })
  },

  breakthroughWeapon: (weaponId) => {
    const entry = get().ownedWeapons[weaponId]
    if (!entry || !canBreakthrough(entry)) return false
    const step = nextBreakthroughStep(entry)
    if (!step) return false

    set((state) => {
      const current = state.ownedWeapons[weaponId]
      if (!current) return {}
      const ownedWeapons = {
        ...state.ownedWeapons,
        [weaponId]: {
          ...current,
          count: current.count - step.RequiredDuplicateCount,
          breakthroughCount: current.breakthroughCount + 1,
        },
      }
      return {
        ownedWeapons,
        stats: computeEffectiveStats(
          state.statLevels,
          state.masteryLevels,
          state.existTreeStatBonus,
          ownedWeapons,
          state.equippedWeaponId,
          state.activeRelics,
        ),
      }
    })
    return true
  },

  mergeWeapon: (weaponId) => {
    const entry = get().ownedWeapons[weaponId]
    if (!entry) return false
    const isEquipped = get().equippedWeaponId === weaponId
    if (!canMerge(weaponId, entry, isEquipped)) return false
    const targetId = nextWeaponIdForMerge(weaponId)
    if (!targetId) return false
    const fusion = getWeaponFusionConfig()

    set((state) => {
      const current = state.ownedWeapons[weaponId]
      if (!current) return {}
      const afterConsume: OwnedWeapons = {
        ...state.ownedWeapons,
        [weaponId]: { ...current, count: current.count - fusion.RequiredCount },
      }
      const ownedWeapons = grantWeaponEntry(afterConsume, targetId, 1, fusion.ResultLevel, fusion.ResultBreakthroughCount)
      return {
        ownedWeapons,
        stats: computeEffectiveStats(
          state.statLevels,
          state.masteryLevels,
          state.existTreeStatBonus,
          ownedWeapons,
          state.equippedWeaponId,
          state.activeRelics,
        ),
      }
    })
    return true
  },

  pullRelicGacha: () => {
    const cost = getCommon('RelicGachaCostTimeEnergy')
    if (!get().spendCurrency('timeEnergy', cost)) return null

    const relicId = rollRelicGacha()
    const isDuplicate = get().ownedRelics.includes(relicId)
    if (isDuplicate) {
      get().addCurrency('timeEnergy', getCommon('RelicDuplicateRefundTimeEnergy'))
    } else {
      set((state) => ({ ownedRelics: [...state.ownedRelics, relicId] }))
    }
    return { relicId, isDuplicate }
  },

  setRelicSlot: (slotIndex, relicId) => {
    const slotCount = computeRelicSlotCount(get().unlockedCount)
    if (slotIndex < 0 || slotIndex >= slotCount) return false
    if (relicId !== null) {
      if (!get().ownedRelics.includes(relicId)) return false
      if (get().activeRelics.includes(relicId)) return false
    }

    set((state) => {
      const activeRelics = [...state.activeRelics]
      activeRelics[slotIndex] = relicId
      return {
        activeRelics,
        stats: computeEffectiveStats(
          state.statLevels,
          state.masteryLevels,
          state.existTreeStatBonus,
          state.ownedWeapons,
          state.equippedWeaponId,
          activeRelics,
        ),
      }
    })
    return true
  },

  setAutoUpgradeStats: (enabled) => set({ autoUpgradeStats: enabled }),
}))

// 상태가 바뀔 때마다(전투 틱 포함) 전체 진행 상태를 debounce 저장 큐에 올린다.
// 실제 localStorage 쓰기는 gameStateStorage.ts에서 일정 주기로 묶어서 처리한다.
useGameStore.subscribe((state) => {
  scheduleSave({
    currencies: state.currencies,
    statLevels: state.statLevels,
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
    ownedWeapons: state.ownedWeapons,
    equippedWeaponId: state.equippedWeaponId,
    gachaCount: state.gachaCount,
    gachaLevel: state.gachaLevel,
    ownedRelics: state.ownedRelics,
    activeRelics: state.activeRelics,
    autoUpgradeStats: state.autoUpgradeStats,
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

  // 무기 시스템 테스트용: 다이아/뽑기 없이 랜덤 무기 N개를 바로 지급한다(가챠 카운트 무관).
  ;(globalThis as typeof globalThis & { __grantRandomWeapons?: (n: number) => void }).__grantRandomWeapons = (n) => {
    const state = useGameStore.getState()
    for (let i = 0; i < n; i++) {
      state.grantWeapon(rollWeaponGacha(state.gachaCount), 1)
    }
  }

  // 가챠 레벨을 임의로 맞춘다 — 해당 레벨의 RequirePullCount로 gachaCount/gachaLevel을 직접 지정.
  ;(globalThis as typeof globalThis & { __setGachaLevel?: (level: number) => void }).__setGachaLevel = (level) => {
    const config = BALANCE_TABLES.GachaTable.find((r) => r.GachaLevel === level)
    if (!config) {
      console.warn(`[dev] GachaTable에 GachaLevel=${level} 행이 없습니다.`)
      return
    }
    useGameStore.setState({ gachaCount: config.RequirePullCount, gachaLevel: level })
  }

  // 유물 전부 지급(활성화는 아님 — setRelicSlot으로 별도 활성화 필요)
  ;(globalThis as typeof globalThis & { __grantAllRelics?: () => void }).__grantAllRelics = () => {
    useGameStore.setState((state) => ({
      ownedRelics: [...new Set([...state.ownedRelics, ...BALANCE_TABLES.RelicTable.map((r) => r.Id)])],
    }))
  }

  console.log(
    [
      '[dev console commands]',
      '- __gameStore.getState().addCurrency(key, amount) — 재화 지급 (exist/growthEnergy/timeEnergy/gold/essence/diamond)',
      '- __gameStore.getState().grantWeapon(weaponId, count) — 특정 무기 지급 (예: grantWeapon("Sword_Rare_3", 5))',
      '- __grantRandomWeapons(n) — 랜덤 무기 n개 지급 (다이아/가챠 카운트 무관)',
      '- __setGachaLevel(level) — 가챠 레벨 임의 설정',
      '- __grantAllRelics() — 보유 유물 전부 지급(활성화는 별도)',
      '- __gameStore.getState().setRebirthBonusPoint(point) — 리버스 회차 보너스 포인트 임의 설정',
      '- __gameStore.getState().resetRebirthBonus() — 리버스 횟수/보너스 포인트/최고 스테이지 초기화',
      '- __setLastActiveHoursAgo(hours) — 마지막 접속 시각을 n시간 전으로(오프라인 보상 테스트, 새로고침 필요)',
    ].join('\n'),
  )
}
