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
export const WEAPON_GRADES: WeaponGradeEnum[] = ['Normal', 'Rare', 'Epic', 'Unique', 'Legendary', 'Mythic']
export const WEAPON_TIERS = [1, 2, 3, 4, 5] as const
export const WEAPON_MAX_BREAKTHROUGH = BALANCE_TABLES.WeaponBreakthroughTable.length

// ---------------------------------------------------------------------------
// 무기 식별자 — "{종류}_{등급}_{단계}" 문자열 하나가 150종(v0.4.0부터 5종류×6등급×5단계) 중 하나를 가리킨다.
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
// 성장 공식 — 레벨업 비용/상한, 보유·장착 효과. 2단계 개편으로 무기 150종
// (v0.4.0부터 5종류×6등급×5단계) 전부가 WeaponTable에 리터럴 값으로 있어, 실행
// 시점엔 레벨(과 보유 개수)만 곱하면 된다 — 등급 배율을 실시간으로 참조하지 않는다
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

// 장착 효과 레벨 성장 배율 — GrowthCurveTable(무기의 CurveKey)의
// ValueBase + (레벨-1) × ValuePerLevel. 레벨 1에서는 배율이 1이라 장착 효과가
// "기준값 그대로"이고, 레벨이 오를수록 커진다. 기본 공격력/특화 스탯 두
// 장착 효과 모두 같은 배율을 쓴다(무기를 레벨업하면 그 무기의 모든 장착
// 효과가 같이 성장해야 자연스럽다).
function weaponEquipGrowthMultiplier(type: WeaponTypeEnum, grade: WeaponGradeEnum, tier: number, level: number): number {
  const curve = getGrowthCurveConfig(getWeaponConfig(type, grade, tier).CurveKey)
  return curve.ValueBase + (level - 1) * curve.ValuePerLevel
}

// 모든 무기가 종류 불문 공통으로 갖는 "기본 공격력 보유 효과" — 무기 종류를
// 바꿔도 ATK 보너스가 0으로 떨어지지 않는다. 장착 여부와 무관하게 보유만 해도
// (어떤 종류든) 적용되며, 개수에 비례해 누적된다. v0.3.0 밸런스 개편으로 깡스탯이
// 아니라 ATK 깡스탯 총합에 곱해지는 퍼센트가 됐다 — WeaponTable.OwnEffectValue
// (특화 스탯 보유 퍼센트)에 CommonTable.WeaponBaseAtkOwnPercentRatio(=0.5)를 곱해,
// "모든 무기에 항상 적용되는 범용 효과"답게 특화 효과의 절반만 반영한다.
export function weaponBaseAtkOwnPercent(type: WeaponTypeEnum, grade: WeaponGradeEnum, tier: number, count: number): number {
  const config = getWeaponConfig(type, grade, tier)
  return config.OwnEffectValue * getCommon('WeaponBaseAtkOwnPercentRatio') * count
}

// 기본 공격력 장착 효과 — 깡스탯. BaseAtk에 WeaponBaseAtkEquipMultiplier(보유
// 대비 장착 배율)와 레벨 성장 배율을 곱한다.
export function weaponBaseAtkEquipBonus(type: WeaponTypeEnum, grade: WeaponGradeEnum, tier: number, level: number): number {
  const config = getWeaponConfig(type, grade, tier)
  const growthMultiplier = weaponEquipGrowthMultiplier(type, grade, tier, level)
  return config.BaseAtk * getCommon('WeaponBaseAtkEquipMultiplier') * growthMultiplier
}

// 종류별 특화 스탯(검=ATK 추가 특화, 창=ASPD, 활=CRIT) 보유 효과 — 장착 중인
// 무기와 같은 종류의 보유 무기에만 적용되고, 보유 개수에 비례해 누적된다
// (docs/WEAPON_SYSTEM.md 1.4). v0.3.0 밸런스 개편으로 깡스탯에서 그 스탯의
// 깡스탯 총합에 곱해지는 퍼센트로 바뀌었다 — 퍼센트라 검(ATK)·창(ASPD)·활(CRIT)
// 처럼 스탯마다 기준값이 달라도 종류별로 다른 크기를 잡을 필요가 없어져서,
// WeaponTable.OwnEffectValue는 이제 종류 무관 등급·단계로만 정해진다.
export function weaponOwnPercent(type: WeaponTypeEnum, grade: WeaponGradeEnum, tier: number, count: number): number {
  return getWeaponConfig(type, grade, tier).OwnEffectValue * count
}

// 장착 효과 — EquipEffectValue에 레벨 성장 배율을 곱한다(개수 무관, 장착 1개
// 취급). 깡스탯 — 무기 등급/단계·레벨이 오를수록 커지는 절대치.
export function weaponEquipBonus(type: WeaponTypeEnum, grade: WeaponGradeEnum, tier: number, level: number): number {
  const config = getWeaponConfig(type, grade, tier)
  const growthMultiplier = weaponEquipGrowthMultiplier(type, grade, tier, level)
  return config.EquipEffectValue * growthMultiplier
}

export interface WeaponBonusBreakdown {
  // 기본 공격력 장착 효과(깡스탯) — 장착 중인 무기의 등급/단계/레벨 기준, 항상 ATK
  atkFlat: number
  // 기본 공격력 보유 효과(퍼센트) — 종류 불문 모든 보유 무기 합, 항상 ATK
  atkPercent: number
  // 장착 중인 무기 1개만의 특화 스탯 장착 효과(깡스탯)
  specialtyFlat: number
  // 장착 중인 종류와 같은 종류의 보유 무기들 특화 스탯 보유 효과 합(퍼센트)
  specialtyPercent: number
}

const EMPTY_BREAKDOWN: WeaponBonusBreakdown = { atkFlat: 0, atkPercent: 0, specialtyFlat: 0, specialtyPercent: 0 }

// 기본 공격력(종류 불문, 보유는 퍼센트·장착은 깡스탯)과, 장착 중인 종류의 특화
// 스탯 보유/장착 효과(같은 종류만 대상, 보유는 퍼센트·장착은 깡스탯)를 분리해서
// 반환한다.
export function computeWeaponBonusBreakdown(ownedWeapons: OwnedWeapons, equippedWeaponId: string | null): WeaponBonusBreakdown {
  let atkPercent = 0
  for (const [id, entry] of Object.entries(ownedWeapons)) {
    if (entry.count <= 0) continue
    const { type, grade, tier } = parseWeaponId(id)
    atkPercent += weaponBaseAtkOwnPercent(type, grade, tier, entry.count)
  }

  if (!equippedWeaponId) return { ...EMPTY_BREAKDOWN, atkPercent }
  const equippedEntry = ownedWeapons[equippedWeaponId]
  if (!equippedEntry || equippedEntry.count <= 0) return { ...EMPTY_BREAKDOWN, atkPercent }

  const equipped = parseWeaponId(equippedWeaponId)
  const atkFlat = weaponBaseAtkEquipBonus(equipped.type, equipped.grade, equipped.tier, equippedEntry.level)

  let specialtyPercent = 0
  let specialtyFlat = 0
  for (const [id, entry] of Object.entries(ownedWeapons)) {
    if (entry.count <= 0) continue
    const { type, grade, tier } = parseWeaponId(id)
    if (type !== equipped.type) continue
    specialtyPercent += weaponOwnPercent(type, grade, tier, entry.count)
    if (id === equippedWeaponId) {
      specialtyFlat = weaponEquipBonus(type, grade, tier, entry.level)
    }
  }
  return { atkFlat, atkPercent, specialtyFlat, specialtyPercent }
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

// 사다리(종류별 30단계: 6등급×5단계, v0.4.0부터)에서 다음 칸. 등급 경계도 자연스럽게
// 이어지고, 마지막 등급(WEAPON_GRADES 배열의 끝, 현재 Mythic) 5단계는 끝이라 null.
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

// 무기 타입을 count만큼 지급(없으면 신규 생성, 있으면 count만 증가) — 가챠/합성/개발자
// 콘솔 지급/일괄 처리가 전부 이 헬퍼를 공유한다. gameStore.ts에 있던 걸 옮겨왔다(다른
// 무기 도메인 함수들과 같은 곳에 있어야 일괄 합성 시뮬레이션에서도 재사용하기 쉽다).
export function grantWeaponEntry(
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

// ---------------------------------------------------------------------------
// 일괄 돌파 / 일괄 합성 — 실행 전 미리보기와 실제 적용이 같은 시뮬레이션 결과를
// 공유한다(둘 다 순수 함수라 부작용 없음). 미리보기는 이 결과를 읽기만 하고,
// gameStore.ts의 bulkBreakthroughWeapon/bulkMergeWeapon이 반환값을 그대로 다음
// 상태로 커밋한다.
// ---------------------------------------------------------------------------

export interface BulkBreakthroughResult {
  fromBreakthroughCount: number
  toBreakthroughCount: number
  totalConsumed: number
  entry: WeaponInstance
}

// 돌파 5단계(WEAPON_MAX_BREAKTHROUGH)까지, 최소 1개 보존 규칙을 지키며 가능한
// 만큼 반복 — canBreakthrough와 정확히 같은 조건을 매 단계 다시 검사한다.
export function simulateBulkBreakthrough(entry: WeaponInstance): BulkBreakthroughResult {
  let current = { ...entry }
  const fromBreakthroughCount = entry.breakthroughCount
  let totalConsumed = 0

  while (canBreakthrough(current)) {
    const step = nextBreakthroughStep(current)
    if (!step) break
    current = {
      ...current,
      count: current.count - step.RequiredDuplicateCount,
      breakthroughCount: current.breakthroughCount + 1,
    }
    totalConsumed += step.RequiredDuplicateCount
  }

  return { fromBreakthroughCount, toBreakthroughCount: current.breakthroughCount, totalConsumed, entry: current }
}

export interface WeaponFusionStep {
  fromId: string
  toId: string
  timesFused: number
  consumed: number
  produced: number
}

export interface BulkFusionResult {
  steps: WeaponFusionStep[]
  ownedWeapons: OwnedWeapons
}

// startId에서 시작해 5개 단위로 가능한 만큼 합성 — chain=false면 한 등급/단계
// 경계만 처리하고 멈추고(예: 노말1→노말2), chain=true면 결과물로 또 합성이
// 가능한 한 계속 이어간다(노말1→노말2→노말3→...). 매 단계 "그 시점의 보유
// 개수 - 1"을 재료로 써서 canMerge와 동일한 최소 1개 보존 규칙을 그대로 지킨다.
export function simulateBulkFusion(ownedWeapons: OwnedWeapons, startId: string, chain: boolean): BulkFusionResult {
  const fusion = getWeaponFusionConfig()
  const steps: WeaponFusionStep[] = []
  let working = ownedWeapons
  let currentId = startId

  while (true) {
    const targetId = nextWeaponIdForMerge(currentId)
    if (!targetId) break

    const current = working[currentId]
    const count = current?.count ?? 0
    const available = Math.max(0, count - 1)
    const times = Math.floor(available / fusion.RequiredCount)
    if (times <= 0) break

    const consumed = times * fusion.RequiredCount
    const produced = times
    working = { ...working, [currentId]: { ...current!, count: current!.count - consumed } }
    working = grantWeaponEntry(working, targetId, produced, fusion.ResultLevel, fusion.ResultBreakthroughCount)
    steps.push({ fromId: currentId, toId: targetId, timesFused: times, consumed, produced })

    if (!chain) break
    currentId = targetId
  }

  return { steps, ownedWeapons: working }
}

// ---------------------------------------------------------------------------
// 무기군 단위 일괄 처리(v0.4.0) — "지금 보고 있는 무기 종류(예: 검 30칸)"
// 전체를 대상으로 돌파/합성 가능한 건 전부 한 번에 처리한다(개별 무기 하나를
// 반복 처리하는 simulateBulkBreakthrough/simulateBulkFusion과는 다른 축 —
// 저건 "이 무기를 최대한 밀어붙이기", 이건 "이 종류 전체를 정리하기").
// ---------------------------------------------------------------------------

export interface TypeBulkBreakthroughEntry {
  weaponId: string
  fromBreakthroughCount: number
  toBreakthroughCount: number
  consumed: number
}

export interface TypeBulkBreakthroughResult {
  entries: TypeBulkBreakthroughEntry[]
  totalConsumed: number
  ownedWeapons: OwnedWeapons
}

// 등급×단계(30칸)를 순서대로 훑으며 무기 하나하나에 simulateBulkBreakthrough를
// 적용한다 — 무기별로 서로 독립적인 연산이라 순서는 결과에 영향 없음(표시
// 순서로만 쓰임).
export function simulateTypeBulkBreakthrough(ownedWeapons: OwnedWeapons, type: WeaponTypeEnum): TypeBulkBreakthroughResult {
  let working = ownedWeapons
  const entries: TypeBulkBreakthroughEntry[] = []
  let totalConsumed = 0

  for (const grade of WEAPON_GRADES) {
    for (const tier of WEAPON_TIERS) {
      const weaponId = buildWeaponId(type, grade, tier)
      const entry = working[weaponId]
      if (!entry) continue
      const result = simulateBulkBreakthrough(entry)
      if (result.toBreakthroughCount === result.fromBreakthroughCount) continue
      working = { ...working, [weaponId]: result.entry }
      entries.push({
        weaponId,
        fromBreakthroughCount: result.fromBreakthroughCount,
        toBreakthroughCount: result.toBreakthroughCount,
        consumed: result.totalConsumed,
      })
      totalConsumed += result.totalConsumed
    }
  }

  return { entries, totalConsumed, ownedWeapons: working }
}

export interface TypeBulkFusionResult {
  steps: WeaponFusionStep[]
  ownedWeapons: OwnedWeapons
}

// 등급×단계를 낮은 쪽(Normal-T1)부터 높은 쪽(Mythic-T5) 순서로 훑으며 한 칸씩만
// 합성한다(chain=false). 순서 자체가 사다리를 따라 올라가므로, 낮은 칸에서 만든
// 결과물은 그 칸에 도착했을 때 다시 자연스럽게 처리된다 — 굳이 무기 하나에서
// chain=true로 끝까지 밀어 올릴 필요 없이, 30칸을 한 바퀴 도는 것 자체가 전체
// 사다리를 훑는 효과를 낸다.
export function simulateTypeBulkFusion(ownedWeapons: OwnedWeapons, type: WeaponTypeEnum): TypeBulkFusionResult {
  let working = ownedWeapons
  const steps: WeaponFusionStep[] = []

  for (const grade of WEAPON_GRADES) {
    for (const tier of WEAPON_TIERS) {
      const weaponId = buildWeaponId(type, grade, tier)
      if (!working[weaponId]) continue
      const result = simulateBulkFusion(working, weaponId, false)
      working = result.ownedWeapons
      steps.push(...result.steps)
    }
  }

  return { steps, ownedWeapons: working }
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

// mythicChanceBonus — 활성화된 유물(GACHA_MYTHIC_CHANCE)이 있으면 MythicWeight에
// 그대로 더한다(가중치 합이 대략 100이라 %p로 안내해도 체감이 맞는다).
export function rollWeaponGacha(gachaCount: number, mythicChanceBonus = 0): string {
  const level = currentGachaLevelConfig(gachaCount)

  const type = WEAPON_TYPES[Math.floor(Math.random() * WEAPON_TYPES.length)]
  const grade = weightedPick<WeaponGradeEnum>([
    ['Normal', level.NormalWeight],
    ['Rare', level.RareWeight],
    ['Epic', level.EpicWeight],
    ['Unique', level.UniqueWeight],
    ['Legendary', level.LegendaryWeight],
    ['Mythic', level.MythicWeight + mythicChanceBonus],
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
