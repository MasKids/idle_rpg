import type { StatKey } from '../../types/game'

export interface DamageResult {
  amount: number
  isCrit: boolean
  // 치명타 발동 횟수(v0.4.0 다중 치명타) — 0이면 치명타 없음, 2 이상이면
  // 치명타 배율이 그만큼 곱연산된다. isCrit은 critCount > 0과 동일하며
  // 기존 호출부(단순 크리 여부만 필요한 곳)를 그대로 쓸 수 있게 남겨뒀다.
  critCount: number
}

// 다중 치명타가 너무 강하다는 피드백으로 두 축을 너프했다(v0.4.0, 최초 다중
// 치명타 도입 직후):
// - 치명타 변환 20%: 치확 100% 초과분이 "그대로" 추가 치명타 확률이 되던 걸
//   20%만 반영하도록 낮췄다(예: 치확 250% → 예전엔 확정 2회+50%확률로 3회째,
//   지금은 확정 1회(100%까지)+초과 150%p 중 20%인 30%p만 반영 → 확정 0회 +
//   30% 확률로 2회째).
// - 치명타 데미지 보너스 50%: 치명타 배율(critDmg/100)에서 "100% 기준
//   보너스분"(critDmg-100)만 절반으로 깎는다 — critDmg가 150%면 실제로는
//   125%로 계산. 기준선(100%, 즉 "보너스 없음")보다 낮아질 일은 없다.
const CRIT_CONVERSION_RATE = 0.2
const CRIT_DMG_BONUS_SCALE = 0.5

// 치확(stats.crit)이 100%를 넘으면 초과분을 추가 치명타 판정으로 돌린다 —
// (초과분 × 변환율)이 100%마다 확정 1회, 남은 소수 부분이 다음 1회의 확률.
// 치명타 배율(너프된 critDmg/100)은 발동 횟수만큼 거듭제곱으로 곱한다. 발동
// 횟수 상한은 두지 않았다(다중 치명타 도입 시 검토 — 필요해지면 상한을 다시
// 고려).
export function calculateDamage(stats: Record<StatKey, number>): DamageResult {
  let critCount: number
  if (stats.crit >= 100) {
    const excess = stats.crit - 100
    const convertedExcess = excess * CRIT_CONVERSION_RATE
    const guaranteedExtra = Math.floor(convertedExcess / 100)
    const remainderExtra = convertedExcess - guaranteedExtra * 100
    const extraCrit = Math.random() * 100 < remainderExtra ? 1 : 0
    critCount = 1 + guaranteedExtra + extraCrit
  } else {
    critCount = Math.random() * 100 < stats.crit ? 1 : 0
  }
  const isCrit = critCount > 0

  const effectiveCritDmg = 100 + Math.max(0, stats.critDmg - 100) * CRIT_DMG_BONUS_SCALE
  const critMultiplier = isCrit ? (effectiveCritDmg / 100) ** critCount : 1
  const amount = Math.max(1, Math.round(stats.atk * critMultiplier))
  return { amount, isCrit, critCount }
}
