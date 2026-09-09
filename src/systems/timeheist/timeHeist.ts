import { getTimeHeistConfig } from '../../data/balance'
import { generateStage } from '../../data/stages'
import { applyGoldGainBonus, applyTimeHeistCooldownReduction } from '../relic/relic'

export function timeHeistCost(usedCount: number): number {
  const config = getTimeHeistConfig()
  return Math.floor(config.CostBase * config.CostGrowthRate ** usedCount)
}

export function timeHeistCooldownMs(usedCount: number, cooldownReductionPercent = 0): number {
  const config = getTimeHeistConfig()
  const base = Math.floor(config.CooldownBase * 1000 * config.CooldownGrowthRate ** usedCount)
  return applyTimeHeistCooldownReduction(base, cooldownReductionPercent)
}

// 저장은 "마지막 사용 시각"만 하고, 쿨타임 종료 시각은 항상 여기서 역산한다.
// 그래야 나중에 쿨타임 배율 공식이 바뀌어도 저장된 값이 낡은 계산 결과로 굳어있지 않는다.
// usedCount는 마지막 사용 이후의 누적 총 횟수이므로, 마지막 사용 당시의 성장 배율은 usedCount - 1 기준.
export function timeHeistCooldownEndsAt(usedCount: number, lastUsedAt: number | null, cooldownReductionPercent = 0): number | null {
  if (lastUsedAt === null || usedCount <= 0) return null
  return lastUsedAt + timeHeistCooldownMs(usedCount - 1, cooldownReductionPercent)
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
export function computeTimeHeistPreview(
  currentStage: number,
  existGain: number,
  usedCount: number,
  goldGainBonusPercent = 0,
  cooldownReductionPercent = 0,
): TimeHeistPreview {
  const config = getTimeHeistConfig()
  const targetStage = currentStage + config.TargetStageOffset
  const perClear = generateStage(targetStage).rewards

  return {
    currentStage,
    targetStage,
    clearCount: config.RewardMultiplier,
    cost: timeHeistCost(usedCount),
    cooldownMs: timeHeistCooldownMs(usedCount, cooldownReductionPercent),
    rewards: {
      gold: applyGoldGainBonus(perClear.gold * config.RewardMultiplier, goldGainBonusPercent),
      growthEnergy: perClear.growthEnergy * config.RewardMultiplier,
      exist: Math.floor(perClear.exist * config.RewardMultiplier * existGain),
    },
  }
}
