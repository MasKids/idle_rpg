import { generateStage, killsRequiredForStage } from '../../data/stages'
import { useGameStore } from '../../store/gameStore'
import { calculateDamage } from './calculateDamage'

// 전투 루프는 화면(BattleArea) 마운트 여부와 무관하게 앱이 켜져 있는 동안 항상 돈다.
// setInterval 대신 매 틱마다 최신 ASPD로 다음 지연을 다시 계산하는 재귀 setTimeout을
// 써서, 별도의 재시작/구독 로직 없이도 스탯 변화가 다음 틱부터 자연스럽게 반영된다.

const MIN_INTERVAL_MS = 100

let started = false
let timeoutId: ReturnType<typeof setTimeout> | null = null
let hitCounter = 0

function tick() {
  // 한 틱에서 예기치 못한 예외가 나도(밸런스 데이터 이상 등) 재귀 setTimeout 체인
  // 자체는 절대 끊기지 않게 몸통 전체를 try/catch로 감싼다 — 안 그러면 그 순간부터
  // 전투가 영구히 멈춘 채로 새로고침 전까지 복구되지 않는다.
  try {
    const state = useGameStore.getState()
    const { amount, isCrit } = calculateDamage(state.stats)

    hitCounter += 1
    useGameStore.setState({ lastHit: { id: hitCounter, amount, isCrit } })

    const remainingHp = state.battle.enemyHp - amount

    if (remainingHp <= 0) {
      const clearedStage = generateStage(state.currentStage)
      state.addCurrency('gold', clearedStage.rewards.gold)
      state.addCurrency('growthEnergy', clearedStage.rewards.growthEnergy)
      state.addCurrency('exist', Math.floor(clearedStage.rewards.exist * state.stats.existGain))
      if (clearedStage.rewards.timeEnergy > 0) {
        state.addCurrency('timeEnergy', clearedStage.rewards.timeEnergy)
      }

      const kills = state.battle.kills + 1

      if (kills >= state.battle.killsRequired) {
        const nextStageNumber = state.currentStage + 1
        const nextStage = generateStage(nextStageNumber)
        state.setStage(nextStageNumber)
        state.setBattle({
          stage: nextStageNumber,
          enemyMaxHp: nextStage.enemyHp,
          enemyHp: nextStage.enemyHp,
          isBossStage: nextStage.isBoss,
          kills: 0,
          killsRequired: killsRequiredForStage(nextStageNumber),
        })
      } else {
        state.setBattle({ ...state.battle, enemyHp: clearedStage.enemyHp, kills })
      }
    } else {
      state.setBattle({ ...state.battle, enemyHp: remainingHp })
    }
  } catch (error) {
    console.error('[battleLoop] 틱 처리 중 오류 — 이번 틱만 건너뛰고 계속 진행합니다.', error)
  }

  const nextAspd = useGameStore.getState().stats.aspd
  const intervalMs = Math.max(MIN_INTERVAL_MS, 1000 / Math.max(0.1, nextAspd))
  timeoutId = setTimeout(tick, intervalMs)
}

export function startBattleLoop() {
  if (started) return
  started = true

  const aspd = useGameStore.getState().stats.aspd
  const intervalMs = Math.max(MIN_INTERVAL_MS, 1000 / Math.max(0.1, aspd))
  timeoutId = setTimeout(tick, intervalMs)
}

// 테스트/HMR 정리용. 일반 플레이 흐름에서는 호출하지 않는다.
export function stopBattleLoop() {
  if (timeoutId !== null) clearTimeout(timeoutId)
  timeoutId = null
  started = false
}

// 개발 중 이 파일을 수정해 HMR로 교체될 때, 옛 모듈 인스턴스의 루프를
// 정리하지 않으면 새 루프와 겹쳐 돌아 공격 속도가 두 배로 보일 수 있다.
if (import.meta.hot) {
  import.meta.hot.dispose(() => stopBattleLoop())
}
