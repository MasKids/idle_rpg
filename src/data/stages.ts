import { getStageConfig } from './balance'
import type { StageData } from '../types/game'

// StageTable이 스테이지 1개당 1행(200행)을 전부 나열하므로(2단계 개편,
// docs/TABLE_REDESIGN.md 2.2절) 챕터 보간은 더 이상 필요 없다 — getStageConfig가
// 테이블 범위를 넘는 스테이지는 마지막 행으로 알아서 연장해준다. "챕터당
// 10스테이지" 폭은 "N-M" 표시 라벨을 만드는 데만 쓰는 UI 상수로 남겨둔다.
const STAGES_PER_CHAPTER = 10

function chapterOf(stage: number): number {
  return Math.ceil(stage / STAGES_PER_CHAPTER)
}

export function generateStage(stage: number): StageData {
  const config = getStageConfig(stage)

  return {
    stage,
    isBoss: config.StageType === 'Boss',
    enemyHp: config.EnemyHp,
    enemyAtk: config.EnemyAtk,
    rewards: {
      gold: config.RewardGold,
      growthEnergy: config.RewardGrowth,
      exist: config.RewardExist,
      timeEnergy: config.RewardTimeEnergy,
    },
  }
}

export function killsRequiredForStage(stage: number): number {
  return getStageConfig(stage).KillCount
}

// "구간-스테이지" 표기. 챕터가 오르면 구간도 오른다 (예: 11 -> "2-1")
export function stageLabel(stage: number): string {
  const section = chapterOf(stage)
  const sub = ((stage - 1) % STAGES_PER_CHAPTER) + 1
  return `${section}-${sub}`
}
