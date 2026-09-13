import { create } from 'zustand'
import { MASTERY_WEAPONS, masteryBonusPercent, masteryPrimaryStat, masteryUpgradeCost } from '../data/mastery'
import {
  BALANCE_TABLES,
  getCommon,
  getCommonBool,
  getCurrencyConfig,
  getRebirthRewardRow,
  getWeaponFusionConfig,
  type CurrencyTypeEnum,
  type WeaponTypeEnum,
} from '../data/balance'
import { getBattleUiLabel } from '../data/uiStrings'
import { EXIST_SPECIAL_UNLOCKS, generateExistTree, simulateBulkExistUnlock, type BulkExistUnlockResult } from '../data/existTree'
import { generateStage, killsRequiredForStage } from '../data/stages'
import { computeStatValue, statUpgradeCost } from '../data/stats'
import { computeOfflineReward, type OfflineRewardResult } from '../systems/battle/offlineReward'
import { isRankingEnabled, submitRanking } from '../systems/ranking/ranking'
import { readLastSubmittedStage, writeLastSubmittedStage } from '../systems/ranking/rankingStorage'
import { computeActiveRelicEffects, computeRelicSlotCount, RELIC_SLOT_MAX, rollRelicGacha } from '../systems/relic/relic'
import { computeRebirthCountMultiplier } from '../systems/rebirth/rebirthBonus'
import { computeTimeHeistPreview, timeHeistCooldownEndsAt } from '../systems/timeheist/timeHeist'
import {
  canBreakthrough,
  canMerge,
  computeWeaponBonusBreakdown,
  currentGachaLevelConfig,
  grantWeaponEntry,
  nextBreakthroughStep,
  nextWeaponIdForMerge,
  parseWeaponId,
  rollWeaponGacha,
  simulateBulkBreakthrough,
  simulateBulkFusion,
  simulateTypeBulkBreakthrough,
  simulateTypeBulkFusion,
  weaponLevelUpCost,
  weaponMaxLevel,
  type BulkBreakthroughResult,
  type BulkFusionResult,
  type TypeBulkBreakthroughResult,
  type TypeBulkFusionResult,
} from '../systems/weapon/weapon'
import { debugOverrideLastActiveAt, disableAutosave, flushSave, loadGameState, scheduleSave } from './gameStateStorage'
import type {
  ActiveRelicSlots,
  BattleHit,
  BattleState,
  CurrencyKey,
  OwnedWeapons,
  RelicGachaPullResult,
  SpecialUnlockId,
  StatKey,
  WeaponGachaPullResult,
} from '../types/game'

const INITIAL_STAGE = 1
const EXIST_TREE_NODES = generateExistTree()
const persistedGame = loadGameState()
const STAT_KEYS: StatKey[] = ['atk', 'aspd', 'crit', 'critDmg', 'existGain']

// 오프라인 보상 계산용 "이전 세션이 저장된 시각".
// persistedGame은 로드 직후 스토어가 즉시 새 시각으로 덮어쓰므로 별도로 남겨둔다.
const lastSessionEndedAt: number | null = persistedGame?.lastActiveAt ?? null

// 이름을 아직 정하지 않은 상태를 가리키는 값 — NameEntryGate가 이 값과 같은 동안만
// "이름 입력 강제" 화면을 띄운다. 실제 이름을 입력하면 이 값과 달라지므로 별도의
// "이름을 정했는지" 플래그 없이 playerName 자체로 판별할 수 있다.
export const DEFAULT_PLAYER_NAME = getBattleUiLabel('playerName')

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

// v0.3.0 밸런스 개편 — 콘텐츠 간 시너지가 나도록 깡스탯과 퍼센트를 분리해 곱연산으로
// 합친다: 최종 스탯 = (기본값 + 깡스탯 합계) × (1 + 퍼센트 합계/100).
//   - 깡스탯: 6스탯 업그레이드(기본값 포함) + 무기 장착 효과(기본 공격력·특화 스탯) +
//     유물(FLAT 타입)
//   - 퍼센트: 존재력 트리 + 무기 보유 효과(기본 공격력·특화 스탯) + 무기 숙련 +
//     유물(PERCENT 타입)
// 장착 중인 무기가 있으면 그 종류의 특화 스탯(ATK/ASPD/CRIT)에만 보유·장착 효과와
// 숙련 퍼센트가 더해진다 — 검이면 특화 스탯도 ATK라 기본 공격력과 합쳐지고,
// 창/활이면 ATK는 기본 공격력만 남고 특화 스탯(ASPD/CRIT)에만 붙는다. 무기 종류를
// 바꿔도 ATK 깡스탯/퍼센트가 0으로 꺼지지 않는다(기본 공격력은 항상 전체 보유 무기
// 기준). 리버스 회차 보너스는 리버스 환급량에만 영향을 주고 이 계산에는 관여하지 않는다.
function computeEffectiveStats(
  statLevels: Record<StatKey, number>,
  masteryLevels: Record<string, number>,
  existTreeBonus: Record<StatKey, number>,
  ownedWeapons: OwnedWeapons,
  equippedWeaponId: string | null,
  activeRelics: ActiveRelicSlots,
): { stats: Record<StatKey, number> } {
  const flatTotal: Record<StatKey, number> = { ...baseStatsFromLevels(statLevels) }
  const percentSum: Record<StatKey, number> = { atk: 0, aspd: 0, crit: 0, critDmg: 0, existGain: 0 }

  // 존재력 트리는 전부 퍼센트(영구 성장)
  for (const key of STAT_KEYS) percentSum[key] += existTreeBonus[key]

  // 유물은 혼합 — FLAT/PERCENT 각자의 버킷으로
  const relicEffects = computeActiveRelicEffects(activeRelics)
  for (const key of STAT_KEYS) {
    flatTotal[key] += relicEffects.statBonusFlat[key]
    percentSum[key] += relicEffects.statBonusPercent[key]
  }

  // 무기 기본 공격력 — 장착은 깡스탯, 보유는 퍼센트(둘 다 종류 불문 ATK)
  const weaponBonus = computeWeaponBonusBreakdown(ownedWeapons, equippedWeaponId)
  flatTotal.atk += weaponBonus.atkFlat
  percentSum.atk += weaponBonus.atkPercent

  if (equippedWeaponId) {
    const { type } = parseWeaponId(equippedWeaponId)
    const primaryStat = masteryPrimaryStat(type)
    // 무기 특화 효과 — 장착은 깡스탯, 보유는 퍼센트
    flatTotal[primaryStat] += weaponBonus.specialtyFlat
    percentSum[primaryStat] += weaponBonus.specialtyPercent
    // 무기 숙련 — 퍼센트
    percentSum[primaryStat] += masteryBonusPercent(type, masteryLevels[type] ?? 0)
  }

  const stats = {} as Record<StatKey, number>
  for (const key of STAT_KEYS) {
    const value = flatTotal[key] * (1 + percentSum[key] / 100)
    // 밸런스 데이터 이상(예: CommonTable 키 누락) 등으로 값이 깨지면 전투 루프가
    // 조용히 멈춰버린다(NaN은 어떤 비교에도 true가 안 돼 데미지도, 처치 판정도 멈춘다).
    // 그런 사고를 완전히 막을 수는 없지만, 최소한 콘솔에 남기고 깡스탯만으로
    // 계속 진행되게 한다 — 0/NaN보다는 "약하게라도 진행"이 항상 낫다.
    if (!Number.isFinite(value)) {
      console.error(`[computeEffectiveStats] ${key} 계산 결과가 유효하지 않습니다(NaN/Infinity) — 깡스탯만 적용합니다.`, {
        flat: flatTotal[key],
        percent: percentSum[key],
      })
      stats[key] = Number.isFinite(flatTotal[key]) ? flatTotal[key] : 0
    } else {
      stats[key] = value
    }
  }

  return { stats }
}

// 위 계산 결과를 zustand set()의 부분 상태 객체로 바로 스프레드할 수 있는 형태로
// 감싼 헬퍼 — 매 액션마다 반복되는 "stats: computeEffectiveStats(...)." 줄을
// "...statsPatch(...)."로 줄인다.
function statsPatch(
  statLevels: Record<StatKey, number>,
  masteryLevels: Record<string, number>,
  existTreeBonus: Record<StatKey, number>,
  ownedWeapons: OwnedWeapons,
  equippedWeaponId: string | null,
  activeRelics: ActiveRelicSlots,
): { stats: Record<StatKey, number> } {
  return computeEffectiveStats(statLevels, masteryLevels, existTreeBonus, ownedWeapons, equippedWeaponId, activeRelics)
}

// 리버스 시 재화 하나의 다음 값을 계산한다. CurrencyTable.ResetOnRebirth가
// false면 리버스와 무관하게 그대로(예: 시간에너지). true면 0으로 초기화되고,
// 거기에 RefundOnRebirth까지 true면 grantAmount로 채워진다(false면 0인 채로
// 남는다 — 예: EXIST는 초기화만 되고 재지급은 없음).
function nextCurrencyOnRebirth(type: CurrencyTypeEnum, current: number, grantAmount: number): number {
  const config = getCurrencyConfig(type)
  if (!config.ResetOnRebirth) return current
  return config.RefundOnRebirth ? grantAmount : 0
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
  rebirthCount: number
  // 역대 최고 도달 스테이지 — 리버스해도 초기화되지 않는다(랭킹, 리버스 보상 구간
  // 판정 전용 기록). "이번 회차에서 어디까지 최초 클리어했는지"와는 별개 개념이라
  // firstClearMaxStage와 완전히 분리했다(예전엔 이 값 하나로 최초 클리어까지
  // 겸용했는데, 그러면 리버스 후 스테이지가 1로 돌아가도 이 값은 그대로 남아있어
  // 예전에 도달했던 스테이지까지는 최초 클리어 다이아가 전혀 나오지 않는 버그가
  // 있었다).
  rebirthMaxStage: number
  // 이번 회차(리버스 이후)에 최초 클리어 다이아를 이미 지급한 최고 스테이지 —
  // 리버스 시 0으로 초기화되어, 매 회차 같은 스테이지를 다시 지나가도 최초 클리어
  // 다이아가 다시 나온다. rebirthMaxStage와 달리 랭킹/리버스 보상 구간에는 쓰이지
  // 않는다(battleLoop.ts의 최초 클리어 판정 전용).
  firstClearMaxStage: number
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
  bulkUnlockExistNodes: () => BulkExistUnlockResult | null
  unlockSpecial: (id: SpecialUnlockId) => boolean
  executeRebirth: () => void
  executeTimeHeist: () => boolean
  resetTimeHeistCooldown: () => void
  resetTimeHeistUsedCount: () => void
  claimOfflineReward: () => void
  resetRebirthBonus: () => void

  // 무기
  grantWeapon: (weaponId: string, count: number) => void
  pullWeaponGacha: () => WeaponGachaPullResult | null
  pullWeaponGachaTimes: (times: number) => WeaponGachaPullResult[]
  equipWeapon: (weaponId: string) => boolean
  levelUpWeapon: (weaponId: string) => boolean
  maxLevelUpWeapon: (weaponId: string) => void
  breakthroughWeapon: (weaponId: string) => boolean
  bulkBreakthroughWeapon: (weaponId: string) => BulkBreakthroughResult | null
  bulkBreakthroughWeaponType: (type: WeaponTypeEnum) => TypeBulkBreakthroughResult | null
  mergeWeapon: (weaponId: string) => boolean
  bulkMergeWeapon: (weaponId: string, chain: boolean) => BulkFusionResult | null
  bulkMergeWeaponType: (type: WeaponTypeEnum) => TypeBulkFusionResult | null

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
const startRebirthMaxStage = Math.max(persistedGame?.rebirthMaxStage ?? startStage, startStage)
const startFirstClearMaxStage = Math.max(persistedGame?.firstClearMaxStage ?? startStage, startStage)
const startOwnedWeapons = persistedGame?.ownedWeapons ?? initialOwnedWeapons
const startEquippedWeaponId = persistedGame?.equippedWeaponId ?? null
const startGachaCount = persistedGame?.gachaCount ?? 0
const startGachaLevel = persistedGame?.gachaLevel ?? currentGachaLevelConfig(startGachaCount).GachaLevel
const startOwnedRelics = persistedGame?.ownedRelics ?? []
const startActiveRelics = persistedGame?.activeRelics ?? initialActiveRelics
const { stats: startStats } = computeEffectiveStats(
  startStatLevels,
  startMasteryLevels,
  startExistTreeStatBonus,
  startOwnedWeapons,
  startEquippedWeaponId,
  startActiveRelics,
)

// 오프라인 보상은 앱 시작 시 단 한 번, 이전 세션이 끝난 시각과 지금의 차이로 계산한다.
// (스테이지는 그대로 두고 재화만 지급 — 실제 battle 진행에는 영향 없음)
const startRelicEffects = computeActiveRelicEffects(startActiveRelics)
const startOfflineReward =
  lastSessionEndedAt !== null
    ? computeOfflineReward(
        Date.now() - lastSessionEndedAt,
        startStage,
        startStats,
        startRelicEffects.goldGainBonusPercent,
        startRelicEffects.growthGainBonusPercent,
      )
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
  rebirthCount: startRebirthCount,
  rebirthMaxStage: startRebirthMaxStage,
  firstClearMaxStage: startFirstClearMaxStage,
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
        ...statsPatch(
          statLevels,
          state.masteryLevels,
          state.existTreeStatBonus,
          state.ownedWeapons,
          state.equippedWeaponId,
          state.activeRelics,
        ),
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
        ...statsPatch(
          statLevels,
          state.masteryLevels,
          state.existTreeStatBonus,
          state.ownedWeapons,
          state.equippedWeaponId,
          state.activeRelics,
        ),
      }
    })
    return true
  },

  maxUpgradeAll: () => {
    const order: StatKey[] = ['atk', 'aspd', 'crit', 'critDmg', 'existGain']
    const statLevels = { ...get().statLevels }
    let growthEnergy = get().currencies.growthEnergy

    for (const key of order) {
      let level = statLevels[key]
      while (growthEnergy >= statUpgradeCost(key, level)) {
        growthEnergy -= statUpgradeCost(key, level)
        level += 1
      }
      statLevels[key] = level
    }

    set((state) => ({
      statLevels,
      ...statsPatch(
        statLevels,
        state.masteryLevels,
        state.existTreeStatBonus,
        state.ownedWeapons,
        state.equippedWeaponId,
        state.activeRelics,
      ),
      currencies: { ...state.currencies, growthEnergy },
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
        ...statsPatch(
          state.statLevels,
          masteryLevels,
          state.existTreeStatBonus,
          state.ownedWeapons,
          state.equippedWeaponId,
          state.activeRelics,
        ),
      }
    })
    return true
  },

  maxUpgradeMastery: (weaponType) => {
    const masteryLevels = { ...get().masteryLevels }
    let essence = get().currencies.essence
    const targets = weaponType ? MASTERY_WEAPONS.filter((weapon) => weapon.id === weaponType) : MASTERY_WEAPONS

    for (const weapon of targets) {
      let level = masteryLevels[weapon.id] ?? 0
      while (essence >= masteryUpgradeCost(weapon.id, level)) {
        essence -= masteryUpgradeCost(weapon.id, level)
        level += 1
      }
      masteryLevels[weapon.id] = level
    }

    set((state) => ({
      masteryLevels,
      ...statsPatch(
        state.statLevels,
        masteryLevels,
        state.existTreeStatBonus,
        state.ownedWeapons,
        state.equippedWeaponId,
        state.activeRelics,
      ),
      currencies: { ...state.currencies, essence },
    }))
  },

  setStage: (stage) =>
    set((state) => ({
      currentStage: stage,
      rebirthMaxStage: Math.max(state.rebirthMaxStage, stage),
      firstClearMaxStage: Math.max(state.firstClearMaxStage, stage),
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
          ...statsPatch(
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

  // 일괄 해금(v0.4.0) — 보유 EXIST로 가능한 만큼 연속 해금. 노드 하나하나마다
  // set()을 부르면(unlockNextExistNode를 반복 호출) 무거운 statsPatch 재계산이
  // 그만큼 반복되므로, 시뮬레이션 결과를 한 번에 커밋한다(gachaTimes와 같은 패턴).
  bulkUnlockExistNodes: () => {
    const state = get()
    const result = simulateBulkExistUnlock(EXIST_TREE_NODES, state.unlockedCount, state.currencies.exist, state.specialUnlocks)
    if (result.toCount === result.fromCount) return null

    set((state) => {
      const existTreeStatBonus = { ...state.existTreeStatBonus }
      for (const [stat, value] of Object.entries(result.statGains)) {
        existTreeStatBonus[stat as StatKey] += value ?? 0
      }
      const currencies = { ...state.currencies, exist: state.currencies.exist - result.totalCost }
      for (const [currency, amount] of Object.entries(result.currencyGrants)) {
        currencies[currency as CurrencyKey] += amount ?? 0
      }
      return {
        unlockedCount: result.toCount,
        existTreeStatBonus,
        currencies,
        ...statsPatch(
          state.statLevels,
          state.masteryLevels,
          existTreeStatBonus,
          state.ownedWeapons,
          state.equippedWeaponId,
          state.activeRelics,
        ),
      }
    })

    return result
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
    // CommonTable로 옮겨갔다. 재화별 리버스 처리는 CurrencyTable의 두 칼럼이
    // 결정한다: ResetOnRebirth(0으로 초기화할지)와 RefundOnRebirth(초기화 후
    // 구간별 지급량을 새로 채울지 — false면 초기화만 되고 0으로 남는다).
    // 5단계 개편(재화 초기화 범위 확장)까지는 ResetOnRebirth가 스키마만 있고
    // 읽히지 않는 죽은 칼럼이었는데, 이제 재화마다 "초기화만" vs "초기화+재지급"이
    // 갈려서(다이아·EXIST는 초기화만 또는 초기화+재지급, 시간에너지는 둘 다 아님)
    // 두 칼럼을 각자의 역할로 살려 썼다.
    const resetStage = getCommonBool('RebirthResetStage')
    const resetStats = getCommonBool('RebirthResetStats')
    const resetMastery = getCommonBool('RebirthResetMastery')
    const keepExistTree = getCommonBool('RebirthKeepExistTree')

    set((state) => {
      // 리버스 횟수 배율은 "이번 리버스를 실행하기 전" rebirthCount로 계산한다
      // (첫 리버스는 항상 ×1.00). rebirthCount 자체의 증가(nextRebirthCount)는
      // 이 계산 다음에 이뤄진다.
      const rewardRow = getRebirthRewardRow(state.currentStage)
      const countMultiplier = computeRebirthCountMultiplier(state.rebirthCount)
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
        rebirthMaxStage: nextRebirthMaxStage,
        // 최초 클리어 기록은 회차마다 초기화 — nextStage(보통 1)부터 다시 최초
        // 클리어 다이아를 받을 수 있어야 한다. rebirthMaxStage(랭킹/리버스 보상
        // 구간 판정용)는 위에서 그대로 유지된다.
        firstClearMaxStage: nextStage,
        ownedWeapons: nextOwnedWeapons,
        equippedWeaponId: nextEquippedWeaponId,
        ownedRelics: nextOwnedRelics,
        activeRelics: nextActiveRelics,
        ...statsPatch(
          nextStatLevels,
          nextMasteryLevels,
          nextExistTreeStatBonus,
          nextOwnedWeapons,
          nextEquippedWeaponId,
          nextActiveRelics,
        ),
        // growthEnergy/gold/essence/diamond는 "누적 소비량 환급"이 아니라 "도달
        // 스테이지 구간의 고정 지급량 × 리버스 횟수 배율"로 새로 지급된다(다이아는
        // 가챠 재화라 인플레이션 우려로 횟수 배율 미적용 — 구간 고정값만). exist는
        // 초기화만 되고 재지급은 없다(존재력 트리 해금 자체는 keepExistTree로 별도
        // 유지되고, EXIST는 전투로 다시 모으는 재화라 재지급 소스가 없다).
        // timeEnergy는 시간에너지를 제외해달라는 요청대로 리버스와 완전히 무관하게
        // 그대로 유지된다. 각 재화의 실제 분기는 CurrencyTable.ResetOnRebirth/
        // RefundOnRebirth로 결정되므로(nextCurrencyOnRebirth), 재화 구성을 바꾸고
        // 싶으면 코드가 아니라 그 두 칼럼만 고치면 된다.
        currencies: {
          ...state.currencies,
          exist: nextCurrencyOnRebirth('EXIST', state.currencies.exist, 0),
          growthEnergy: nextCurrencyOnRebirth(
            'GROWTH_ENERGY',
            state.currencies.growthEnergy,
            Math.floor(rewardRow.GrowthEnergyReward * countMultiplier),
          ),
          gold: nextCurrencyOnRebirth('GOLD', state.currencies.gold, Math.floor(rewardRow.GoldReward * countMultiplier)),
          essence: nextCurrencyOnRebirth(
            'MASTERY_ESSENCE',
            state.currencies.essence,
            Math.floor(rewardRow.MasteryEssenceReward * countMultiplier),
          ),
          diamond: nextCurrencyOnRebirth('DIAMOND', state.currencies.diamond, rewardRow.DiamondReward),
          timeEnergy: nextCurrencyOnRebirth('TIME_ENERGY', state.currencies.timeEnergy, 0),
        },
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

    // 랭킹 등록 — submitRankingIfNewBest가 "이미 랭킹 서버에 알려준 최고 스테이지"
    // 보다 실제로 더 깊이 도달했을 때만 보낸다. rebirthMaxStage는 스테이지를 클리어할
    // 때마다(setStage) 실시간으로 갱신되는 값이라 리버스 시점의 currentStage와 이미
    // 같아져 있으므로, "이번 회차가 기록을 갱신했는지"는 이 값 자체가 아니라 저
    // 함수가 참조하는 별도 기준점(rankingStorage의 lastSubmittedStage)으로 판정한다.
    submitRankingIfNewBest({
      playerName: get().playerName,
      maxStage: get().rebirthMaxStage,
      playTime: get().totalPlayTime,
      rebirthCount: get().rebirthCount,
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
      relicEffects.growthGainBonusPercent,
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

  // 개발자 콘솔 테스트용: 리버스 횟수·최고 도달 스테이지·최초 클리어 기록 초기화
  resetRebirthBonus: () => set({ rebirthCount: 0, rebirthMaxStage: 0, firstClearMaxStage: 0 }),

  // 무기 타입을 count만큼 지급(없으면 신규 생성, 있으면 count만 증가). 가챠/합성/개발자
  // 콘솔 지급이 전부 이 액션을 공유한다.
  grantWeapon: (weaponId, count) =>
    set((state) => {
      const ownedWeapons = grantWeaponEntry(state.ownedWeapons, weaponId, count)
      return {
        ownedWeapons,
        ...statsPatch(
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

    const mythicChanceBonus = computeActiveRelicEffects(get().activeRelics).mythicChanceBonus
    const weaponId = rollWeaponGacha(get().gachaCount, mythicChanceBonus)
    const isDuplicate = (get().ownedWeapons[weaponId]?.count ?? 0) > 0

    set((state) => {
      const nextGachaCount = state.gachaCount + 1
      const ownedWeapons = grantWeaponEntry(state.ownedWeapons, weaponId, 1)
      return {
        ownedWeapons,
        gachaCount: nextGachaCount,
        gachaLevel: currentGachaLevelConfig(nextGachaCount).GachaLevel,
        ...statsPatch(
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
    const mythicChanceBonus = computeActiveRelicEffects(get().activeRelics).mythicChanceBonus

    set((state) => {
      let diamond = state.currencies.diamond
      let gachaCount = state.gachaCount
      let ownedWeapons = state.ownedWeapons

      for (let i = 0; i < times; i++) {
        const cost = currentGachaLevelConfig(gachaCount).PullCostDiamond
        if (diamond < cost) break
        diamond -= cost

        const weaponId = rollWeaponGacha(gachaCount, mythicChanceBonus)
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
        ...statsPatch(
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
      ...statsPatch(
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
        ...statsPatch(
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
        ...statsPatch(
          state.statLevels,
          state.masteryLevels,
          state.existTreeStatBonus,
          ownedWeapons,
          state.equippedWeaponId,
          state.activeRelics,
        ),
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
        ...statsPatch(
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

  // 일괄 돌파(v0.4.0) — 순수 시뮬레이션(weapon.ts) 결과를 그대로 커밋한다.
  bulkBreakthroughWeapon: (weaponId) => {
    const entry = get().ownedWeapons[weaponId]
    if (!entry) return null
    const result = simulateBulkBreakthrough(entry)
    if (result.toBreakthroughCount === result.fromBreakthroughCount) return null

    set((state) => {
      const ownedWeapons = { ...state.ownedWeapons, [weaponId]: result.entry }
      return {
        ownedWeapons,
        ...statsPatch(
          state.statLevels,
          state.masteryLevels,
          state.existTreeStatBonus,
          ownedWeapons,
          state.equippedWeaponId,
          state.activeRelics,
        ),
      }
    })
    return result
  },

  // 무기군 단위 일괄 돌파(v0.4.0) — "지금 보고 있는 무기 종류" 전체(30칸)에서
  // 돌파 가능한 건 전부 처리한다. bulkBreakthroughWeapon(무기 하나만 반복)과는
  // 대상 범위가 다르다.
  bulkBreakthroughWeaponType: (type) => {
    const result = simulateTypeBulkBreakthrough(get().ownedWeapons, type)
    if (result.entries.length === 0) return null

    set((state) => ({
      ownedWeapons: result.ownedWeapons,
      ...statsPatch(
        state.statLevels,
        state.masteryLevels,
        state.existTreeStatBonus,
        result.ownedWeapons,
        state.equippedWeaponId,
        state.activeRelics,
      ),
    }))
    return result
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
        ...statsPatch(
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

  // 일괄 합성(v0.4.0) — chain=false면 한 등급/단계 경계만, chain=true면 결과물로
  // 또 합성 가능한 한 계속 이어간다(연쇄 여부는 화면에서 사용자가 선택).
  bulkMergeWeapon: (weaponId, chain) => {
    const result = simulateBulkFusion(get().ownedWeapons, weaponId, chain)
    if (result.steps.length === 0) return null

    set((state) => ({
      ownedWeapons: result.ownedWeapons,
      ...statsPatch(
        state.statLevels,
        state.masteryLevels,
        state.existTreeStatBonus,
        result.ownedWeapons,
        state.equippedWeaponId,
        state.activeRelics,
      ),
    }))
    return result
  },

  // 무기군 단위 일괄 합성(v0.4.0) — 낮은 등급/단계부터 순서대로 한 칸씩 합성하며
  // 훑는다(개별 무기의 chain=true와 달리, 30칸을 도는 순서 자체가 사다리
  // 전체를 이미 훑는 효과를 낸다).
  bulkMergeWeaponType: (type) => {
    const result = simulateTypeBulkFusion(get().ownedWeapons, type)
    if (result.steps.length === 0) return null

    set((state) => ({
      ownedWeapons: result.ownedWeapons,
      ...statsPatch(
        state.statLevels,
        state.masteryLevels,
        state.existTreeStatBonus,
        result.ownedWeapons,
        state.equippedWeaponId,
        state.activeRelics,
      ),
    }))
    return result
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
        ...statsPatch(
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
    rebirthCount: state.rebirthCount,
    rebirthMaxStage: state.rebirthMaxStage,
    firstClearMaxStage: state.firstClearMaxStage,
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

// 랭킹 등록의 실제 트리거는 executeRebirth() 안(리버스 성공 직후)과, 아래의
// "리버스 미해금 사용자" 보조 경로 두 곳뿐이다. 두 곳 모두 이름이 비어있거나
// 기본값이면 등록하지 않는다는 조건이 같아 여기 하나로 모았다. submitRanking
// 자체가 실패를 삼키므로 여기서도 호출만 하고 결과를 기다리지 않는다.
function submitRankingIfNamed(entry: Parameters<typeof submitRanking>[0]): void {
  if (!isRankingEnabled) return
  const trimmedName = entry.playerName.trim()
  if (trimmedName.length === 0 || trimmedName === DEFAULT_PLAYER_NAME) return
  void submitRanking({ ...entry, playerName: trimmedName })
}

// 리버스 시점 등록 전용 — "이미 랭킹 서버에 알려준 최고 스테이지"(rankingStorage의
// lastSubmittedStage, 아래 보조 경로와 공유)보다 실제로 더 깊이 도달했을 때만
// 보낸다. 그렇지 않으면 같은 자리(또는 그보다 낮은 자리)에서 반복 리버스할 때마다
// 중복 등록하게 된다.
function submitRankingIfNewBest(entry: Parameters<typeof submitRanking>[0]): void {
  if (entry.maxStage <= readLastSubmittedStage()) return
  writeLastSubmittedStage(entry.maxStage)
  submitRankingIfNamed(entry)
}

// 리버스를 아직 해금하지 못한 사용자는 리버스라는 등록 계기 자체가 없어 랭킹에
// 영영 오르지 못한다 — 그 구간에서만 보조로, 최고 스테이지가 20 단위 구간을 새로
// 넘을 때 등록한다. 마지막으로 등록을 시도한 스테이지는 게임 세이브와 별개로
// 로컬스토리지에 둔다(rankingStorage.ts) — 새로고침해도 같은 구간에서 중복
// 등록하지 않는다. 리버스를 해금하고 나면(그러면 아래 executeRebirth 쪽 등록으로
// 넘어가므로) 이 경로는 완전히 멈춘다.
const PRE_REBIRTH_RANKING_STAGE_INTERVAL = 20

useGameStore.subscribe((state) => {
  if (state.specialUnlocks.reverse) return

  const maxStageEver = Math.max(state.rebirthMaxStage, state.currentStage)
  const lastSubmitted = readLastSubmittedStage()
  const currentMilestone = Math.floor(maxStageEver / PRE_REBIRTH_RANKING_STAGE_INTERVAL)
  const lastMilestone = Math.floor(lastSubmitted / PRE_REBIRTH_RANKING_STAGE_INTERVAL)
  if (currentMilestone <= lastMilestone) return

  writeLastSubmittedStage(maxStageEver)
  submitRankingIfNamed({
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
      '- __gameStore.getState().resetRebirthBonus() — 리버스 횟수/최고 스테이지/최초 클리어 기록 초기화',
      '- __setLastActiveHoursAgo(hours) — 마지막 접속 시각을 n시간 전으로(오프라인 보상 테스트, 새로고침 필요)',
    ].join('\n'),
  )
}
