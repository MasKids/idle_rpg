import { useEffect, useRef, useState } from 'react'
import { generateStage } from '../../data/stages'
import { useGameStore } from '../../store/gameStore'
import { calculateDamage } from './calculateDamage'

export interface DamagePopup {
  id: number
  amount: number
  isCrit: boolean
}

const MIN_INTERVAL_MS = 100
const POPUP_LIFETIME_MS = 600

export function useBattleLoop() {
  const aspd = useGameStore((state) => state.stats.aspd)
  const enemyHp = useGameStore((state) => state.battle.enemyHp)
  const enemyMaxHp = useGameStore((state) => state.battle.enemyMaxHp)
  const isBossStage = useGameStore((state) => state.battle.isBossStage)
  const stage = useGameStore((state) => state.currentStage)

  const [popups, setPopups] = useState<DamagePopup[]>([])
  const popupIdRef = useRef(0)

  useEffect(() => {
    const intervalMs = Math.max(MIN_INTERVAL_MS, 1000 / Math.max(0.1, aspd))

    const timer = setInterval(() => {
      const state = useGameStore.getState()
      const { amount, isCrit } = calculateDamage(state.stats)

      popupIdRef.current += 1
      const id = popupIdRef.current
      setPopups((prev) => [...prev, { id, amount, isCrit }])
      setTimeout(() => {
        setPopups((prev) => prev.filter((popup) => popup.id !== id))
      }, POPUP_LIFETIME_MS)

      const remainingHp = state.battle.enemyHp - amount

      if (remainingHp <= 0) {
        const clearedStage = generateStage(state.currentStage)
        state.addCurrency('gold', clearedStage.rewards.gold)
        state.addCurrency('growthEnergy', clearedStage.rewards.growthEnergy)
        state.addCurrency('exist', clearedStage.rewards.exist)

        const nextStageNumber = state.currentStage + 1
        const nextStage = generateStage(nextStageNumber)
        state.setStage(nextStageNumber)
        state.setBattle({
          stage: nextStageNumber,
          enemyMaxHp: nextStage.enemyHp,
          enemyHp: nextStage.enemyHp,
          isBossStage: nextStage.isBoss,
        })
      } else {
        state.setBattle({ ...state.battle, enemyHp: remainingHp })
      }
    }, intervalMs)

    return () => clearInterval(timer)
  }, [aspd])

  return { popups, enemyHp, enemyMaxHp, isBossStage, stage }
}
