import { BALANCE } from './balance'
import type { StageData } from '../types/game'

const { battle, rewards } = BALANCE

export function generateStage(stage: number): StageData {
  const isBoss = stage % battle.bossInterval === 0

  const enemyHp =
    Math.floor(battle.enemyBaseHp * battle.enemyHpGrowth ** (stage - 1)) * (isBoss ? battle.bossHpMultiplier : 1)
  const enemyAtk =
    Math.floor(battle.enemyBaseAtk * battle.enemyAtkGrowth ** (stage - 1)) * (isBoss ? battle.bossAtkMultiplier : 1)

  const gold =
    Math.floor(rewards.goldBaseReward * rewards.goldGrowth ** (stage - 1)) * (isBoss ? battle.bossRewardMultiplier : 1)
  const growthEnergy =
    Math.floor(rewards.growthEnergyBaseReward * rewards.growthEnergyGrowth ** (stage - 1)) *
    (isBoss ? battle.bossRewardMultiplier : 1)
  const exist =
    Math.max(1, Math.floor(stage / rewards.existRewardStageDivisor)) * (isBoss ? rewards.existRewardBossMultiplier : 1)

  return {
    stage,
    isBoss,
    enemyHp,
    enemyAtk,
    rewards: { gold, growthEnergy, exist },
  }
}

export function killsRequiredForStage(stage: number): number {
  return stage % battle.bossInterval === 0 ? 1 : battle.killsRequiredPerStage
}

// "구간-스테이지" 표기. 10 클리어마다 구간이 오른다 (예: 11 -> "2-1")
export function stageLabel(stage: number): string {
  const section = Math.ceil(stage / battle.bossInterval)
  const sub = ((stage - 1) % battle.bossInterval) + 1
  return `${section}-${sub}`
}
