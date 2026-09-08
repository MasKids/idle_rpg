import { getStageConfig } from './balance'
import type { StageData } from '../types/game'

// StageTable은 스테이지 1000개를 나열하지 않고 챕터(10스테이지) 단위 기준값 + 증가율만
// 담고 있다. 이 "챕터당 10스테이지" 폭은 테이블 데이터가 아니라 StageTable 설계 전제라
// 여기서 구조 상수로 고정한다.
const STAGES_PER_CHAPTER = 10

function chapterOf(stage: number): number {
  return Math.ceil(stage / STAGES_PER_CHAPTER)
}

function isBossStage(stage: number): boolean {
  return stage % STAGES_PER_CHAPTER === 0
}

export function generateStage(stage: number): StageData {
  const chapter = chapterOf(stage)
  const isBoss = isBossStage(stage)
  const config = getStageConfig(chapter, isBoss ? 'Boss' : 'Normal')

  // 보스는 챕터당 정확히 1스테이지(챕터 마지막)라 config 값이 곧 그 스테이지의 값 —
  // 보간이 필요 없다. 일반 스테이지는 챕터 첫 스테이지 대비 오프셋만큼 증가율을 거듭제곱한다.
  if (isBoss) {
    return {
      stage,
      isBoss: true,
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

  const referenceStage = (chapter - 1) * STAGES_PER_CHAPTER + 1
  const offset = stage - referenceStage

  const enemyHp = Math.floor(config.EnemyHp * config.HpGrowthRate ** offset)
  const enemyAtk = Math.floor(config.EnemyAtk * config.HpGrowthRate ** offset)
  const gold = Math.floor(config.RewardGold * config.RewardGrowthRate ** offset)
  const growthEnergy = Math.floor(config.RewardGrowth * config.RewardGrowthRate ** offset)
  const exist = Math.max(1, Math.floor(config.RewardExist * config.RewardGrowthRate ** offset))

  return {
    stage,
    isBoss: false,
    enemyHp,
    enemyAtk,
    rewards: { gold, growthEnergy, exist, timeEnergy: config.RewardTimeEnergy },
  }
}

export function killsRequiredForStage(stage: number): number {
  const chapter = chapterOf(stage)
  const isBoss = isBossStage(stage)
  return getStageConfig(chapter, isBoss ? 'Boss' : 'Normal').KillCount
}

// "구간-스테이지" 표기. 챕터가 오르면 구간도 오른다 (예: 11 -> "2-1")
export function stageLabel(stage: number): string {
  const section = chapterOf(stage)
  const sub = ((stage - 1) % STAGES_PER_CHAPTER) + 1
  return `${section}-${sub}`
}
