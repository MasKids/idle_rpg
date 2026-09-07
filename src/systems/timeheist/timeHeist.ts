import { generateStage } from '../../data/stages'

// 미래 스테이지 오프셋 / 클리어 환산 횟수 / TIME_ENERGY 소모량 — 1차 초안, 실측 후 밸런싱 대상.
// 소모량은 고정값으로 둔다 (스테이지 비례보다 구현이 단순함).
export const TIME_HEIST_STAGE_OFFSET = 10
export const TIME_HEIST_CLEAR_COUNT = 5
export const TIME_HEIST_COST = 20

export interface TimeHeistPreview {
  currentStage: number
  targetStage: number
  clearCount: number
  cost: number
  rewards: {
    gold: number
    growthEnergy: number
    exist: number
  }
}

// existGain은 존재력 보상에도 평소 전투와 동일하게 배율로 반영한다.
export function computeTimeHeistPreview(currentStage: number, existGain: number): TimeHeistPreview {
  const targetStage = currentStage + TIME_HEIST_STAGE_OFFSET
  const perClear = generateStage(targetStage).rewards

  return {
    currentStage,
    targetStage,
    clearCount: TIME_HEIST_CLEAR_COUNT,
    cost: TIME_HEIST_COST,
    rewards: {
      gold: perClear.gold * TIME_HEIST_CLEAR_COUNT,
      growthEnergy: perClear.growthEnergy * TIME_HEIST_CLEAR_COUNT,
      exist: Math.floor(perClear.exist * TIME_HEIST_CLEAR_COUNT * existGain),
    },
  }
}
