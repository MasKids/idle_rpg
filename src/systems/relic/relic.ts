// 유물 시스템 — 뽑기(순수 랜덤, 중복 자동 환급), 존재력 트리 연동 슬롯 수,
// 활성화된 유물의 효과 집계. docs/WEAPON_SYSTEM.md 3장 참고.
import {
  BALANCE_TABLES,
  getRelicConfig,
  getRelicGradeInfo,
  getRelicSlotConfig,
  getString,
  type RelicEffectTypeEnum,
  type RelicGradeEnum,
  type RelicTableRow,
} from '../../data/balance'
import { getRelicUiLabel, getStatName } from '../../data/uiStrings'
import type { ActiveRelicSlots, StatKey } from '../../types/game'

export const RELIC_SLOT_MAX = BALANCE_TABLES.RelicSlotTable.length

// RelicTable 자체가 가진 등급 이름을 조회한다(GradeTable 삭제 — 3단계).
export function relicGradeName(grade: RelicGradeEnum): string {
  return getString(getRelicGradeInfo(grade).NameStringId, 'KOR', grade)
}

export const RELIC_GRADES: RelicGradeEnum[] = ['Normal', 'Rare', 'Epic', 'Legendary']

// 무기 그리드와 동일하게 등급순으로 정렬된 유물 전체 목록 (보유 여부 무관)
export function sortedRelicRows(): RelicTableRow[] {
  return RELIC_GRADES.flatMap((grade) => BALANCE_TABLES.RelicTable.filter((row) => row.RelicGrade === grade))
}

// 존재력 트리 해금 노드 수 → 사용 가능한 유물 슬롯 수 (RelicSlotTable 기준, 최대 RELIC_SLOT_MAX)
export function computeRelicSlotCount(unlockedCount: number): number {
  let count = 0
  for (let slot = 1; slot <= RELIC_SLOT_MAX; slot++) {
    if (unlockedCount >= getRelicSlotConfig(slot).RequireUnlockedCount) count = slot
  }
  return count
}

// 순수 랜덤 — 9종 전체를 GachaWeight로 한 번에 추첨(등급별 별도 게이트 없음)
export function rollRelicGacha(): number {
  const rows = BALANCE_TABLES.RelicTable
  const total = rows.reduce((sum, r) => sum + Math.max(0, r.GachaWeight), 0)
  if (total <= 0) return rows[0]?.Id ?? 0

  let roll = Math.random() * total
  for (const row of rows) {
    roll -= Math.max(0, row.GachaWeight)
    if (roll < 0) return row.Id
  }
  return rows[rows.length - 1].Id
}

const STAT_EFFECT_TO_KEY: Partial<Record<RelicEffectTypeEnum, StatKey>> = {
  STAT_ATK: 'atk',
  STAT_ASPD: 'aspd',
  STAT_CRIT: 'crit',
  STAT_CRIT_DMG: 'critDmg',
  STAT_EXIST_GAIN: 'existGain',
}

// 유물 목록/뽑기 결과에 보여줄 효과 한 줄 설명 (예: "공격력 +5", "공격속도 +8%",
// "골드 획득량 +10%") — v0.3.0 밸런스 개편으로 스탯형 효과도 EffectValueType이
// PERCENT면 % 표기가 붙는다.
export function relicEffectLabel(relic: RelicTableRow): string {
  const statKey = STAT_EFFECT_TO_KEY[relic.EffectType]
  if (statKey) {
    const suffix = relic.EffectValueType === 'PERCENT' ? '%' : ''
    return `${getStatName(statKey)} +${relic.EffectValue}${suffix}`
  }
  if (relic.EffectType === 'GOLD_GAIN') return `${getRelicUiLabel('goldGain')} +${relic.EffectValue}%`
  if (relic.EffectType === 'TIMEHEIST_COOLDOWN') return `${getRelicUiLabel('timeHeistCooldown')} -${relic.EffectValue}%`
  if (relic.EffectType === 'GROWTH_GAIN') return `${getRelicUiLabel('growthGain')} +${relic.EffectValue}%`
  if (relic.EffectType === 'TIME_ENERGY_GAIN') return `${getRelicUiLabel('timeEnergyGain')} +${relic.EffectValue}%`
  if (relic.EffectType === 'GACHA_MYTHIC_CHANCE') return `${getRelicUiLabel('mythicChance')} +${relic.EffectValue}%p`
  return ''
}

export interface ActiveRelicEffects {
  // v0.3.0 밸런스 개편 — 유물은 "혼합"(유물별로 깡스탯 또는 퍼센트)이라 둘을
  // 분리해서 반환한다. gameStore가 각각 깡스탯 합계/퍼센트 합계에 더한다.
  statBonusFlat: Record<StatKey, number>
  statBonusPercent: Record<StatKey, number>
  // 스탯 밖 특수 효과 — applyGoldGainBonus/applyTimeHeistCooldownReduction으로 적용한다.
  goldGainBonusPercent: number
  timeHeistCooldownReductionPercent: number
  // v0.4.0 추가 — applyGrowthGainBonus/applyTimeEnergyGainBonus로 적용.
  growthGainBonusPercent: number
  timeEnergyGainBonusPercent: number
  // 무기 가챠 신화 가중치에 그대로 더하는 가산 보너스(rollWeaponGacha가 직접 소비).
  mythicChanceBonus: number
}

const EMPTY_STAT_BONUS: Record<StatKey, number> = {
  atk: 0,
  aspd: 0,
  crit: 0,
  critDmg: 0,
  existGain: 0,
}

// 골드 획득량 특수 효과 적용 — 스테이지 처치 보상/오프라인 보상/타임 하이스트 보상 등
// "골드를 지급하는 모든 지점"에서 공통으로 쓴다.
export function applyGoldGainBonus(amount: number, bonusPercent: number): number {
  return Math.floor(amount * (1 + bonusPercent / 100))
}

// 타임 하이스트 쿨타임 감소 특수 효과 적용 — 0% 밑으로는 안 내려가게 클램프.
export function applyTimeHeistCooldownReduction(cooldownMs: number, reductionPercent: number): number {
  const clamped = Math.min(100, Math.max(0, reductionPercent))
  return Math.floor(cooldownMs * (1 - clamped / 100))
}

// 성장에너지/시간에너지 획득량 특수 효과 적용 — applyGoldGainBonus와 동일한 패턴.
export function applyGrowthGainBonus(amount: number, bonusPercent: number): number {
  return Math.floor(amount * (1 + bonusPercent / 100))
}

export function applyTimeEnergyGainBonus(amount: number, bonusPercent: number): number {
  return Math.floor(amount * (1 + bonusPercent / 100))
}

// 활성화된(슬롯에 꽂힌) 유물들의 효과를 합산한다. 보유만 하고 비활성화된 유물은 반영 안 됨.
export function computeActiveRelicEffects(activeRelics: ActiveRelicSlots): ActiveRelicEffects {
  const statBonusFlat = { ...EMPTY_STAT_BONUS }
  const statBonusPercent = { ...EMPTY_STAT_BONUS }
  let goldGainBonusPercent = 0
  let timeHeistCooldownReductionPercent = 0
  let growthGainBonusPercent = 0
  let timeEnergyGainBonusPercent = 0
  let mythicChanceBonus = 0

  for (const relicId of activeRelics) {
    if (relicId === null) continue
    // activeRelics는 항상 setRelicSlot으로 검증된 id만 담기므로 존재를 항상 보장하는
    // getRelicConfig를 그대로 써도 안전하다(없으면 기본값+경고).
    const relic = getRelicConfig(relicId)

    const statKey = STAT_EFFECT_TO_KEY[relic.EffectType]
    if (statKey) {
      if (relic.EffectValueType === 'PERCENT') statBonusPercent[statKey] += relic.EffectValue
      else statBonusFlat[statKey] += relic.EffectValue
    } else if (relic.EffectType === 'GOLD_GAIN') {
      goldGainBonusPercent += relic.EffectValue
    } else if (relic.EffectType === 'TIMEHEIST_COOLDOWN') {
      timeHeistCooldownReductionPercent += relic.EffectValue
    } else if (relic.EffectType === 'GROWTH_GAIN') {
      growthGainBonusPercent += relic.EffectValue
    } else if (relic.EffectType === 'TIME_ENERGY_GAIN') {
      timeEnergyGainBonusPercent += relic.EffectValue
    } else if (relic.EffectType === 'GACHA_MYTHIC_CHANCE') {
      mythicChanceBonus += relic.EffectValue
    }
  }

  return {
    statBonusFlat,
    statBonusPercent,
    goldGainBonusPercent,
    timeHeistCooldownReductionPercent,
    growthGainBonusPercent,
    timeEnergyGainBonusPercent,
    mythicChanceBonus,
  }
}
