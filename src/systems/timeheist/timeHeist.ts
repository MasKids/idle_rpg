import { generateStage } from '../../data/stages'

// 미래 스테이지 오프셋 / 클리어 환산 횟수 — 1차 초안, 실측 후 밸런싱 대상.
export const TIME_HEIST_STAGE_OFFSET = 10
export const TIME_HEIST_CLEAR_COUNT = 5

// 비용은 사용 횟수에 따라 지수적으로 상승 (2.0배씩)
export const TIME_HEIST_BASE_COST = 20
export const TIME_HEIST_COST_GROWTH = 2.0

// 쿨타임도 사용 횟수에 따라 지수적으로 상승 (1.5배씩). 기본 2시간
export const TIME_HEIST_BASE_COOLDOWN_MS = 2 * 60 * 60 * 1000
export const TIME_HEIST_COOLDOWN_GROWTH = 1.5

export function timeHeistCost(usedCount: number): number {
  return Math.floor(TIME_HEIST_BASE_COST * TIME_HEIST_COST_GROWTH ** usedCount)
}

export function timeHeistCooldownMs(usedCount: number): number {
  return Math.floor(TIME_HEIST_BASE_COOLDOWN_MS * TIME_HEIST_COOLDOWN_GROWTH ** usedCount)
}

// 저장은 "마지막 사용 시각"만 하고, 쿨타임 종료 시각은 항상 여기서 역산한다.
// 그래야 나중에 쿨타임 배율 공식이 바뀌어도 저장된 값이 낡은 계산 결과로 굳어있지 않는다.
// usedCount는 마지막 사용 이후의 누적 총 횟수이므로, 마지막 사용 당시의 성장 배율은 usedCount - 1 기준.
export function timeHeistCooldownEndsAt(usedCount: number, lastUsedAt: number | null): number | null {
  if (lastUsedAt === null || usedCount <= 0) return null
  return lastUsedAt + timeHeistCooldownMs(usedCount - 1)
}

export interface TimeHeistPreview {
  currentStage: number
  targetStage: number
  clearCount: number
  cost: number
  cooldownMs: number
  rewards: {
    gold: number
    growthEnergy: number
    exist: number
  }
}

// existGain은 존재력 보상에도 평소 전투와 동일하게 배율로 반영한다.
// usedCount는 "지금까지 완료된 사용 횟수" — 이번 사용의 비용/이후 쿨타임 계산에 쓰인다.
export function computeTimeHeistPreview(currentStage: number, existGain: number, usedCount: number): TimeHeistPreview {
  const targetStage = currentStage + TIME_HEIST_STAGE_OFFSET
  const perClear = generateStage(targetStage).rewards

  return {
    currentStage,
    targetStage,
    clearCount: TIME_HEIST_CLEAR_COUNT,
    cost: timeHeistCost(usedCount),
    cooldownMs: timeHeistCooldownMs(usedCount),
    rewards: {
      gold: perClear.gold * TIME_HEIST_CLEAR_COUNT,
      growthEnergy: perClear.growthEnergy * TIME_HEIST_CLEAR_COUNT,
      exist: Math.floor(perClear.exist * TIME_HEIST_CLEAR_COUNT * existGain),
    },
  }
}
