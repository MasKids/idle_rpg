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
export type EquipSlotEnum = 'Weapon' | 'Helmet' | 'Armor' | 'Gloves' | 'Boots'
export type FeatureTypeEnum = 'REBIRTH' | 'TIME_HEIST'

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

export interface EquipmentTableRow {
  Index: number
  Id: number
  EquipSlot: EquipSlotEnum
  Name: number
  StatType: StatTypeEnum
  ValuePerLevel: number
  CostBase: number
  CostGrowthRate: number
  MaxLevel: number
}

export interface MasteryTableRow {
  Index: number
  Id: number
  WeaponId: number
  Name: number
  AtkMultiplierPerLevel: number
  CostBase: number
  CostGrowthRate: number
  MaxLevel: number
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
  EquipmentTable: EquipmentTableRow[]
  MasteryTable: MasteryTableRow[]
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

const DEFAULT_EQUIPMENT: EquipmentTableRow = {
  Index: 0,
  Id: 0,
  EquipSlot: 'Weapon',
  Name: 0,
  StatType: 'ATK',
  ValuePerLevel: 2,
  CostBase: 15,
  CostGrowthRate: 1.22,
  MaxLevel: 9999,
}

const DEFAULT_MASTERY: MasteryTableRow = {
  Index: 0,
  Id: 0,
  WeaponId: 1,
  Name: 0,
  AtkMultiplierPerLevel: 0.05,
  CostBase: 10,
  CostGrowthRate: 1.25,
  MaxLevel: 9999,
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

export function getEquipmentConfig(slot: EquipSlotEnum): EquipmentTableRow {
  const row = TABLES.EquipmentTable.find((r) => r.EquipSlot === slot)
  if (!row) {
    warnMissing('EquipmentTable', `EquipSlot=${slot}`)
    return { ...DEFAULT_EQUIPMENT, EquipSlot: slot }
  }
  return row
}

export function getMasteryConfig(weaponId: number): MasteryTableRow {
  const row = TABLES.MasteryTable.find((r) => r.WeaponId === weaponId)
  if (!row) {
    warnMissing('MasteryTable', `WeaponId=${weaponId}`)
    return { ...DEFAULT_MASTERY, WeaponId: weaponId }
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
