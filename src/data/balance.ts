// balance.json(= balance/balance.xlsx 빌드 결과)을 타입이 붙은 객체로 노출한다.
// balance.json에 특정 key가 없으면(엑셀에서 행을 지웠거나 아직 반영 전이면) 아래
// DEFAULTS 값으로 채운다 — 게임이 죽지 않고 항상 안전한 값으로 동작하기 위함.
import balanceJson from './balance.json'

export interface BattleBalance {
  enemyBaseHp: number
  enemyHpGrowth: number
  enemyBaseAtk: number
  enemyAtkGrowth: number
  killsRequiredPerStage: number
  bossInterval: number
  bossHpMultiplier: number
  bossAtkMultiplier: number
  bossRewardMultiplier: number
}

export interface RewardsBalance {
  goldBaseReward: number
  goldGrowth: number
  growthEnergyBaseReward: number
  growthEnergyGrowth: number
  existRewardStageDivisor: number
  existRewardBossMultiplier: number
  bossTimeEnergyReward: number
}

export interface StatsBalance {
  statBaseAtk: number
  statBaseDef: number
  statBaseAspd: number
  statBaseCrit: number
  statBaseCritDmg: number
  statBaseExistGain: number
  statGrowthAtk: number
  statGrowthDef: number
  statGrowthAspd: number
  statGrowthCrit: number
  statGrowthCritDmg: number
  statGrowthExistGain: number
  statUpgradeCostBase: number
  statUpgradeCostGrowth: number
}

export interface EquipmentMasteryBalance {
  equipmentValuePerLevel: number
  equipmentCostBase: number
  equipmentCostGrowth: number
  masteryMultiplierPerLevel: number
  masteryCostBase: number
  masteryCostGrowth: number
}

export interface ExistTreeBalance {
  totalNodes: number
  nodeCostBase: number
  nodeCostGrowth: number
  statValueBase: number
  statValueTierStep: number
  currencyAmountBase: number
  currencyAmountTierStep: number
  reverseRequiredNodes: number
  timeHeistRequiredNodes: number
  reverseUnlockCost: number
  timeHeistUnlockCost: number
}

export interface TimeHeistBalance {
  stageOffset: number
  clearCount: number
  baseCost: number
  costGrowth: number
  baseCooldownSeconds: number
  cooldownGrowth: number
}

export interface OfflineBalance {
  maxHours: number
  rewardMultiplier: number
}

export interface Balance {
  battle: BattleBalance
  rewards: RewardsBalance
  stats: StatsBalance
  equipmentMastery: EquipmentMasteryBalance
  existTree: ExistTreeBalance
  timeHeist: TimeHeistBalance
  offline: OfflineBalance
}

// balance.xlsx가 처음 생성됐을 때 심어둔 값과 동일 — json에 key가 없을 때의 안전망
const DEFAULTS: Balance = {
  battle: {
    enemyBaseHp: 20,
    enemyHpGrowth: 1.15,
    enemyBaseAtk: 3,
    enemyAtkGrowth: 1.12,
    killsRequiredPerStage: 5,
    bossInterval: 10,
    bossHpMultiplier: 5,
    bossAtkMultiplier: 2,
    bossRewardMultiplier: 3,
  },
  rewards: {
    goldBaseReward: 5,
    goldGrowth: 1.1,
    growthEnergyBaseReward: 2,
    growthEnergyGrowth: 1.08,
    existRewardStageDivisor: 10,
    existRewardBossMultiplier: 2,
    bossTimeEnergyReward: 5,
  },
  stats: {
    statBaseAtk: 1,
    statBaseDef: 1,
    statBaseAspd: 1,
    statBaseCrit: 0,
    statBaseCritDmg: 150,
    statBaseExistGain: 1,
    statGrowthAtk: 1,
    statGrowthDef: 1,
    statGrowthAspd: 0.05,
    statGrowthCrit: 0.5,
    statGrowthCritDmg: 2,
    statGrowthExistGain: 0.02,
    statUpgradeCostBase: 8,
    statUpgradeCostGrowth: 1.18,
  },
  equipmentMastery: {
    equipmentValuePerLevel: 2,
    equipmentCostBase: 15,
    equipmentCostGrowth: 1.22,
    masteryMultiplierPerLevel: 0.05,
    masteryCostBase: 10,
    masteryCostGrowth: 1.25,
  },
  existTree: {
    totalNodes: 50,
    nodeCostBase: 10,
    nodeCostGrowth: 1.35,
    statValueBase: 5,
    statValueTierStep: 3,
    currencyAmountBase: 5,
    currencyAmountTierStep: 5,
    reverseRequiredNodes: 15,
    timeHeistRequiredNodes: 33,
    reverseUnlockCost: 667,
    timeHeistUnlockCost: 148142,
  },
  timeHeist: {
    stageOffset: 10,
    clearCount: 5,
    baseCost: 20,
    costGrowth: 2.0,
    baseCooldownSeconds: 7200,
    cooldownGrowth: 1.5,
  },
  offline: {
    maxHours: 8,
    rewardMultiplier: 1,
  },
}

function withDefaults<T extends object>(loaded: unknown, defaults: T): T {
  const source = (typeof loaded === 'object' && loaded !== null ? loaded : {}) as Record<string, unknown>
  const result = {} as T
  for (const key of Object.keys(defaults) as Array<keyof T>) {
    const value = source[key as string]
    result[key] = typeof value === 'number' && Number.isFinite(value) ? (value as T[keyof T]) : defaults[key]
  }
  return result
}

const loaded = balanceJson as Partial<Balance>

export const BALANCE: Balance = {
  battle: withDefaults(loaded.battle, DEFAULTS.battle),
  rewards: withDefaults(loaded.rewards, DEFAULTS.rewards),
  stats: withDefaults(loaded.stats, DEFAULTS.stats),
  equipmentMastery: withDefaults(loaded.equipmentMastery, DEFAULTS.equipmentMastery),
  existTree: withDefaults(loaded.existTree, DEFAULTS.existTree),
  timeHeist: withDefaults(loaded.timeHeist, DEFAULTS.timeHeist),
  offline: withDefaults(loaded.offline, DEFAULTS.offline),
}
