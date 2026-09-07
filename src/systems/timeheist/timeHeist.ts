import { BALANCE } from '../../data/balance'
import { generateStage } from '../../data/stages'

const { timeHeist } = BALANCE

export function timeHeistCost(usedCount: number): number {
  return Math.floor(timeHeist.baseCost * timeHeist.costGrowth ** usedCount)
}

export function timeHeistCooldownMs(usedCount: number): number {
  return Math.floor(timeHeist.baseCooldownSeconds * 1000 * timeHeist.cooldownGrowth ** usedCount)
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
  const targetStage = currentStage + timeHeist.stageOffset
  const perClear = generateStage(targetStage).rewards

  return {
    currentStage,
    targetStage,
    clearCount: timeHeist.clearCount,
    cost: timeHeistCost(usedCount),
    cooldownMs: timeHeistCooldownMs(usedCount),
    rewards: {
      gold: perClear.gold * timeHeist.clearCount,
      growthEnergy: perClear.growthEnergy * timeHeist.clearCount,
      exist: Math.floor(perClear.exist * timeHeist.clearCount * existGain),
    },
  }
}
