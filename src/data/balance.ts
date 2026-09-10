// balance.json(= balance/balance.xlsx 빌드 결과)을 타입이 붙은 테이블로 노출한다.
// 각 테이블은 엑셀 4행(영문 칼럼명)을 그대로 필드명으로 쓰는 행 객체의 배열이다.
// 조회 헬퍼가 원하는 행을 못 찾으면 콘솔에 경고를 남기고 안전한 기본값을 반환한다 —
// 엑셀 데이터가 일시적으로 비어있거나 잘못돼도 게임이 죽지 않게 하기 위함.
import balanceJson from './balance.json'

// ---------------------------------------------------------------------------
// enum 값 (#EnumDefine과 동일)
// ---------------------------------------------------------------------------

export type StatTypeEnum = 'ATK' | 'ASPD' | 'CRIT' | 'CRIT_DMG' | 'EXIST_GAIN'
export type StageTypeEnum = 'Normal' | 'Boss'
export type NodeEffectTypeEnum = 'STAT' | 'GRANT'
// DIAMOND는 CurrencyTable 신설 전까지 ExistTreeTable.GrantCurrency(다이아를 지급한 적
// 없음)에서만 쓰였던 enum이라 빠져 있었다 — CurrencyTable.Type이 6종 재화를 전부
// 다뤄야 해서 추가했다.
export type CurrencyTypeEnum = 'EXIST' | 'GROWTH_ENERGY' | 'MASTERY_ESSENCE' | 'TIME_ENERGY' | 'GOLD' | 'DIAMOND'
export type FeatureTypeEnum = 'REBIRTH' | 'TIME_HEIST'
export type WeaponTypeEnum = 'Sword' | 'Spear' | 'Bow'
// weapon.ts(무기 로직)와 mastery.ts(숙련 로직) 양쪽이 같은 목록을 쓰므로, 두 시스템
// 사이 의존 방향이 꼬이지 않도록 더 하위 계층인 여기(data/)에 한 곳만 둔다.
export const WEAPON_TYPES: WeaponTypeEnum[] = ['Sword', 'Spear', 'Bow']
// 무기 종류 이름 StringId — WeaponTypeTable 삭제(2026-09-10 개편)로 갈 곳을 잃은
// 값이다. 종류가 3개로 고정돼 있어 테이블화할 실익이 없어 코드 상수로 둔다.
// StringTable의 기존 40055/40056/40057 항목("검"/"창"/"활")을 그대로 참조한다.
export const WEAPON_TYPE_NAME_STRING_ID: Record<WeaponTypeEnum, number> = {
  Sword: 40055,
  Spear: 40056,
  Bow: 40057,
}
export type WeaponGradeEnum = 'Normal' | 'Rare' | 'Epic' | 'Unique' | 'Legendary'
export type RelicGradeEnum = 'Normal' | 'Rare' | 'Epic'
export type RelicEffectTypeEnum =
  | 'STAT_ATK'
  | 'STAT_ASPD'
  | 'STAT_CRIT'
  | 'STAT_CRIT_DMG'
  | 'STAT_EXIST_GAIN'
  | 'GOLD_GAIN'
  | 'TIMEHEIST_COOLDOWN'

// ---------------------------------------------------------------------------
// 테이블별 행 타입 — 엑셀 4행 칼럼명 그대로
// ---------------------------------------------------------------------------

// 스테이지 1개당 1행(200행 = 20챕터 × 10스테이지)으로 전부 나열한다 — 챕터 템플릿 +
// 보간 방식은 폐기(2단계 개편, docs/TABLE_REDESIGN.md 2.2절). HpGrowthRate/
// RewardGrowthRate 칼럼은 보간이 필요 없어지며 함께 사라졌다. Stage로 직접 조회한다.
export interface StageTableRow {
  Index: number
  Id: number
  Stage: number
  Chapter: number
  StageType: StageTypeEnum
  EnemyHp: number
  EnemyAtk: number
  KillCount: number
  RewardGold: number
  RewardGrowth: number
  RewardExist: number
  RewardTimeEnergy: number
  NameStringId: number
  // 이 스테이지를 계정 통틀어 처음 클리어할 때만 지급되는 다이아(3단계 진행 속도
  // 하향 작업에서 신설) — 챕터가 오를수록, 보스 스테이지일수록 커진다. 이미
  // 클리어한 적이 있는지는 rebirthMaxStage로 판정한다(리버스해도 유지되는 값이라
  // 재활용했다 — 별도 기록 상태를 새로 추가하지 않음).
  FirstClearDiamond: number
}

export interface StatTableRow {
  Index: number
  Id: number
  StatType: StatTypeEnum
  Name: number
  BaseValue: number
  ValuePerLevel: number
  // 업그레이드 비용 곡선은 더 이상 여기 없다 — GrowthCurveTable을 CurveKey로 참조한다.
  CurveKey: string
  MaxLevel: number
}

// 50노드 전부를 리터럴 행으로 나열한다(구간 압축 없음) — 노드 하나하나를 개별
// 조정할 수 있어야 하는 데이터라 공식/구간이 아니라 행으로 펼쳤다(2단계 개편,
// docs/TABLE_REDESIGN.md 2.2절). Order로 조회하며, Tier는 표시용(1~10=1티어 등).
export interface ExistTreeTableRow {
  Index: number
  Id: number
  Order: number
  Tier: number
  NameStringId: number
  DescStringId: number
  EffectType: NodeEffectTypeEnum
  StatType: StatTypeEnum | ''
  GrantCurrency: CurrencyTypeEnum | ''
  Value: number
  Cost: number
}

export interface FeatureUnlockTableRow {
  Index: number
  Id: number
  FeatureType: FeatureTypeEnum
  Name: number
  RequireNodeCount: number
  UnlockCost: number
}

export interface WeaponBreakthroughTableRow {
  Index: number
  Id: number
  BreakthroughStep: number
  RequiredDuplicateCount: number
  LevelCapBonus: number
}

// 무기 75종(3종류×5등급×5단계) 전부를 리터럴 행으로 나열한다(2단계 개편,
// docs/TABLE_REDESIGN.md 2.2절) — 예전엔 OwnBonusBase×등급배율×Tier배율을 실시간
// 곱연산으로 계산해 데이터 행이 0개였다. BaseAtk/OwnEffectValue/EquipEffectValue는
// 전부 이미 등급·단계 배율까지 곱해진 최종값이라, 실행 시점엔 여기 값에 레벨(과
// 보유일 때는 개수)만 곱하면 된다. CurveKey는 등급별 레벨업 비용 곡선(GrowthCurveTable의
// WEAPON_LEVEL_UP_NORMAL~LEGENDARY)을 가리킨다.
export interface WeaponTableRow {
  Index: number
  Id: number
  WeaponId: string
  Type: WeaponTypeEnum
  PrimaryStat: StatTypeEnum
  Grade: WeaponGradeEnum
  // GradeNameStringId/GradeColorToken은 WeaponGradeTable/GradeTable 삭제로 이관된
  // 값이다 — 같은 등급 15행이 동일값을 반복한다(무기별 개별 조정 대비 의도적
  // 중복, PrimaryStat과 동일한 패턴). GradeMultiplier/BaseMultiplier는 옮기지
  // 않았다 — 이미 2단계 개편 때 BaseAtk 등에 곱연산까지 끝난 값으로 흡수돼
  // 어디서도 읽지 않는 죽은 칼럼이었다.
  GradeNameStringId: number
  GradeColorToken: string
  Tier: number
  NameStringId: number
  DescStringId: number
  BaseAtk: number
  OwnEffectValue: number
  EquipEffectValue: number
  CurveKey: string
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
  // 3단계 StringTable 확장으로 신설(52000번대) — 이름(Name)은 이미 40001~40134에
  // 확정돼 있어 그대로 두고, 설명만 새로 추가했다.
  DescStringId: number
  // GradeNameStringId/GradeColorToken은 GradeTable 삭제로 이관된 값이다 — 유물
  // 등급은 3단계(Normal/Rare/Epic)뿐이라 같은 등급 3행이 동일값을 반복한다.
  GradeNameStringId: number
  GradeColorToken: string
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

// 사용 횟수(UsedCount 0~9)별 리터럴 값(3단계 개편) — 예전엔 CostBase/CostGrowthRate 등
// 공식 계수 1행이었다. TargetStageOffset은 사용 횟수와 무관한 고정값이라
// CommonTable(TimeHeistTargetStageOffset)로 옮겼다. 9를 넘는 사용 횟수는 9번 행 값으로
// 고정된다(StageTable 등과 동일한 클램프 패턴).
export interface TimeHeistTableRow {
  Index: number
  Id: number
  UsedCount: number
  Cost: number
  CooldownSec: number
  RewardMultiplier: number
}


// 리버스 시 신규 지급되는 다이아 — 환급이 아니라 도달 스테이지 구간별 고정값
// 지급이라 rebirthSpent/환급 배율과 무관하다. 구간은 [StageFrom, StageTo] 양끝 포함.
// RefundBonusPerPoint/MaxRefundMultiplier는 RebirthTable 삭제(3단계)로 흡수된
// 값 — 지금은 5개 구간 전부 동일값이지만, 구간별로 환급 배율을 다르게 줄 여지를
// 남겨둔다.
export interface RebirthRewardTableRow {
  Index: number
  Id: number
  StageFrom: number
  StageTo: number
  DiamondReward: number
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

// 공용 성장 곡선(비용 = CostBase × CostGrowthRate^레벨) — StatTable/MasteryTable이
// CurveKey로 참조한다. ValueBase/ValuePerLevel/MaxLevel은 이번 단계에서는 어느 조회
// 함수도 읽지 않는 예비 칼럼(스탯마다 값이 달라 지금은 각 테이블이 자체 보유) —
// docs/TABLE_REDESIGN.md 2.3절 참고.
export interface GrowthCurveTableRow {
  Index: number
  Id: number
  CurveKey: string
  CostBase: number
  CostGrowthRate: number
  ValueBase: number
  ValuePerLevel: number
  MaxLevel: number
}

// 재화별 리버스 초기화/환급/HUD 노출 속성. ResetOnRebirth/RefundOnRebirth는
// gameStore.ts의 executeRebirth()가 실제로 읽어 분기한다(RebirthTable 삭제,
// 3단계 — 그 전까지는 스키마+데이터만 있고 읽지 않았다).
export interface CurrencyTableRow {
  Index: number
  Id: number
  Type: CurrencyTypeEnum
  NameStringId: number
  ResetOnRebirth: boolean
  RefundOnRebirth: boolean
  ShowInHUD: boolean
  SortOrder: number
}

interface BalanceTables {
  StageTable: StageTableRow[]
  StatTable: StatTableRow[]
  ExistTreeTable: ExistTreeTableRow[]
  FeatureUnlockTable: FeatureUnlockTableRow[]
  WeaponBreakthroughTable: WeaponBreakthroughTableRow[]
  WeaponTable: WeaponTableRow[]
  GachaTable: GachaTableRow[]
  RelicTable: RelicTableRow[]
  RelicSlotTable: RelicSlotTableRow[]
  TimeHeistTable: TimeHeistTableRow[]
  RebirthRewardTable: RebirthRewardTableRow[]
  CommonTable: CommonTableRow[]
  StringTable: StringTableRow[]
  GrowthCurveTable: GrowthCurveTableRow[]
  CurrencyTable: CurrencyTableRow[]
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
  CurveKey: 'STAT_UPGRADE',
  MaxLevel: 9999,
}

const DEFAULT_STAGE: StageTableRow = {
  Index: 0,
  Id: 0,
  Stage: 1,
  Chapter: 1,
  StageType: 'Normal',
  EnemyHp: 20,
  EnemyAtk: 3,
  KillCount: 5,
  RewardGold: 5,
  RewardGrowth: 2,
  RewardExist: 1,
  RewardTimeEnergy: 0,
  NameStringId: 0,
  FirstClearDiamond: 6,
}

const DEFAULT_EXIST_TREE_NODE: ExistTreeTableRow = {
  Index: 0,
  Id: 0,
  Order: 1,
  Tier: 1,
  NameStringId: 0,
  DescStringId: 0,
  EffectType: 'STAT',
  StatType: 'ATK',
  GrantCurrency: '',
  Value: 5,
  Cost: 12,
}

const DEFAULT_FEATURE_UNLOCK: FeatureUnlockTableRow = {
  Index: 0,
  Id: 0,
  FeatureType: 'REBIRTH',
  Name: 0,
  RequireNodeCount: 15,
  UnlockCost: 667,
}

const DEFAULT_WEAPON: WeaponTableRow = {
  Index: 0,
  Id: 0,
  WeaponId: '',
  Type: 'Sword',
  PrimaryStat: 'ATK',
  Grade: 'Normal',
  GradeNameStringId: 40058,
  GradeColorToken: 'normal',
  Tier: 1,
  NameStringId: 0,
  DescStringId: 0,
  BaseAtk: 0.5,
  OwnEffectValue: 0.5,
  EquipEffectValue: 5,
  CurveKey: 'WEAPON_LEVEL_UP_NORMAL',
}

const DEFAULT_WEAPON_BREAKTHROUGH: WeaponBreakthroughTableRow = {
  Index: 0,
  Id: 0,
  BreakthroughStep: 1,
  RequiredDuplicateCount: 1,
  LevelCapBonus: 10,
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
  DescStringId: 0,
  GradeNameStringId: 40058,
  GradeColorToken: 'normal',
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
  UsedCount: 0,
  Cost: 20,
  CooldownSec: 900,
  RewardMultiplier: 5,
}


const DEFAULT_GROWTH_CURVE: GrowthCurveTableRow = {
  Index: 0,
  Id: 0,
  CurveKey: '',
  CostBase: 8,
  CostGrowthRate: 1.18,
  ValueBase: 0,
  ValuePerLevel: 0,
  MaxLevel: 9999,
}

const DEFAULT_CURRENCY: CurrencyTableRow = {
  Index: 0,
  Id: 0,
  Type: 'GOLD',
  NameStringId: 0,
  ResetOnRebirth: false,
  RefundOnRebirth: false,
  ShowInHUD: false,
  SortOrder: 0,
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

// stage 번호로 직접 조회한다 — 테이블에 정의된 마지막 스테이지를 넘어서면(콘텐츠가
// 아직 시딩되지 않은 구간) 마지막 행 값을 그대로 연장해서 쓴다(무한 스케일링 방지 +
// "언젠가 그 뒤 스테이지도 채워 넣으면 그만" 전제 — docs/TABLE_REDESIGN.md 2.2절).
const STAGE_TABLE_MAX_STAGE = Math.max(...TABLES.StageTable.map((r) => r.Stage))

export function getStageConfig(stage: number): StageTableRow {
  const clampedStage = Math.min(stage, STAGE_TABLE_MAX_STAGE)
  const row = TABLES.StageTable.find((r) => r.Stage === clampedStage)
  if (!row) {
    warnMissing('StageTable', `Stage=${stage}`)
    return { ...DEFAULT_STAGE, Stage: stage }
  }
  return row
}

export function getExistTreeNode(order: number): ExistTreeTableRow {
  const row = TABLES.ExistTreeTable.find((r) => r.Order === order)
  if (!row) {
    warnMissing('ExistTreeTable', `Order=${order}`)
    return { ...DEFAULT_EXIST_TREE_NODE, Order: order }
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

// 무기 종류(검/창/활)의 특성 스탯 — WeaponTable은 종류당 25행(등급×단계)이 모두
// 같은 PrimaryStat을 가지므로 아무 행이나 하나 찾아 반환하면 된다. WeaponTypeTable은
// 삭제됐다(2026-09-10 개편) — 이 특성 스탯 칼럼이 WeaponTable 각 행으로 이관됐다.
export function getWeaponTypePrimaryStat(weaponType: WeaponTypeEnum): StatTypeEnum {
  const row = TABLES.WeaponTable.find((r) => r.Type === weaponType)
  if (!row) {
    warnMissing('WeaponTable', `Type=${weaponType}(PrimaryStat 조회)`)
    return 'ATK'
  }
  return row.PrimaryStat
}

// 무기 등급 이름/색상 토큰 — WeaponGradeTable/GradeTable 삭제(3단계)로 WeaponTable에
// 흡수됐다. WeaponTable은 5등급 전부(Unique/Legendary 포함)를 가진 유일한 테이블이라
// GradeBadge처럼 무기·유물 공용으로 쓰는 곳도 이 함수 하나로 충분하다.
export function getWeaponGradeInfo(weaponGrade: WeaponGradeEnum): { NameStringId: number; ColorToken: string } {
  const row = TABLES.WeaponTable.find((r) => r.Grade === weaponGrade)
  if (!row) {
    warnMissing('WeaponTable', `Grade=${weaponGrade}(등급 정보 조회)`)
    return { NameStringId: DEFAULT_WEAPON.GradeNameStringId, ColorToken: DEFAULT_WEAPON.GradeColorToken }
  }
  return { NameStringId: row.GradeNameStringId, ColorToken: row.GradeColorToken }
}

export function getWeaponBreakthroughStep(step: number): WeaponBreakthroughTableRow {
  const row = TABLES.WeaponBreakthroughTable.find((r) => r.BreakthroughStep === step)
  if (!row) {
    warnMissing('WeaponBreakthroughTable', `BreakthroughStep=${step}`)
    return { ...DEFAULT_WEAPON_BREAKTHROUGH, BreakthroughStep: step }
  }
  return row
}

// WeaponFusionTable 삭제(3단계, 1행짜리 테이블 정리) — 전 등급 동일한 상수 3개라
// CommonTable로 흡수했다. 호출부가 객체 하나를 그대로 쓰는 관례를 유지하도록
// 반환 형태는 그대로 뒀다.
export function getWeaponFusionConfig(): { RequiredCount: number; ResultLevel: number; ResultBreakthroughCount: number } {
  return {
    RequiredCount: getCommon('WeaponFusionRequiredCount'),
    ResultLevel: getCommon('WeaponFusionResultLevel'),
    ResultBreakthroughCount: getCommon('WeaponFusionResultBreakthroughCount'),
  }
}

export function getWeaponConfig(type: WeaponTypeEnum, grade: WeaponGradeEnum, tier: number): WeaponTableRow {
  const row = TABLES.WeaponTable.find((r) => r.Type === type && r.Grade === grade && r.Tier === tier)
  if (!row) {
    warnMissing('WeaponTable', `Type=${type}, Grade=${grade}, Tier=${tier}`)
    return { ...DEFAULT_WEAPON, Type: type, Grade: grade, Tier: tier }
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

// 유물 등급 이름/색상 토큰 — GradeTable 삭제(3단계)로 RelicTable에 흡수됐다.
// 유물 등급은 3단계(Normal/Rare/Epic)뿐이다.
export function getRelicGradeInfo(relicGrade: RelicGradeEnum): { NameStringId: number; ColorToken: string } {
  const row = TABLES.RelicTable.find((r) => r.RelicGrade === relicGrade)
  if (!row) {
    warnMissing('RelicTable', `RelicGrade=${relicGrade}(등급 정보 조회)`)
    return { NameStringId: DEFAULT_RELIC.GradeNameStringId, ColorToken: DEFAULT_RELIC.GradeColorToken }
  }
  return { NameStringId: row.GradeNameStringId, ColorToken: row.GradeColorToken }
}

export function getRelicSlotConfig(slotIndex: number): RelicSlotTableRow {
  const row = TABLES.RelicSlotTable.find((r) => r.SlotIndex === slotIndex)
  if (!row) {
    warnMissing('RelicSlotTable', `SlotIndex=${slotIndex}`)
    return { ...DEFAULT_RELIC_SLOT, SlotIndex: slotIndex }
  }
  return row
}

// usedCount가 테이블 마지막 행(UsedCount 최댓값)을 넘으면 마지막 행 값으로
// 고정한다(StageTable 등과 동일한 클램프 패턴).
export function getTimeHeistConfig(usedCount: number): TimeHeistTableRow {
  const table = TABLES.TimeHeistTable
  if (table.length === 0) {
    warnMissing('TimeHeistTable', `UsedCount=${usedCount}`)
    return { ...DEFAULT_TIME_HEIST, UsedCount: usedCount }
  }
  const maxUsedCount = table[table.length - 1].UsedCount
  const clamped = Math.min(Math.max(usedCount, 0), maxUsedCount)
  const row = table.find((r) => r.UsedCount === clamped)
  if (!row) {
    warnMissing('TimeHeistTable', `UsedCount=${usedCount}`)
    return { ...DEFAULT_TIME_HEIST, UsedCount: usedCount }
  }
  return row
}

// 리버스 시점의 도달 스테이지가 속한 RebirthRewardTable 구간 행을 조회한다.
// 어느 구간에도 안 맞으면(데이터 구멍) 경고하고 안전한 기본값(1200다이아,
// 환급 배율 계수 1/5 — 기존 DEFAULT_REBIRTH와 동일한 값)을 반환한다.
function findRebirthRewardRow(stage: number): RebirthRewardTableRow {
  const row = TABLES.RebirthRewardTable.find((r) => stage >= r.StageFrom && stage <= r.StageTo)
  if (!row) {
    warnMissing('RebirthRewardTable', `stage=${stage}`)
    return { Index: 0, Id: 0, StageFrom: stage, StageTo: stage, DiamondReward: 1200, RefundBonusPerPoint: 1, MaxRefundMultiplier: 5 }
  }
  return row
}

export function getRebirthDiamondReward(stage: number): number {
  return findRebirthRewardRow(stage).DiamondReward
}

// 리버스 회차 보너스의 환급 배율 계수(포인트당 증폭률·상한) — RebirthTable 삭제(3단계)로
// RebirthRewardTable에 흡수됐다. 도달 스테이지 구간에 따라 달라질 수 있다.
export function getRebirthRefundConfig(stage: number): { RefundBonusPerPoint: number; MaxRefundMultiplier: number } {
  const row = findRebirthRewardRow(stage)
  return { RefundBonusPerPoint: row.RefundBonusPerPoint, MaxRefundMultiplier: row.MaxRefundMultiplier }
}

export function getCommon(key: string): number {
  const row = TABLES.CommonTable.find((r) => r.Key === key)
  if (!row) {
    warnMissing('CommonTable', `Key=${key}`)
    return 0
  }
  return row.Value
}

// CommonTable.Value는 float로 통일돼 있어(Q3 결정) bool은 0/1로 저장한다 — 이 헬퍼가
// !== 0 판정을 감싼다.
export function getCommonBool(key: string): boolean {
  return getCommon(key) !== 0
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

// StatTable 등이 CurveKey로 가리키는 공용 성장 곡선 조회(mastery.ts는 코드 상수
// MASTERY_CURVE_KEY로 직접 가리킨다 — MasteryTable 삭제, 2026-09-10 개편).
export function getGrowthCurveConfig(curveKey: string): GrowthCurveTableRow {
  const row = TABLES.GrowthCurveTable.find((r) => r.CurveKey === curveKey)
  if (!row) {
    warnMissing('GrowthCurveTable', `CurveKey=${curveKey}`)
    return { ...DEFAULT_GROWTH_CURVE, CurveKey: curveKey }
  }
  return row
}

export function getCurrencyConfig(type: CurrencyTypeEnum): CurrencyTableRow {
  const row = TABLES.CurrencyTable.find((r) => r.Type === type)
  if (!row) {
    warnMissing('CurrencyTable', `Type=${type}`)
    return { ...DEFAULT_CURRENCY, Type: type }
  }
  return row
}

// 원본 테이블 배열이 통째로 필요할 때(예: 존재력 트리 50노드 생성)를 위한 export
export const BALANCE_TABLES: Readonly<BalanceTables> = TABLES
