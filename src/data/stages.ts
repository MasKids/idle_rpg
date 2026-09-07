import type { StageData } from '../types/game'

const BOSS_INTERVAL = 10

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
