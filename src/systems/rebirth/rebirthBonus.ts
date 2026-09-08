import { getRebirthConfig } from '../../data/balance'

// 리버스 시점의 도달 스테이지로부터 이번에 획득할 회차 보너스 포인트를 계산한다.
// MinStageForBonus 미만에서 리버스하면 0.
export function computeRebirthBonusPoints(currentStage: number): number {
  const config = getRebirthConfig()
  if (currentStage < config.MinStageForBonus) return 0
  return Math.floor(config.BonusBase * currentStage ** config.BonusExponent)
}

// 누적 회차 보너스 포인트로부터 전 스탯에 곱연산으로 붙는 보너스율(%)을 계산한다.
export function computeAllStatBonusPercent(bonusPoint: number): number {
  const config = getRebirthConfig()
  return bonusPoint * config.BonusPerPoint
}
