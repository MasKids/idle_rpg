import { getCommon } from '../../data/balance'
import { generateStage } from '../../data/stages'
import { applyGoldGainBonus } from '../relic/relic'
import type { StatKey } from '../../types/game'

// 오프라인 동안 실제로 스테이지를 진행시키지 않고, "현재 스테이지의 적을 계속 처치했다면"의
// 기댓값만 계산해 재화로 지급한다. 처치 시간은 평균 데미지(치명타 기댓값 포함)와 ASPD로 역산.
// 1분 미만은 모달을 띄우지 않기 위한 표시 임계값 — 밸런싱 수치가 아니라 UX 임계값이라 CommonTable에는 두지 않는다.
export const OFFLINE_REWARD_MIN_MS = 60 * 1000

export function offlineRewardMaxMs(): number {
  return getCommon('OfflineMaxHours') * 60 * 60 * 1000
}

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
  goldGainBonusPercent = 0,
): OfflineRewardResult | null {
  if (elapsedMs < OFFLINE_REWARD_MIN_MS) return null

  const cappedMs = Math.min(elapsedMs, offlineRewardMaxMs())
  const dps = averageDamagePerHit(stats) * stats.aspd
  const stageData = generateStage(currentStage)
  const kills = dps > 0 ? Math.floor((cappedMs / 1000) * (dps / stageData.enemyHp)) : 0
  const rewardMultiplier = getCommon('OfflineRewardMultiplier')

  return {
    elapsedMs,
    cappedMs,
    kills,
    rewards: {
      gold: applyGoldGainBonus(Math.floor(stageData.rewards.gold * kills * rewardMultiplier), goldGainBonusPercent),
      growthEnergy: Math.floor(stageData.rewards.growthEnergy * kills * rewardMultiplier),
      exist: Math.floor(stageData.rewards.exist * stats.existGain * kills * rewardMultiplier),
    },
  }
}
