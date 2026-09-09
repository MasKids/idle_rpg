// 무기 시스템 — 인벤토리 식별자, 성장(레벨업/돌파/합성) 조건 및 비용,
// 보유/장착 효과 계산, 가챠 확률 로직. docs/WEAPON_SYSTEM.md 1~2장 참고.
import {
  BALANCE_TABLES,
  getGachaLevelForPullCount,
  getString,
  getWeaponBreakthroughStep,
  getWeaponFusionConfig,
  getWeaponGradeConfig,
  getWeaponTypeConfig,
  getWeaponUpgradeConfig,
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

// 존재력 트리 노드와 동일한 패턴: 이름 배열이 비어있으면 자동 생성 이름 사용.
// 이름이 확정되면 이 배열에 "타입_등급_단계": "실제이름" 형태로 채우면 된다.
const WEAPON_NAME_OVERRIDES: Record<string, string> = {}

export function weaponDisplayName(id: string): string {
  const override = WEAPON_NAME_OVERRIDES[id]
  if (override) return override

  const { type, grade, tier } = parseWeaponId(id)
  const typeName = getString(getWeaponTypeConfig(type).Name, 'KOR', type)
  const gradeName = getString(getWeaponGradeConfig(grade).Name, 'ENG', grade)
  return `${typeName}-${gradeName}-${tier}`
}

// ---------------------------------------------------------------------------
// 성장 공식 — 레벨업 비용/상한, 보유·장착 효과. GradeMultiplier와 Tier 보정은
// 종류/등급 계수 위에 곱연산으로 얹힌다.
// ---------------------------------------------------------------------------

export function weaponGradeMultiplier(grade: WeaponGradeEnum): number {
  return getWeaponGradeConfig(grade).GradeMultiplier
}

export function weaponTierMultiplier(tier: number): number {
  const upgrade = getWeaponUpgradeConfig()
  return 1 + (tier - 1) * (upgrade.TierStepBonusPercent / 100)
}

// 돌파 완료 단계 수에 따른 레벨 상한 (기본 상한 + 완료한 각 단계의 LevelCapBonus 합).
// breakthroughCount는 항상 0~WEAPON_MAX_BREAKTHROUGH 범위라 step이 테이블에 없는
// 경우가 실제로 없으므로, "없으면 기본값+경고"로 항상 행을 보장하는 getWeaponBreakthroughStep을
// 그대로 써도 안전하다 (nextBreakthroughStep과 달리 여기선 "없음"이 의미를 갖지 않는다).
export function weaponMaxLevel(breakthroughCount: number): number {
  const upgrade = getWeaponUpgradeConfig()
  let cap = upgrade.BaseMaxLevel
  for (let step = 1; step <= breakthroughCount; step++) {
    cap += getWeaponBreakthroughStep(step).LevelCapBonus
  }
  return cap
}

// 골드 비용 = LevelCostBase × LevelCostGrowthRate^(레벨-1) × 등급배율
export function weaponLevelUpCost(grade: WeaponGradeEnum, level: number): number {
  const upgrade = getWeaponUpgradeConfig()
  return Math.floor(upgrade.LevelCostBase * upgrade.LevelCostGrowthRate ** (level - 1) * weaponGradeMultiplier(grade))
}

// 모든 무기가 종류 불문 공통으로 갖는 "기본 공격력" — 검의 특화 계수와 같은 크기라
// 무기 종류를 바꿔도 ATK가 0으로 떨어지지 않는다. 장착 여부와 무관하게 보유만
// 해도(어떤 종류든) 적용된다.
export function weaponBaseAtkOwnBonus(grade: WeaponGradeEnum, tier: number, level: number, count: number): number {
  const upgrade = getWeaponUpgradeConfig()
  return upgrade.BaseAtkOwnBonusPerLevel * weaponGradeMultiplier(grade) * weaponTierMultiplier(tier) * level * count
}

export function weaponBaseAtkEquipBonus(grade: WeaponGradeEnum, tier: number, level: number): number {
  const upgrade = getWeaponUpgradeConfig()
  return upgrade.BaseAtkEquipBonusPerLevel * weaponGradeMultiplier(grade) * weaponTierMultiplier(tier) * level
}

// 종류별 특화 스탯(검=ATK 추가 특화, 창=ASPD, 활=CRIT) 보유 효과 —
// 장착 중인 무기와 같은 종류의 보유 무기에만 적용된다(docs/WEAPON_SYSTEM.md 1.4).
// 타입 하나의 보유 효과 = OwnBonusBase × 등급배율 × Tier배율 × 레벨 × 보유개수
export function weaponOwnBonus(type: WeaponTypeEnum, grade: WeaponGradeEnum, tier: number, level: number, count: number): number {
  return getWeaponTypeConfig(type).OwnBonusBase * weaponGradeMultiplier(grade) * weaponTierMultiplier(tier) * level * count
}

// 장착 효과 = EquipBonusBase × 등급배율 × Tier배율 × 레벨 (개수 무관, 장착 1개 취급)
export function weaponEquipBonus(type: WeaponTypeEnum, grade: WeaponGradeEnum, tier: number, level: number): number {
  return getWeaponTypeConfig(type).EquipBonusBase * weaponGradeMultiplier(grade) * weaponTierMultiplier(tier) * level
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
    const { grade, tier } = parseWeaponId(id)
    baseAtkTotal += weaponBaseAtkOwnBonus(grade, tier, entry.level, entry.count)
  }

  if (!equippedWeaponId) return { ...EMPTY_BREAKDOWN, baseAtkTotal }
  const equippedEntry = ownedWeapons[equippedWeaponId]
  if (!equippedEntry || equippedEntry.count <= 0) return { ...EMPTY_BREAKDOWN, baseAtkTotal }

  const equipped = parseWeaponId(equippedWeaponId)
  baseAtkTotal += weaponBaseAtkEquipBonus(equipped.grade, equipped.tier, equippedEntry.level)

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

export function canBreakthrough(entry: WeaponInstance): boolean {
  const step = nextBreakthroughStep(entry)
  if (!step) return false
  return entry.count >= step.RequiredDuplicateCount
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

// 장착 중인 타입은 재료 계산에서 항상 1개 제외 (docs/WEAPON_SYSTEM.md 1.3 확정 사항)
export function canMerge(id: string, entry: WeaponInstance, isEquipped: boolean): boolean {
  if (nextWeaponIdForMerge(id) === null) return false
  const fusion = getWeaponFusionConfig()
  const available = entry.count - (isEquipped ? 1 : 0)
  return available >= fusion.RequiredCount
}

export interface WeaponReadiness {
  count: number
  // 합성(등급 승급) 필요 개수 — 합성이 이미 끝(레전드리 5단계)이면 돌파 다음 단계 필요 개수로 대체
  required: number
  // count >= required
  ready: boolean
}

// 그리드에 보여줄 "보유 개수 / 목표 개수" — 기본은 합성(다음 등급으로의 승급) 기준이다.
// 합성이 더 불가능한 마지막 칸(레전드리 5단계)에서만 돌파 다음 단계 필요 개수를 대신 보여준다
// (돌파는 1단계가 항상 1개라 항상 초록이 되어버려 진행도 표시로는 덜 유용하다).
// 돌파도 합성도 더는 불가능하면(완전히 다 키운 상태) null.
export function computeWeaponReadiness(id: string, entry: WeaponInstance, isEquipped: boolean): WeaponReadiness | null {
  if (nextWeaponIdForMerge(id) !== null) {
    const fusion = getWeaponFusionConfig()
    const required = fusion.RequiredCount + (isEquipped ? 1 : 0)
    return { count: entry.count, required, ready: entry.count >= required }
  }

  const nextStep = nextBreakthroughStep(entry)
  if (nextStep) {
    return { count: entry.count, required: nextStep.RequiredDuplicateCount, ready: entry.count >= nextStep.RequiredDuplicateCount }
  }

  return null
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
