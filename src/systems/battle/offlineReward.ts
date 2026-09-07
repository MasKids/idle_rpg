import { generateStage } from '../../data/stages'
import type { StatKey } from '../../types/game'

// 오프라인 동안 실제로 스테이지를 진행시키지 않고, "현재 스테이지의 적을 계속 처치했다면"의
// 기댓값만 계산해 재화로 지급한다. 처치 시간은 평균 데미지(치명타 기댓값 포함)와 ASPD로 역산.
export const OFFLINE_REWARD_MIN_MS = 60 * 1000
export const OFFLINE_REWARD_MAX_MS = 8 * 60 * 60 * 1000

export interface OfflineRewardResult {
  elapsedMs: number
  cappedMs: number
  kills: number
  rewards: {
    gold: number
    growthEnergy: number
    exist: number
  }
}

// 실제 전투 로직(calculateDamage)의 치명타 기댓값과 동일한 공식:
// 평균 데미지 = atk * (1 + (crit/100) * (critDmg/100 - 1))
function averageDamagePerHit(stats: Record<StatKey, number>): number {
  return stats.atk * (1 + (stats.crit / 100) * (stats.critDmg / 100 - 1))
}

export function computeOfflineReward(
  elapsedMs: number,
  currentStage: number,
  stats: Record<StatKey, number>,
): OfflineRewardResult | null {
  if (elapsedMs < OFFLINE_REWARD_MIN_MS) return null

  const cappedMs = Math.min(elapsedMs, OFFLINE_REWARD_MAX_MS)
  const dps = averageDamagePerHit(stats) * stats.aspd
  const stageData = generateStage(currentStage)
  const kills = dps > 0 ? Math.floor((cappedMs / 1000) * (dps / stageData.enemyHp)) : 0

  return {
    elapsedMs,
    cappedMs,
    kills,
    rewards: {
      gold: stageData.rewards.gold * kills,
      growthEnergy: stageData.rewards.growthEnergy * kills,
      exist: Math.floor(stageData.rewards.exist * stats.existGain) * kills,
    },
  }
}
