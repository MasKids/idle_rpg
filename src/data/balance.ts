// balance.json(= balance/balance.xlsx 빌드 결과)을 타입이 붙은 테이블로 노출한다.
// 각 테이블은 엑셀 4행(영문 칼럼명)을 그대로 필드명으로 쓰는 행 객체의 배열이다.
// 조회 헬퍼가 원하는 행을 못 찾으면 콘솔에 경고를 남기고 안전한 기본값을 반환한다 —
// 엑셀 데이터가 일시적으로 비어있거나 잘못돼도 게임이 죽지 않게 하기 위함.
import balanceJson from './balance.json'

// ---------------------------------------------------------------------------
// enum 값 (#EnumDefine과 동일)
// ---------------------------------------------------------------------------

export type StatTypeEnum = 'ATK' | 'DEF' | 'ASPD' | 'CRIT' | 'CRIT_DMG' | 'EXIST_GAIN'
export type StageTypeEnum = 'Normal' | 'Boss'
export type NodeEffectTypeEnum = 'STAT' | 'GRANT'
export type CurrencyTypeEnum = 'EXIST' | 'GROWTH_ENERGY' | 'MASTERY_ESSENCE' | 'TIME_ENERGY' | 'GOLD'
export type FeatureTypeEnum = 'REBIRTH' | 'TIME_HEIST'
export type WeaponTypeEnum = 'Sword' | 'Spear' | 'Bow'
export type WeaponGradeEnum = 'Normal' | 'Rare' | 'Epic' | 'Unique' | 'Legendary'
export type RelicGradeEnum = 'Normal' | 'Rare' | 'Epic'
export type RelicEffectTypeEnum =
  | 'STAT_ATK'
  | 'STAT_DEF'
  | 'STAT_ASPD'
  | 'STAT_CRIT'
  | 'STAT_CRIT_DMG'
  | 'STAT_EXIST_GAIN'
  | 'GOLD_GAIN'
  | 'TIMEHEIST_COOLDOWN'

// ---------------------------------------------------------------------------
// 테이블별 행 타입 — 엑셀 4행 칼럼명 그대로
// ---------------------------------------------------------------------------

export interface StageTableRow {
  Index: number
  Id: number
  Chapter: number
  StageType: StageTypeEnum
  EnemyHp: number
  EnemyAtk: number
  KillCount: number
  RewardGold: number
  RewardGrowth: number
  RewardExist: number
  RewardTimeEnergy: number
  HpGrowthRate: number
  RewardGrowthRate: number
}

export interface StatTableRow {
  Index: number
  Id: number
  StatType: StatTypeEnum
  Name: number
  BaseValue: number
  ValuePerLevel: number
  CostBase: number
  CostGrowthRate: number
  MaxLevel: number
}

export interface ExistTreeTableRow {
  Index: number
  Id: number
  Tier: number
  OrderFrom: number
  OrderTo: number
  EffectType: NodeEffectTypeEnum
  StatType: StatTypeEnum | ''
  GrantCurrency: CurrencyTypeEnum | ''
  ValueBase: number
  ValuePerNode: number
  CostBase: number
  CostGrowthRate: number
}

export interface FeatureUnlockTableRow {
  Index: number
  Id: number
  FeatureType: FeatureTypeEnum
  Name: number
  RequireNodeCount: number
  UnlockCost: number
}

export interface MasteryTableRow {
  Index: number
  Id: number
  WeaponType: WeaponTypeEnum
  Name: number
  MultiplierPerLevel: number
  CostBase: number
  CostGrowthRate: number
  MaxLevel: number
}

export interface WeaponTypeTableRow {
  Index: number
  Id: number
  WeaponType: WeaponTypeEnum
  Name: number
  PrimaryStat: StatTypeEnum
  OwnBonusBase: number
  EquipBonusBase: number
}

export interface WeaponGradeTableRow {
  Index: number
  Id: number
  WeaponGrade: WeaponGradeEnum
  Name: number
  GradeMultiplier: number
}

export interface WeaponUpgradeTableRow {
  Index: number
  Id: number
  BaseMaxLevel: number
  LevelCostBase: number
  LevelCostGrowthRate: number
  TierStepBonusPercent: number
  BaseAtkOwnBonusPerLevel: number
  BaseAtkEquipBonusPerLevel: number
}

export interface WeaponBreakthroughTableRow {
  Index: number
  Id: number
  BreakthroughStep: number
  RequiredDuplicateCount: number
  LevelCapBonus: number
}

export interface WeaponFusionTableRow {
  Index: number
  Id: number
  RequiredCount: number
  ResultLevel: number
  ResultBreakthroughCount: number
}

export interface GachaTableRow {
  Index: number
  Id: number
  GachaLevel: number
  RequirePullCount: number
  NormalWeight: number
  RareWeight: number
  EpicWeight: number
  UniqueWeight: number
  LegendaryWeight: number
  Tier1Weight: number
  Tier2Weight: number
  Tier3Weight: number
  Tier4Weight: number
  Tier5Weight: number
  PullCostDiamond: number
}

export interface RelicTableRow {
  Index: number
  Id: number
  RelicGrade: RelicGradeEnum
  Name: number
  EffectType: RelicEffectTypeEnum
  EffectValue: number
  GachaWeight: number
}

export interface RelicSlotTableRow {
  Index: number
  Id: number
  SlotIndex: number
  RequireUnlockedCount: number
}

export interface TimeHeistTableRow {
  Index: number
  Id: number
  CostBase: number
  CostGrowthRate: number
  CooldownBase: number
  CooldownGrowthRate: number
  TargetStageOffset: number
  RewardMultiplier: number
}

export interface RebirthTableRow {
  Index: number
  Id: number
  ResetStage: boolean
  ResetStats: boolean
  ResetEquipment: boolean
  ResetMastery: boolean
  RefundGrowthEnergy: boolean
  RefundGold: boolean
  RefundMasteryEssence: boolean
  KeepExistTree: boolean
  BonusBase: number
  BonusExponent: number
  RefundBonusPerPoint: number
  MaxRefundMultiplier: number
}

export interface CommonTableRow {
  Index: number
  Id: number
  Key: string
  Value: number
  ValueType: string
}

export interface StringTableRow {
  Index: number
  Id: number
  KOR: string
  ENG: string
}

interface BalanceTables {
  StageTable: StageTableRow[]
  StatTable: StatTableRow[]
  ExistTreeTable: ExistTreeTableRow[]
  FeatureUnlockTable: FeatureUnlockTableRow[]
  MasteryTable: MasteryTableRow[]
  WeaponTypeTable: WeaponTypeTableRow[]
  WeaponGradeTable: WeaponGradeTableRow[]
  WeaponUpgradeTable: WeaponUpgradeTableRow[]
  WeaponBreakthroughTable: WeaponBreakthroughTableRow[]
  WeaponFusionTable: WeaponFusionTableRow[]
  GachaTable: GachaTableRow[]
  RelicTable: RelicTableRow[]
  RelicSlotTable: RelicSlotTableRow[]
  TimeHeistTable: TimeHeistTableRow[]
  RebirthTable: RebirthTableRow[]
  CommonTable: CommonTableRow[]
  StringTable: StringTableRow[]
}

const TABLES = balanceJson as unknown as BalanceTables

function warnMissing(table: string, criteria: string): void {
  console.warn(`[balance] ${table}에서 ${criteria}에 해당하는 행을 찾지 못해 기본값을 사용합니다.`)
}

// ---------------------------------------------------------------------------
// 조회 실패 시 반환할 기본값 — 엑셀이 비어있어도 게임이 안전하게 동작하도록
// ---------------------------------------------------------------------------

const DEFAULT_STAT: StatTableRow = {
  Index: 0,
  Id: 0,
  StatType: 'ATK',
  Name: 0,
  BaseValue: 1,
  ValuePerLevel: 1,
  CostBase: 8,
  CostGrowthRate: 1.18,
  MaxLevel: 9999,
}

const DEFAULT_STAGE: StageTableRow = {
  Index: 0,
  Id: 0,
  Chapter: 1,
  StageType: 'Normal',
  EnemyHp: 20,
  EnemyAtk: 3,
  KillCount: 5,
  RewardGold: 5,
  RewardGrowth: 2,
  RewardExist: 1,
  RewardTimeEnergy: 0,
  HpGrowthRate: 1.15,
  RewardGrowthRate: 1.1,
}

const DEFAULT_EXIST_TREE_TIER: ExistTreeTableRow = {
  Index: 0,
  Id: 0,
  Tier: 1,
  OrderFrom: 1,
  OrderTo: 10,
  EffectType: 'STAT',
  StatType: 'ATK',
  GrantCurrency: '',
  ValueBase: 5,
  ValuePerNode: 0.6,
  CostBase: 10,
  CostGrowthRate: 1.35,
}

const DEFAULT_FEATURE_UNLOCK: FeatureUnlockTableRow = {
  Index: 0,
  Id: 0,
  FeatureType: 'REBIRTH',
  Name: 0,
  RequireNodeCount: 15,
  UnlockCost: 667,
}

const DEFAULT_MASTERY: MasteryTableRow = {
  Index: 0,
  Id: 0,
  WeaponType: 'Sword',
  Name: 0,
  MultiplierPerLevel: 0.05,
  CostBase: 10,
  CostGrowthRate: 1.25,
  MaxLevel: 9999,
}

const DEFAULT_WEAPON_TYPE: WeaponTypeTableRow = {
  Index: 0,
  Id: 0,
  WeaponType: 'Sword',
  Name: 0,
  PrimaryStat: 'ATK',
  OwnBonusBase: 0.5,
  EquipBonusBase: 5,
}

const DEFAULT_WEAPON_GRADE: WeaponGradeTableRow = {
  Index: 0,
  Id: 0,
  WeaponGrade: 'Normal',
  Name: 0,
  GradeMultiplier: 1,
}

const DEFAULT_WEAPON_UPGRADE: WeaponUpgradeTableRow = {
  Index: 0,
  Id: 0,
  BaseMaxLevel: 10,
  LevelCostBase: 15,
  LevelCostGrowthRate: 1.2,
  TierStepBonusPercent: 10,
  BaseAtkOwnBonusPerLevel: 0.5,
  BaseAtkEquipBonusPerLevel: 5,
}

const DEFAULT_WEAPON_BREAKTHROUGH: WeaponBreakthroughTableRow = {
  Index: 0,
  Id: 0,
  BreakthroughStep: 1,
  RequiredDuplicateCount: 1,
  LevelCapBonus: 10,
}

const DEFAULT_WEAPON_FUSION: WeaponFusionTableRow = {
  Index: 0,
  Id: 0,
  RequiredCount: 5,
  ResultLevel: 1,
  ResultBreakthroughCount: 0,
}

const DEFAULT_GACHA_LEVEL: GachaTableRow = {
  Index: 0,
  Id: 0,
  GachaLevel: 0,
  RequirePullCount: 0,
  NormalWeight: 70,
  RareWeight: 22,
  EpicWeight: 6,
  UniqueWeight: 1.8,
  LegendaryWeight: 0.2,
  Tier1Weight: 60,
  Tier2Weight: 25,
  Tier3Weight: 10,
  Tier4Weight: 4,
  Tier5Weight: 1,
  PullCostDiamond: 100,
}

const DEFAULT_RELIC: RelicTableRow = {
  Index: 0,
  Id: 0,
  RelicGrade: 'Normal',
  Name: 0,
  EffectType: 'STAT_ATK',
  EffectValue: 0,
  GachaWeight: 0,
}

const DEFAULT_RELIC_SLOT: RelicSlotTableRow = {
  Index: 0,
  Id: 0,
  SlotIndex: 1,
  RequireUnlockedCount: 10,
}

const DEFAULT_TIME_HEIST: TimeHeistTableRow = {
  Index: 0,
  Id: 0,
  CostBase: 20,
  CostGrowthRate: 2.0,
  CooldownBase: 7200,
  CooldownGrowthRate: 1.5,
  TargetStageOffset: 10,
  RewardMultiplier: 5,
}

const DEFAULT_REBIRTH: RebirthTableRow = {
  Index: 0,
  Id: 0,
  ResetStage: true,
  ResetStats: true,
  ResetEquipment: true,
  ResetMastery: true,
  RefundGrowthEnergy: true,
  RefundGold: true,
  RefundMasteryEssence: true,
  KeepExistTree: true,
  BonusBase: 1.0,
  BonusExponent: 0.5,
  RefundBonusPerPoint: 1.0,
  MaxRefundMultiplier: 5.0,
}

// ---------------------------------------------------------------------------
// 조회 헬퍼
// ---------------------------------------------------------------------------

export function getStatConfig(statType: StatTypeEnum): StatTableRow {
  const row = TABLES.StatTable.find((r) => r.StatType === statType)
  if (!row) {
    warnMissing('StatTable', `StatType=${statType}`)
    return { ...DEFAULT_STAT, StatType: statType }
  }
  return row
}

// StageType 없이 stage 번호만으로 조회하고 싶을 때를 위해 chapter/stageType 둘 다 받는다.
// 챕터 폭(10스테이지)은 StageTable의 설계 전제이자 stages.ts에서 stage -> chapter 변환에 쓰는 상수.
export function getStageConfig(chapter: number, stageType: StageTypeEnum): StageTableRow {
  const row = TABLES.StageTable.find((r) => r.Chapter === chapter && r.StageType === stageType)
  if (!row) {
    warnMissing('StageTable', `Chapter=${chapter}, StageType=${stageType}`)
    return { ...DEFAULT_STAGE, Chapter: chapter, StageType: stageType }
  }
  return row
}

export function getExistTreeTier(order: number): ExistTreeTableRow {
  const row = TABLES.ExistTreeTable.find((r) => order >= r.OrderFrom && order <= r.OrderTo)
  if (!row) {
    warnMissing('ExistTreeTable', `order=${order}`)
    return DEFAULT_EXIST_TREE_TIER
  }
  return row
}

export function getFeatureUnlock(featureType: FeatureTypeEnum): FeatureUnlockTableRow {
  const row = TABLES.FeatureUnlockTable.find((r) => r.FeatureType === featureType)
  if (!row) {
    warnMissing('FeatureUnlockTable', `FeatureType=${featureType}`)
    return { ...DEFAULT_FEATURE_UNLOCK, FeatureType: featureType }
  }
  return row
}

export function getMasteryConfig(weaponType: WeaponTypeEnum): MasteryTableRow {
  const row = TABLES.MasteryTable.find((r) => r.WeaponType === weaponType)
  if (!row) {
    warnMissing('MasteryTable', `WeaponType=${weaponType}`)
    return { ...DEFAULT_MASTERY, WeaponType: weaponType }
  }
  return row
}

export function getWeaponTypeConfig(weaponType: WeaponTypeEnum): WeaponTypeTableRow {
  const row = TABLES.WeaponTypeTable.find((r) => r.WeaponType === weaponType)
  if (!row) {
    warnMissing('WeaponTypeTable', `WeaponType=${weaponType}`)
    return { ...DEFAULT_WEAPON_TYPE, WeaponType: weaponType }
  }
  return row
}

export function getWeaponGradeConfig(weaponGrade: WeaponGradeEnum): WeaponGradeTableRow {
  const row = TABLES.WeaponGradeTable.find((r) => r.WeaponGrade === weaponGrade)
  if (!row) {
    warnMissing('WeaponGradeTable', `WeaponGrade=${weaponGrade}`)
    return { ...DEFAULT_WEAPON_GRADE, WeaponGrade: weaponGrade }
  }
  return row
}

export function getWeaponUpgradeConfig(): WeaponUpgradeTableRow {
  const row = TABLES.WeaponUpgradeTable[0]
  if (!row) {
    warnMissing('WeaponUpgradeTable', '첫 행')
    return DEFAULT_WEAPON_UPGRADE
  }
  return row
}

export function getWeaponBreakthroughStep(step: number): WeaponBreakthroughTableRow {
  const row = TABLES.WeaponBreakthroughTable.find((r) => r.BreakthroughStep === step)
  if (!row) {
    warnMissing('WeaponBreakthroughTable', `BreakthroughStep=${step}`)
    return { ...DEFAULT_WEAPON_BREAKTHROUGH, BreakthroughStep: step }
  }
  return row
}

export function getWeaponFusionConfig(): WeaponFusionTableRow {
  const row = TABLES.WeaponFusionTable[0]
  if (!row) {
    warnMissing('WeaponFusionTable', '첫 행')
    return DEFAULT_WEAPON_FUSION
  }
  return row
}

// 특정 가챠 레벨의 확률/비용 설정을 그대로 조회
export function getGachaLevelConfig(gachaLevel: number): GachaTableRow {
  const row = TABLES.GachaTable.find((r) => r.GachaLevel === gachaLevel)
  if (!row) {
    warnMissing('GachaTable', `GachaLevel=${gachaLevel}`)
    return { ...DEFAULT_GACHA_LEVEL, GachaLevel: gachaLevel }
  }
  return row
}

// 누적 뽑기 횟수로부터 현재 가챠 레벨 행을 찾는다 — RequirePullCount를 넘지 않는
// 행 중 가장 높은 레벨. GachaTable이 GachaLevel 오름차순으로 정렬돼 있다고 전제한다.
export function getGachaLevelForPullCount(pullCount: number): GachaTableRow {
  const sorted = [...TABLES.GachaTable].sort((a, b) => a.GachaLevel - b.GachaLevel)
  let current: GachaTableRow | undefined
  for (const row of sorted) {
    if (pullCount >= row.RequirePullCount) current = row
    else break
  }
  if (!current) {
    warnMissing('GachaTable', `pullCount=${pullCount}`)
    return DEFAULT_GACHA_LEVEL
  }
  return current
}

export function getRelicConfig(id: number): RelicTableRow {
  const row = TABLES.RelicTable.find((r) => r.Id === id)
  if (!row) {
    warnMissing('RelicTable', `Id=${id}`)
    return { ...DEFAULT_RELIC, Id: id }
  }
  return row
}

export function getRelicSlotConfig(slotIndex: number): RelicSlotTableRow {
  const row = TABLES.RelicSlotTable.find((r) => r.SlotIndex === slotIndex)
  if (!row) {
    warnMissing('RelicSlotTable', `SlotIndex=${slotIndex}`)
    return { ...DEFAULT_RELIC_SLOT, SlotIndex: slotIndex }
  }
  return row
}

export function getTimeHeistConfig(): TimeHeistTableRow {
  const row = TABLES.TimeHeistTable[0]
  if (!row) {
    warnMissing('TimeHeistTable', '첫 행')
    return DEFAULT_TIME_HEIST
  }
  return row
}

export function getRebirthConfig(): RebirthTableRow {
  const row = TABLES.RebirthTable[0]
  if (!row) {
    warnMissing('RebirthTable', '첫 행')
    return DEFAULT_REBIRTH
  }
  return row
}

export function getCommon(key: string): number {
  const row = TABLES.CommonTable.find((r) => r.Key === key)
  if (!row) {
    warnMissing('CommonTable', `Key=${key}`)
    return 0
  }
  return row.Value
}

export function getString(id: number, lang: 'KOR' | 'ENG', fallback = ''): string {
  const row = TABLES.StringTable.find((r) => r.Id === id)
  if (!row) {
    warnMissing('StringTable', `Id=${id}`)
    return fallback
  }
  const value = lang === 'KOR' ? row.KOR : row.ENG
  return value || fallback
}

// 원본 테이블 배열이 통째로 필요할 때(예: 존재력 트리 50노드 생성)를 위한 export
export const BALANCE_TABLES: Readonly<BalanceTables> = TABLES
