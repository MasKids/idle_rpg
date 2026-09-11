// 무기 시스템 — 인벤토리 식별자, 성장(레벨업/돌파/합성) 조건 및 비용,
// 보유/장착 효과 계산, 가챠 확률 로직. docs/WEAPON_SYSTEM.md 1~2장 참고.
import {
  BALANCE_TABLES,
  getCommon,
  getGachaLevelForPullCount,
  getGrowthCurveConfig,
  getString,
  getWeaponBreakthroughStep,
  getWeaponConfig,
  getWeaponFusionConfig,
  WEAPON_TYPE_NAME_STRING_ID,
  WEAPON_TYPES,
  type GachaTableRow,
  type WeaponGradeEnum,
  type WeaponTypeEnum,
} from '../../data/balance'
import type { OwnedWeapons, WeaponInstance } from '../../types/game'

export { WEAPON_TYPES }
export const WEAPON_GRADES: WeaponGradeEnum[] = ['Normal', 'Rare', 'Epic', 'Unique', 'Legendary']
export const WEAPON_TIERS = [1, 2, 3, 4, 5] as const
export const WEAPON_MAX_BREAKTHROUGH = BALANCE_TABLES.WeaponBreakthroughTable.length

// ---------------------------------------------------------------------------
// 무기 식별자 — "{종류}_{등급}_{단계}" 문자열 하나가 75종 중 하나를 가리킨다.
// ---------------------------------------------------------------------------

export function buildWeaponId(type: WeaponTypeEnum, grade: WeaponGradeEnum, tier: number): string {
  return `${type}_${grade}_${tier}`
}

export function parseWeaponId(id: string): { type: WeaponTypeEnum; grade: WeaponGradeEnum; tier: number } {
  const [type, grade, tierStr] = id.split('_')
  return { type: type as WeaponTypeEnum, grade: grade as WeaponGradeEnum, tier: Number(tierStr) }
}

export function weaponDisplayName(id: string): string {
  const { type, grade, tier } = parseWeaponId(id)
  const config = getWeaponConfig(type, grade, tier)
  // 이름이 아직 확정되지 않은 무기(NameStringId=0)는 "종류-등급-단계" 자동 생성
  // 이름을 대신 쓴다(존재력 트리 노드와 동일한 폴백 패턴). 이름이 확정되면
  // WeaponTable에서 NameStringId만 채우면 된다.
  if (config.NameStringId) return getString(config.NameStringId, 'KOR')
  const typeName = getString(WEAPON_TYPE_NAME_STRING_ID[type], 'KOR', type)
  const gradeName = getString(config.GradeNameStringId, 'ENG', grade)
  return `${typeName}-${gradeName}-${tier}`
}

// ---------------------------------------------------------------------------
// 성장 공식 — 레벨업 비용/상한, 보유·장착 효과. 2단계 개편으로 무기 75종
// (3종류×5등급×5단계) 전부가 WeaponTable에 리터럴 값으로 있어, 실행 시점엔
// 레벨(과 보유 개수)만 곱하면 된다 — 등급 배율을 실시간으로 참조하지 않는다
// (docs/TABLE_REDESIGN.md 2.2절).
// ---------------------------------------------------------------------------

// 돌파 완료 단계 수에 따른 레벨 상한 (기본 상한 + 완료한 각 단계의 LevelCapBonus 합).
// breakthroughCount는 항상 0~WEAPON_MAX_BREAKTHROUGH 범위라 step이 테이블에 없는
// 경우가 실제로 없으므로, "없으면 기본값+경고"로 항상 행을 보장하는 getWeaponBreakthroughStep을
// 그대로 써도 안전하다 (nextBreakthroughStep과 달리 여기선 "없음"이 의미를 갖지 않는다).
export function weaponMaxLevel(breakthroughCount: number): number {
  let cap = getCommon('WeaponBaseMaxLevel')
  for (let step = 1; step <= breakthroughCount; step++) {
    cap += getWeaponBreakthroughStep(step).LevelCapBonus
  }
  return cap
}

// 골드 비용 — 이 무기(WeaponTable 행)가 가리키는 CurveKey(등급별 레벨업 곡선,
// GrowthCurveTable의 WEAPON_LEVEL_UP_NORMAL~LEGENDARY)로 계산한다.
export function weaponLevelUpCost(type: WeaponTypeEnum, grade: WeaponGradeEnum, tier: number, level: number): number {
  const config = getWeaponConfig(type, grade, tier)
  const curve = getGrowthCurveConfig(config.CurveKey)
  return Math.floor(curve.CostBase * curve.CostGrowthRate ** (level - 1))
}

// 모든 무기가 종류 불문 공통으로 갖는 "기본 공격력" — 무기 종류를 바꿔도 ATK가
// 0으로 떨어지지 않는다. 장착 여부와 무관하게 보유만 해도(어떤 종류든) 적용된다.
export function weaponBaseAtkOwnBonus(type: WeaponTypeEnum, grade: WeaponGradeEnum, tier: number, level: number, count: number): number {
  return getWeaponConfig(type, grade, tier).BaseAtk * level * count
}

// 특화 스탯(OwnEffectValue/EquipEffectValue)은 데이터 자체가 보유:장착 = 1:10
// 비율로 돼 있어 장착이 항상 확실히 앞서는데, 기본 공격력(BaseAtk)은 보유·장착
// 양쪽이 같은 값을 쓰고(보유만 개수(count)로 누적) 그런 배율이 없어, 무기를
// 몇 개만 모아도(심지어 종류가 달라도) 보유 총합이 장착 하나를 넘어서 버렸다
// (창/활처럼 특화 스탯이 ATK가 아닌 무기일수록 이 문제가 그대로 드러남 — 공격력
// 기여가 BaseAtk뿐이라 특화 스탯의 10배 배율로 가려지지 않았다). 같은 1:10 비율을
// 여기에도 적용해 장착이 보유보다 확실히 유의미하게 만든다.
export function weaponBaseAtkEquipBonus(type: WeaponTypeEnum, grade: WeaponGradeEnum, tier: number, level: number): number {
  return getWeaponConfig(type, grade, tier).BaseAtk * level * getCommon('WeaponBaseAtkEquipMultiplier')
}

// 종류별 특화 스탯(검=ATK 추가 특화, 창=ASPD, 활=CRIT) 보유 효과 —
// 장착 중인 무기와 같은 종류의 보유 무기에만 적용된다(docs/WEAPON_SYSTEM.md 1.4).
export function weaponOwnBonus(type: WeaponTypeEnum, grade: WeaponGradeEnum, tier: number, level: number, count: number): number {
  return getWeaponConfig(type, grade, tier).OwnEffectValue * level * count
}

// 장착 효과 (개수 무관, 장착 1개 취급)
export function weaponEquipBonus(type: WeaponTypeEnum, grade: WeaponGradeEnum, tier: number, level: number): number {
  return getWeaponConfig(type, grade, tier).EquipEffectValue * level
}

export interface WeaponBonusBreakdown {
  // 종류 불문 모든 보유 무기의 기본 공격력 합(장착한 무기가 있으면 그 장착효과도 포함) — 항상 ATK에 가산
  baseAtkTotal: number
  // 장착 중인 종류와 같은 종류의 보유 무기들 특화 스탯 보유 효과 합
  specialtyOwnTotal: number
  // 장착한 무기 1개만의 특화 스탯 장착 효과
  specialtyEquipBonus: number
}

const EMPTY_BREAKDOWN: WeaponBonusBreakdown = { baseAtkTotal: 0, specialtyOwnTotal: 0, specialtyEquipBonus: 0 }

// 기본 공격력(종류 불문, 장착 여부 무관 항상 합산)과, 장착 중인 종류의 특화 스탯
// 보유/장착 효과(같은 종류만 대상)를 분리해서 반환한다.
export function computeWeaponBonusBreakdown(ownedWeapons: OwnedWeapons, equippedWeaponId: string | null): WeaponBonusBreakdown {
  let baseAtkTotal = 0
  for (const [id, entry] of Object.entries(ownedWeapons)) {
    if (entry.count <= 0) continue
    const { type, grade, tier } = parseWeaponId(id)
    baseAtkTotal += weaponBaseAtkOwnBonus(type, grade, tier, entry.level, entry.count)
  }

  if (!equippedWeaponId) return { ...EMPTY_BREAKDOWN, baseAtkTotal }
  const equippedEntry = ownedWeapons[equippedWeaponId]
  if (!equippedEntry || equippedEntry.count <= 0) return { ...EMPTY_BREAKDOWN, baseAtkTotal }

  const equipped = parseWeaponId(equippedWeaponId)
  baseAtkTotal += weaponBaseAtkEquipBonus(equipped.type, equipped.grade, equipped.tier, equippedEntry.level)

  let specialtyOwnTotal = 0
  let specialtyEquipBonus = 0
  for (const [id, entry] of Object.entries(ownedWeapons)) {
    if (entry.count <= 0) continue
    const { type, grade, tier } = parseWeaponId(id)
    if (type !== equipped.type) continue
    specialtyOwnTotal += weaponOwnBonus(type, grade, tier, entry.level, entry.count)
    if (id === equippedWeaponId) {
      specialtyEquipBonus = weaponEquipBonus(type, grade, tier, entry.level)
    }
  }
  return { baseAtkTotal, specialtyOwnTotal, specialtyEquipBonus }
}

// ---------------------------------------------------------------------------
// 돌파 / 합성 조건
// ---------------------------------------------------------------------------

export function nextBreakthroughStep(entry: WeaponInstance) {
  const step = entry.breakthroughCount + 1
  return BALANCE_TABLES.WeaponBreakthroughTable.find((r) => r.BreakthroughStep === step)
}

// 장착 여부와 무관하게 모든 무기는 최소 1개가 남아야 한다 — 그래서 돌파에 실제로
// 쓸 수 있는 개수는 "보유 개수 - 1"이다(1단계는 1개 필요라 총 2개를 보유해야 가능).
export function canBreakthrough(entry: WeaponInstance): boolean {
  const step = nextBreakthroughStep(entry)
  if (!step) return false
  return entry.count - 1 >= step.RequiredDuplicateCount
}

// 사다리(종류별 25단계: 5등급×5단계)에서 다음 칸. 등급 경계도 자연스럽게 이어지고,
// 레전드리 5단계는 끝이라 null.
export function nextWeaponIdForMerge(id: string): string | null {
  const { type, grade, tier } = parseWeaponId(id)
  if (tier < 5) return buildWeaponId(type, grade, tier + 1)

  const gradeIndex = WEAPON_GRADES.indexOf(grade)
  if (gradeIndex < WEAPON_GRADES.length - 1) return buildWeaponId(type, WEAPON_GRADES[gradeIndex + 1], 1)

  return null
}

// 모든 무기는 장착 여부와 무관하게 최소 1개가 남아야 한다 (canBreakthrough와 동일한
// 규칙 — docs/WEAPON_SYSTEM.md 1.3의 "장착 중인 타입은 재료 계산에서 항상 1개
// 제외"를 "장착 여부와 무관하게 항상 1개 제외"로 일반화했다: 최소-1-보존 규칙을
// 적용하면 장착 중인 무기도 자동으로 보호되므로 isEquipped를 따로 분기할 필요가 없다).
export function canMerge(id: string, entry: WeaponInstance): boolean {
  if (nextWeaponIdForMerge(id) === null) return false
  const fusion = getWeaponFusionConfig()
  return entry.count - 1 >= fusion.RequiredCount
}

export interface WeaponReadiness {
  // 지금 보여주는 진행도가 돌파인지 합성인지 — UI에서 색/안내를 다르게 하기 위함.
  kind: 'breakthrough' | 'fusion'
  count: number
  required: number
  // count >= required
  ready: boolean
}

// 그리드에 보여줄 "보유 개수 / 목표 개수" — 돌파와 합성 둘 다 계산해서 필요 개수가
// 더 적은(=더 빨리 도달하는) 쪽을 보여준다. 예전엔 합성 쪽만 계산해서(레전드리
// 5단계로 합성이 막힌 경우에만 돌파로 대체) 돌파가 실제로는 더 가깝거나 이미
// 가능한 상태여도 화면에는 항상 "느린" 합성 진행도만 보였다. 돌파가 5단계까지
// 전부 끝나 더 이상 없으면(nextBreakthroughStep이 null) 자동으로 합성 쪽만 남아
// 안내가 합성으로 넘어간다. 돌파도 합성도 더는 불가능하면(완전히 다 키운 상태) null.
export function computeWeaponReadiness(id: string, entry: WeaponInstance): WeaponReadiness | null {
  const nextStep = nextBreakthroughStep(entry)
  const breakthroughRequired = nextStep ? nextStep.RequiredDuplicateCount + 1 : null

  const canMergeFurther = nextWeaponIdForMerge(id) !== null
  const fusionRequired = canMergeFurther ? getWeaponFusionConfig().RequiredCount + 1 : null

  if (breakthroughRequired === null && fusionRequired === null) return null

  if (breakthroughRequired !== null && (fusionRequired === null || breakthroughRequired <= fusionRequired)) {
    return { kind: 'breakthrough', count: entry.count, required: breakthroughRequired, ready: entry.count >= breakthroughRequired }
  }
  return { kind: 'fusion', count: entry.count, required: fusionRequired!, ready: entry.count >= fusionRequired! }
}

// ---------------------------------------------------------------------------
// 가챠 — 종류는 균등, 등급/단계는 가챠 레벨에 따른 가중치로 각각 독립 추첨
// ---------------------------------------------------------------------------

function weightedPick<T extends string | number>(entries: [T, number][]): T {
  const total = entries.reduce((sum, [, weight]) => sum + Math.max(0, weight), 0)
  if (total <= 0) return entries[0][0]

  let roll = Math.random() * total
  for (const [value, weight] of entries) {
    roll -= Math.max(0, weight)
    if (roll < 0) return value
  }
  return entries[entries.length - 1][0]
}

export function currentGachaLevelConfig(gachaCount: number): GachaTableRow {
  return getGachaLevelForPullCount(gachaCount)
}

export function rollWeaponGacha(gachaCount: number): string {
  const level = currentGachaLevelConfig(gachaCount)

  const type = WEAPON_TYPES[Math.floor(Math.random() * WEAPON_TYPES.length)]
  const grade = weightedPick<WeaponGradeEnum>([
    ['Normal', level.NormalWeight],
    ['Rare', level.RareWeight],
    ['Epic', level.EpicWeight],
    ['Unique', level.UniqueWeight],
    ['Legendary', level.LegendaryWeight],
  ])
  const tier = weightedPick<number>([
    [1, level.Tier1Weight],
    [2, level.Tier2Weight],
    [3, level.Tier3Weight],
    [4, level.Tier4Weight],
    [5, level.Tier5Weight],
  ])

  return buildWeaponId(type, grade, tier)
}
