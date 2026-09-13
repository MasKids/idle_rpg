import type { StatKey } from '../../types/game'

export interface DamageResult {
  amount: number
  isCrit: boolean
  // 치명타 발동 횟수(v0.4.0 다중 치명타) — 0이면 치명타 없음, 2 이상이면
  // 치명타 배율이 그만큼 곱연산된다. isCrit은 critCount > 0과 동일하며
  // 기존 호출부(단순 크리 여부만 필요한 곳)를 그대로 쓸 수 있게 남겨뒀다.
  critCount: number
}

// 치확(stats.crit)이 100%를 넘으면 초과분을 추가 치명타 판정으로 돌린다 —
// 100%마다 확정 1회, 남은 소수 부분이 다음 1회의 확률(예: 250% → 확정 2회 +
// 50% 확률로 3회째). 치명타 배율(critDmg/100)은 발동 횟수만큼 거듭제곱으로
// 곱한다. 상한은 두지 않았다(요청 2번 — 필요해지면 발동 횟수 상한이나 2회차
// 이후 배율 체감을 검토).
export function calculateDamage(stats: Record<StatKey, number>): DamageResult {
  const guaranteedCrits = Math.floor(stats.crit / 100)
  const remainder = stats.crit - guaranteedCrits * 100
  const extraCrit = Math.random() * 100 < remainder ? 1 : 0
  const critCount = guaranteedCrits + extraCrit
  const isCrit = critCount > 0

  const critMultiplier = isCrit ? (stats.critDmg / 100) ** critCount : 1
  const amount = Math.max(1, Math.round(stats.atk * critMultiplier))
  return { amount, isCrit, critCount }
}
