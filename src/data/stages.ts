import type { StageData } from '../types/game'

const BOSS_INTERVAL = 10

// 일반 스테이지 처치 목표. 보스는 1마리. 1차 초안 — 실측 후 밸런싱 대상
const NORMAL_STAGE_KILLS_REQUIRED = 5

// 1차 초안 곡선 — 실측 후 밸런싱 대상
const BASE_ENEMY_HP = 20
const HP_GROWTH = 1.15
const BASE_ENEMY_ATK = 3
const ATK_GROWTH = 1.12

const BASE_GOLD_REWARD = 5
const GOLD_GROWTH = 1.1
const BASE_GROWTH_ENERGY_REWARD = 2
const GROWTH_ENERGY_GROWTH = 1.08

const BOSS_HP_MULTIPLIER = 5
const BOSS_ATK_MULTIPLIER = 2
const BOSS_REWARD_MULTIPLIER = 3

export function generateStage(stage: number): StageData {
  const isBoss = stage % BOSS_INTERVAL === 0

  const enemyHp = Math.floor(BASE_ENEMY_HP * HP_GROWTH ** (stage - 1)) * (isBoss ? BOSS_HP_MULTIPLIER : 1)
  const enemyAtk = Math.floor(BASE_ENEMY_ATK * ATK_GROWTH ** (stage - 1)) * (isBoss ? BOSS_ATK_MULTIPLIER : 1)

  const gold = Math.floor(BASE_GOLD_REWARD * GOLD_GROWTH ** (stage - 1)) * (isBoss ? BOSS_REWARD_MULTIPLIER : 1)
  const growthEnergy =
    Math.floor(BASE_GROWTH_ENERGY_REWARD * GROWTH_ENERGY_GROWTH ** (stage - 1)) *
    (isBoss ? BOSS_REWARD_MULTIPLIER : 1)
  const exist = Math.max(1, Math.floor(stage / 10)) * (isBoss ? 2 : 1)

  return {
    stage,
    isBoss,
    enemyHp,
    enemyAtk,
    rewards: { gold, growthEnergy, exist },
  }
}

export function killsRequiredForStage(stage: number): number {
  return stage % BOSS_INTERVAL === 0 ? 1 : NORMAL_STAGE_KILLS_REQUIRED
}

// "구간-스테이지" 표기. 10 클리어마다 구간이 오른다 (예: 11 -> "2-1")
export function stageLabel(stage: number): string {
  const section = Math.ceil(stage / BOSS_INTERVAL)
  const sub = ((stage - 1) % BOSS_INTERVAL) + 1
  return `${section}-${sub}`
}
