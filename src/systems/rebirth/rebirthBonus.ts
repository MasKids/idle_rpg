import { getCommon, getRebirthRefundConfig } from '../../data/balance'

// 리버스 시점의 도달 스테이지로부터 이번에 획득할 회차 보너스 포인트를 계산한다.
// 최소 스테이지 제한 없음 — 낮은 스테이지에서는 자연히 값이 작게 나온다.
// 소수점을 버리지 않고 그대로 누적해, 스테이지 1칸 차이도 보너스에 반영되게 한다.
export function computeRebirthBonusPoints(currentStage: number): number {
  return getCommon('RebirthBonusBase') * currentStage ** getCommon('RebirthBonusExponent')
}

// 누적 회차 보너스 포인트로부터 리버스 환급량에 곱연산으로 붙는 배율을 계산한다.
// 전투 중 재화 획득량이나 스탯에는 전혀 관여하지 않고, 리버스 실행 시 환급에만 적용된다.
// RefundBonusPerPoint/MaxRefundMultiplier가 RebirthTable 삭제(3단계)로 RebirthRewardTable로
// 옮겨가며 도달 스테이지 구간별 값이 됐다 — stage 인자가 그래서 새로 필요하다.
export function computeRefundMultiplier(stage: number, bonusPoint: number): number {
  const config = getRebirthRefundConfig(stage)
  const multiplier = 1 + (bonusPoint * config.RefundBonusPerPoint) / 100
  return Math.min(config.MaxRefundMultiplier, multiplier)
}
