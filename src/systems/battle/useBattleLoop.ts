import { useEffect, useRef, useState } from 'react'
import { useGameStore } from '../../store/gameStore'

export interface DamagePopup {
  id: number
  amount: number
  isCrit: boolean
}

const POPUP_LIFETIME_MS = 700
// ASPD가 아주 높아져도 동시에 떠 있는 데미지 숫자 DOM을 이 개수로 제한한다.
const MAX_VISIBLE_POPUPS = 12

// 전투 시뮬레이션 자체는 systems/battle/battleLoop.ts가 store 레벨에서
// 항상 돌린다. 이 훅은 화면이 떠 있는 동안 최신 상태를 구독하고,
// 매 타격(lastHit)을 데미지 팝업 애니메이션으로 변환하는 뷰 레이어일 뿐이다.
export function useBattleLoop() {
  const enemyHp = useGameStore((state) => state.battle.enemyHp)
  const enemyMaxHp = useGameStore((state) => state.battle.enemyMaxHp)
  const isBossStage = useGameStore((state) => state.battle.isBossStage)
  const kills = useGameStore((state) => state.battle.kills)
  const killsRequired = useGameStore((state) => state.battle.killsRequired)
  const stage = useGameStore((state) => state.currentStage)
  const lastHit = useGameStore((state) => state.lastHit)

  const [popups, setPopups] = useState<DamagePopup[]>([])
  const lastHitId = useRef<number | null>(null)

  useEffect(() => {
    if (!lastHit || lastHit.id === lastHitId.current) return
    lastHitId.current = lastHit.id

    const id = lastHit.id
    setPopups((prev) => [...prev.slice(-(MAX_VISIBLE_POPUPS - 1)), { id, amount: lastHit.amount, isCrit: lastHit.isCrit }])
    setTimeout(() => {
      setPopups((prev) => prev.filter((popup) => popup.id !== id))
    }, POPUP_LIFETIME_MS)
  }, [lastHit])

  return { popups, enemyHp, enemyMaxHp, isBossStage, kills, killsRequired, stage, lastHitId: lastHit?.id ?? null }
}
