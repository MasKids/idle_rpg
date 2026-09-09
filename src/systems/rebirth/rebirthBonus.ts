import { getRebirthConfig } from '../../data/balance'

// 리버스 시점의 도달 스테이지로부터 이번에 획득할 회차 보너스 포인트를 계산한다.
// 최소 스테이지 제한 없음 — 낮은 스테이지에서는 자연히 값이 작게 나온다.
// 소수점을 버리지 않고 그대로 누적해, 스테이지 1칸 차이도 보너스에 반영되게 한다.
export function computeRebirthBonusPoints(currentStage: number): number {
  const config = getRebirthConfig()
  return config.BonusBase * currentStage ** config.BonusExponent
}

// 누적 회차 보너스 포인트로부터 리버스 환급량에 곱연산으로 붙는 배율을 계산한다.
// 전투 중 재화 획득량이나 스탯에는 전혀 관여하지 않고, 리버스 실행 시 환급에만 적용된다.
export function computeRefundMultiplier(bonusPoint: number): number {
  const config = getRebirthConfig()
  const multiplier = 1 + (bonusPoint * config.RefundBonusPerPoint) / 100
  return Math.min(config.MaxRefundMultiplier, multiplier)
}

// 리버스 시점의 도달 스테이지로부터 신규 지급되는 다이아 수량을 계산한다.
// 그동안 소비한 다이아를 "돌려받는" 환급이 아니라 매 리버스마다 새로 얻는 지급이라
// rebirthSpent/환급 배율과는 무관하다 — 다이아가 유일한 무기 가챠 재화라
// 리버스 없이는 획득 경로가 없는 문제를 이걸로 해소한다.
export function computeRebirthDiamondReward(currentStage: number): number {
  const config = getRebirthConfig()
  return Math.floor(config.DiamondBase * currentStage ** config.DiamondExponent)
}
