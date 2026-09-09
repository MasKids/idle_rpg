// 유물 시스템 — 뽑기(순수 랜덤, 중복 자동 환급), 존재력 트리 연동 슬롯 수,
// 활성화된 유물의 효과 집계. docs/WEAPON_SYSTEM.md 3장 참고.
import { BALANCE_TABLES, getRelicSlotConfig, type RelicEffectTypeEnum } from '../../data/balance'
import type { ActiveRelicSlots, StatKey } from '../../types/game'

export const RELIC_SLOT_MAX = BALANCE_TABLES.RelicSlotTable.length

// 존재력 트리 해금 노드 수 → 사용 가능한 유물 슬롯 수 (RelicSlotTable 기준, 최대 5)
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
  STAT_DEF: 'def',
  STAT_ASPD: 'aspd',
  STAT_CRIT: 'crit',
  STAT_CRIT_DMG: 'critDmg',
  STAT_EXIST_GAIN: 'existGain',
}

export interface ActiveRelicEffects {
  statBonus: Record<StatKey, number>
  // 스탯 밖 특수 효과 — 아직 전투 루프/타임 하이스트에는 연결되지 않았다(계산만 준비됨).
  goldGainBonusPercent: number
  timeHeistCooldownReductionPercent: number
}

const EMPTY_STAT_BONUS: Record<StatKey, number> = {
  atk: 0,
  def: 0,
  aspd: 0,
  crit: 0,
  critDmg: 0,
  existGain: 0,
}

// 활성화된(슬롯에 꽂힌) 유물들의 효과를 합산한다. 보유만 하고 비활성화된 유물은 반영 안 됨.
export function computeActiveRelicEffects(activeRelics: ActiveRelicSlots): ActiveRelicEffects {
  const statBonus = { ...EMPTY_STAT_BONUS }
  let goldGainBonusPercent = 0
  let timeHeistCooldownReductionPercent = 0

  for (const relicId of activeRelics) {
    if (relicId === null) continue
    const relic = BALANCE_TABLES.RelicTable.find((r) => r.Id === relicId)
    if (!relic) continue

    const statKey = STAT_EFFECT_TO_KEY[relic.EffectType]
    if (statKey) {
      statBonus[statKey] += relic.EffectValue
    } else if (relic.EffectType === 'GOLD_GAIN') {
      goldGainBonusPercent += relic.EffectValue
    } else if (relic.EffectType === 'TIMEHEIST_COOLDOWN') {
      timeHeistCooldownReductionPercent += relic.EffectValue
    }
  }

  return { statBonus, goldGainBonusPercent, timeHeistCooldownReductionPercent }
}
