import { create } from 'zustand'
import type { CurrencyKey, StatKey } from '../types/game'

interface GameState {
  currencies: Record<CurrencyKey, number>
  stats: Record<StatKey, number>
  currentStage: number
  unlockedExistNodes: string[]
  addCurrency: (key: CurrencyKey, amount: number) => void
  spendCurrency: (key: CurrencyKey, amount: number) => boolean
  setStat: (key: StatKey, value: number) => void
  setStage: (stage: number) => void
  unlockExistNode: (nodeId: string) => void
}

export const useGameStore = create<GameState>((set, get) => ({
  currencies: {
    exist: 0,
    growthEnergy: 0,
    timeEnergy: 0,
    gold: 0,
  },
  stats: {
    atk: 1,
    def: 1,
    aspd: 1,
    crit: 0,
    critDmg: 150,
    existGain: 1,
  },
  currentStage: 1,
  unlockedExistNodes: [],

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

  setStat: (key, value) =>
    set((state) => ({ stats: { ...state.stats, [key]: value } })),

  setStage: (stage) => set({ currentStage: stage }),

  unlockExistNode: (nodeId) =>
    set((state) =>
      state.unlockedExistNodes.includes(nodeId)
        ? state
        : { unlockedExistNodes: [...state.unlockedExistNodes, nodeId] },
    ),
}))
