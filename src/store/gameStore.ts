import { create } from 'zustand'
import { EXIST_SPECIAL_UNLOCKS } from '../data/existTree'
import { generateStage, killsRequiredForStage } from '../data/stages'
import { computeStatValue, statUpgradeCost } from '../data/stats'
import type { BattleState, CurrencyKey, SpecialUnlockId, StatKey } from '../types/game'

const INITIAL_STAGE = 1

function statsFromLevels(levels: Record<StatKey, number>): Record<StatKey, number> {
  return {
    atk: computeStatValue('atk', levels.atk),
    def: computeStatValue('def', levels.def),
    aspd: computeStatValue('aspd', levels.aspd),
    crit: computeStatValue('crit', levels.crit),
    critDmg: computeStatValue('critDmg', levels.critDmg),
    existGain: computeStatValue('existGain', levels.existGain),
  }
}

function battleStateForStage(stage: number): BattleState {
  const data = generateStage(stage)
  return {
    stage,
    enemyMaxHp: data.enemyHp,
    enemyHp: data.enemyHp,
    isBossStage: data.isBoss,
    kills: 0,
    killsRequired: killsRequiredForStage(stage),
  }
}

interface GameState {
  currencies: Record<CurrencyKey, number>
  statLevels: Record<StatKey, number>
  stats: Record<StatKey, number>
  currentStage: number
  battle: BattleState
  unlockedCount: number
  specialUnlocks: Record<SpecialUnlockId, boolean>

  addCurrency: (key: CurrencyKey, amount: number) => void
  spendCurrency: (key: CurrencyKey, amount: number) => boolean
  upgradeStat: (key: StatKey) => boolean
  setStage: (stage: number) => void
  setBattle: (battle: BattleState) => void
  unlockNextExistNode: (cost: number) => boolean
  unlockSpecial: (id: SpecialUnlockId) => boolean
}

const initialStatLevels: Record<StatKey, number> = {
  atk: 0,
  def: 0,
  aspd: 0,
  crit: 0,
  critDmg: 0,
  existGain: 0,
}

export const useGameStore = create<GameState>((set, get) => ({
  currencies: {
    exist: 0,
    growthEnergy: 0,
    timeEnergy: 0,
    gold: 0,
    essence: 0,
  },
  statLevels: initialStatLevels,
  stats: statsFromLevels(initialStatLevels),
  currentStage: INITIAL_STAGE,
  battle: battleStateForStage(INITIAL_STAGE),
  unlockedCount: 0,
  specialUnlocks: {
    reverse: false,
    timeHeist: false,
  },

  addCurrency: (key, amount) =>
    set((state) => ({
      currencies: { ...state.currencies, [key]: state.currencies[key] + amount },
    })),

  spendCurrency: (key, amount) => {
    if (get().currencies[key] < amount) return false
    set((state) => ({
      currencies: { ...state.currencies, [key]: state.currencies[key] - amount },
    }))
    return true
  },

  upgradeStat: (key) => {
    const level = get().statLevels[key]
    const cost = statUpgradeCost(level)
    if (!get().spendCurrency('growthEnergy', cost)) return false

    set((state) => {
      const statLevels = { ...state.statLevels, [key]: level + 1 }
      return { statLevels, stats: statsFromLevels(statLevels) }
    })
    return true
  },

  setStage: (stage) => set({ currentStage: stage }),

  setBattle: (battle) => set({ battle }),

  unlockNextExistNode: (cost) => {
    if (!get().spendCurrency('exist', cost)) return false
    set((state) => ({ unlockedCount: state.unlockedCount + 1 }))
    return true
  },

  unlockSpecial: (id) => {
    if (get().specialUnlocks[id]) return false
    const unlock = EXIST_SPECIAL_UNLOCKS.find((entry) => entry.id === id)
    if (!unlock) return false
    if (get().unlockedCount < unlock.requiredUnlockedCount) return false
    if (!get().spendCurrency('exist', unlock.cost)) return false

    set((state) => ({
      specialUnlocks: { ...state.specialUnlocks, [id]: true },
    }))
    return true
  },
}))
