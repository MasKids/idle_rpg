import { create } from 'zustand'
import { MASTERY_WEAPONS, masteryMultiplier, masteryPrimaryStat, masteryUpgradeCost } from '../data/mastery'
import { BALANCE_TABLES, getCommon, getCommonBool, getCurrencyConfig, getRebirthDiamondReward, getWeaponFusionConfig } from '../data/balance'
import { getBattleUiLabel } from '../data/uiStrings'
import { EXIST_SPECIAL_UNLOCKS, generateExistTree } from '../data/existTree'
import { generateStage, killsRequiredForStage } from '../data/stages'
import { computeStatValue, statUpgradeCost } from '../data/stats'
import { computeOfflineReward, type OfflineRewardResult } from '../systems/battle/offlineReward'
import { isRankingEnabled, submitRanking } from '../systems/ranking/ranking'
import { readLastSubmittedStage, writeLastSubmittedStage } from '../systems/ranking/rankingStorage'
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

const DEFAULT_PLAYER_NAME = getBattleUiLabel('playerName')

// 플레이타임 — "지금까지 저장된 누적값 + 이번 세션 시작 이후 흐른 시간"으로 항상
// 다시 계산한다(틱마다 1초씩 더하는 방식이 아니다). setInterval에만 의존하면 탭이
// 백그라운드로 가서 타이머가 스로틀링될 때 값이 밀릴 수 있는데, 이 방식은 언제
// 계산하든 시각 차이만으로 정확한 값이 나온다. 오프라인(앱이 꺼져있던) 시간은
// 다음 세션이 시작될 때 저장된 값을 기준점으로 이어받을 뿐 더해지지 않으므로
// 자연히 제외된다 — "앱이 켜져 있는 동안만 누적" 요구사항을 만족한다.
const totalPlayTimeBaseSec = persistedGame?.totalPlayTimeSec ?? 0
const totalPlayTimeBaseAt = Date.now()
// 현재 회차 플레이타임은 같은 방식이지만 리버스 시 기준점이 0/지금으로 리셋된다.
let currentRunTimeBaseSec = persistedGame?.currentRunTimeSec ?? 0
let currentRunTimeBaseAt = Date.now()

function computeTotalPlayTimeSec(): number {
  return totalPlayTimeBaseSec + Math.floor((Date.now() - totalPlayTimeBaseAt) / 1000)
}

function computeCurrentRunTimeSec(): number {
  return currentRunTimeBaseSec + Math.floor((Date.now() - currentRunTimeBaseAt) / 1000)
}

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
  // 스테이지 최초 클리어 다이아 연출용 — battleLoop.ts가 최초 클리어를 감지할
  // 때만 채우는 일회성 신호(lastHit과 동일한 패턴, 세이브 대상 아님).
  lastFirstClear: { id: number; stage: number; diamond: number } | null
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

  // 플레이어 프로필
  playerName: string
  // 초 단위. 둘 다 앱이 켜져 있는 동안만 누적되고(타임스탬프 기반 계산), 새로고침해도
  // 이어진다. totalPlayTime은 리버스해도 유지, currentRunTime은 리버스 시 0으로 리셋.
  totalPlayTime: number
  currentRunTime: number

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

  setPlayerName: (name: string) => void
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
  lastFirstClear: null,
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

  playerName: persistedGame?.playerName ?? DEFAULT_PLAYER_NAME,
  totalPlayTime: computeTotalPlayTimeSec(),
  currentRunTime: computeCurrentRunTimeSec(),

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
    // RebirthTable 삭제(3단계) — ResetStage/ResetStats/ResetMastery/KeepExistTree는
    // CommonTable로, 재화 환급 여부는 CurrencyTable.RefundOnRebirth로 옮겨갔다(1단계
    // 때부터 스키마+데이터는 있었지만 실제로 읽지는 않았던 값 — 이번에 연결).
    const resetStage = getCommonBool('RebirthResetStage')
    const resetStats = getCommonBool('RebirthResetStats')
    const resetMastery = getCommonBool('RebirthResetMastery')
    const keepExistTree = getCommonBool('RebirthKeepExistTree')
    const refundGrowthEnergy = getCurrencyConfig('GROWTH_ENERGY').RefundOnRebirth
    const refundGold = getCurrencyConfig('GOLD').RefundOnRebirth
    const refundMasteryEssence = getCurrencyConfig('MASTERY_ESSENCE').RefundOnRebirth

    set((state) => {
      // 이번 리버스에서 도달 스테이지로 얻는 포인트를 먼저 누적한 뒤, 그 누적치를
      // 바로 이번 환급 배율 계산에도 반영한다 — "깊이 갈수록 이득"이 첫 리버스부터
      // 즉시 체감되게 하기 위함(이전엔 직전까지의 누적 포인트만 반영돼 첫 리버스는
      // 도달 스테이지와 무관하게 항상 ×1.00이었다).
      const earnedBonusPoints = computeRebirthBonusPoints(state.currentStage)
      const nextRebirthBonusPoint = state.rebirthBonusPoint + earnedBonusPoints
      const refundMultiplier = computeRefundMultiplier(state.currentStage, nextRebirthBonusPoint)
      const diamondReward = getRebirthDiamondReward(state.currentStage)
      const nextRebirthCount = state.rebirthCount + 1
      const nextRebirthMaxStage = Math.max(state.rebirthMaxStage, state.currentStage)

      const nextStage = resetStage ? INITIAL_STAGE : state.currentStage
      const nextStatLevels = resetStats ? initialStatLevels : state.statLevels
      const nextMasteryLevels = resetMastery ? initialMasteryLevels : state.masteryLevels
      const nextExistTreeStatBonus = keepExistTree ? state.existTreeStatBonus : initialExistTreeStatBonus
      const nextUnlockedCount = keepExistTree ? state.unlockedCount : 0
      const nextSpecialUnlocks = keepExistTree
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
        battle: resetStage ? battleStateForStage(nextStage) : state.battle,
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
        // growthEnergy/gold/essence는 "환급"이지 "유지 + 보너스"가 아니다 — 리버스 시
        // 보유량을 0으로 초기화한 뒤, 그동안 소비한 누적량 × 환급 배율만큼만 다시
        // 지급한다(예전엔 기존 보유량에 환급분을 더하기만 해서 리버스할수록 재화가
        // 끝없이 누적되는 버그가 있었다). exist/timeEnergy/diamond는 리버스로 초기화
        // 되지 않는 재화라 그대로 유지하거나(exist/timeEnergy) 별도 신규 지급만
        // 더한다(diamond, RebirthRewardTable 기준 — 환급과는 다른 메커니즘).
        currencies: {
          ...state.currencies,
          growthEnergy: refundGrowthEnergy ? Math.floor(state.rebirthSpent.growthEnergy * refundMultiplier) : 0,
          gold: refundGold ? Math.floor(state.rebirthSpent.gold * refundMultiplier) : 0,
          essence: refundMasteryEssence ? Math.floor(state.rebirthSpent.essence * refundMultiplier) : 0,
          diamond: state.currencies.diamond + diamondReward,
        },
        rebirthSpent: initialRebirthSpent,
        timeHeistUsedCount: 0,
        timeHeistLastUsedAt: null,
        currentRunTime: 0,
      }
    })

    // 현재 회차 플레이타임 기준점 리셋 — computeCurrentRunTimeSec()이 다음 계산부터
    // 0에서 다시 시작하게 한다(위 set()의 currentRunTime: 0은 다음 1초 틱 전까지의
    // 화면 표시용 즉시 반영일 뿐, 실제 기준이 되는 건 이 두 변수다).
    currentRunTimeBaseSec = 0
    currentRunTimeBaseAt = Date.now()
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
  // pullWeaponGacha()를 n번 호출하지 않고 한 번의 set()으로 묶어서 처리한다 —
  // 뽑을 때마다 computeEffectiveStats(보유 무기 전체를 순회하는 계산)를 다시 돌리면
  // 10연차만 해도 뽑기 결과 자체보다 이 재계산 비용이 훨씬 커져서, 10연차를 연달아
  // 여러 번 누르면 그동안 전투 틱(setTimeout)이 밀려 체력바가 잠깐 멈춰 보이는
  // 문제가 있었다. 다이아 소비/뽑기 굴림/중복 판정은 매 회차 그대로 순서대로 하되,
  // 무거운 스탯 재계산과 상태 반영은 마지막에 한 번만 한다.
  pullWeaponGachaTimes: (times) => {
    const results: WeaponGachaPullResult[] = []

    set((state) => {
      let diamond = state.currencies.diamond
      let gachaCount = state.gachaCount
      let ownedWeapons = state.ownedWeapons

      for (let i = 0; i < times; i++) {
        const cost = currentGachaLevelConfig(gachaCount).PullCostDiamond
        if (diamond < cost) break
        diamond -= cost

        const weaponId = rollWeaponGacha(gachaCount)
        const isDuplicate = (ownedWeapons[weaponId]?.count ?? 0) > 0
        ownedWeapons = grantWeaponEntry(ownedWeapons, weaponId, 1)
        gachaCount += 1
        results.push({ weaponId, isDuplicate })
      }

      if (results.length === 0) return {}

      return {
        currencies: { ...state.currencies, diamond },
        ownedWeapons,
        gachaCount,
        gachaLevel: currentGachaLevelConfig(gachaCount).GachaLevel,
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

    const { type, grade, tier } = parseWeaponId(weaponId)
    const cost = weaponLevelUpCost(type, grade, tier, entry.level)
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
    const { type, grade, tier } = parseWeaponId(weaponId)
    const maxLevel = weaponMaxLevel(entry.breakthroughCount)

    let level = entry.level
    let gold = get().currencies.gold
    let spent = 0
    while (level < maxLevel) {
      const cost = weaponLevelUpCost(type, grade, tier, level)
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
    if (!canMerge(weaponId, entry)) return false
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

  setPlayerName: (name) => set({ playerName: name }),
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
    playerName: state.playerName,
    // state.totalPlayTime/currentRunTime은 1초 간격 틱으로만 갱신되므로, 저장
    // 시점에는 그보다 정확한(지금 이 순간까지의) 값을 다시 계산해서 쓴다.
    totalPlayTimeSec: computeTotalPlayTimeSec(),
    currentRunTimeSec: computeCurrentRunTimeSec(),
  })
})

// 최고 스테이지(리버스해도 유지되는 rebirthMaxStage와 진행 중인 currentStage 중 큰 쪽)가
// 10 단위 구간을 새로 넘을 때마다 랭킹 서버에 기록을 등록한다. 너무 잦은 등록을 막기
// 위한 기준점(마지막으로 등록을 시도한 스테이지)은 게임 세이브와 별개로 로컬스토리지에
// 둔다(rankingStorage.ts) — 새로고침해도 같은 구간에서 중복 등록하지 않는다.
// submitRanking 자체가 실패를 삼키므로 여기서는 호출만 하고 결과를 기다리지 않는다.
const RANKING_STAGE_INTERVAL = 10

useGameStore.subscribe((state) => {
  if (!isRankingEnabled) return

  const maxStageEver = Math.max(state.rebirthMaxStage, state.currentStage)
  const lastSubmitted = readLastSubmittedStage()
  const currentMilestone = Math.floor(maxStageEver / RANKING_STAGE_INTERVAL)
  const lastMilestone = Math.floor(lastSubmitted / RANKING_STAGE_INTERVAL)
  if (currentMilestone <= lastMilestone) return

  writeLastSubmittedStage(maxStageEver)
  void submitRanking({
    playerName: state.playerName,
    maxStage: maxStageEver,
    playTime: state.totalPlayTime,
    rebirthCount: state.rebirthCount,
  })
})

// 새로고침/탭 종료 직전에 대기 중인 저장을 즉시 반영해 최대 2초 분량 유실을 막는다.
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushSave)
}

// 플레이타임 표시용 라이브 값 갱신 — 배틀 루프의 틱 주기(ASPD에 따라 100ms~1000ms로
// 변함)와는 무관하게 항상 1초 간격으로 갱신한다. 실제 누적 계산은 위 compute 함수가
// 타임스탬프 차이로 하므로, 이 인터벌은 그 결과를 스토어에 반영해 화면이 살아있게
// 만드는 역할만 한다 — 인터벌 자체가 스로틀링돼 몇 초 건너뛰어도 다음 실행에서
// 정확한 값으로 보정된다.
if (typeof window !== 'undefined') {
  setInterval(() => {
    useGameStore.setState({
      totalPlayTime: computeTotalPlayTimeSec(),
      currentRunTime: computeCurrentRunTimeSec(),
    })
  }, 1000)
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
