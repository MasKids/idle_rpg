import { generateStage, killsRequiredForStage } from '../../data/stages'
import { applyGoldGainBonus, computeActiveRelicEffects } from '../relic/relic'
import { useGameStore } from '../../store/gameStore'
import { calculateDamage } from './calculateDamage'

// 전투 루프는 화면(BattleArea) 마운트 여부와 무관하게 앱이 켜져 있는 동안 항상 돈다.
// setInterval 대신 매 틱마다 최신 ASPD로 다음 지연을 다시 계산하는 재귀 setTimeout을
// 써서, 별도의 재시작/구독 로직 없이도 스탯 변화가 다음 틱부터 자연스럽게 반영된다.

const MIN_INTERVAL_MS = 100

let started = false
let timeoutId: ReturnType<typeof setTimeout> | null = null
let hitCounter = 0
let firstClearCounter = 0

function scheduleNextTick() {
  const aspd = useGameStore.getState().stats.aspd
  const intervalMs = Math.max(MIN_INTERVAL_MS, 1000 / Math.max(0.1, aspd))
  timeoutId = setTimeout(tick, intervalMs)
}

function tick() {
  // 한 틱에서 예기치 못한 예외가 나도(밸런스 데이터 이상 등) 재귀 setTimeout 체인
  // 자체는 절대 끊기지 않게 몸통 전체를 try/catch로 감싼다 — 안 그러면 그 순간부터
  // 전투가 영구히 멈춘 채로 새로고침 전까지 복구되지 않는다.
  try {
    const state = useGameStore.getState()

    // 직전 틱에서 처치가 확정됐는데 processKill()이 아직 못 끝난 상태(매우 드묾 —
    // 백그라운드 탭이라 setTimeout(0)이 지연되는 경우 등)면 이번 틱은 공격하지 않고
    // 넘어간다. 안 그러면 이미 죽은("HP 0") 적을 또 때려서 처치가 중복 집계된다.
    if (state.battle.enemyHp > 0) {
      const { amount, isCrit } = calculateDamage(state.stats)

      hitCounter += 1
      useGameStore.setState({ lastHit: { id: hitCounter, amount, isCrit } })

      const remainingHp = state.battle.enemyHp - amount

      if (remainingHp <= 0) {
        // 오버킬 데미지 처리 방침: 한 틱 = 공격 1회이므로, 데미지가 적 HP를 아무리
        // 크게 초과해도 그 한 번의 공격으로 여러 마리를 동시에 처치하지 않는다 —
        // 초과분은 다음 적에게 이월하지 않고 버린다(들고 있는 스탯이 아무리 강해도
        // "한 틱에 한 마리"라는 처치 카운트 규칙은 유지).
        //
        // 다만 HP를 곧바로 다음 적의 풀피로 덮어쓰지는 않는다 — 그러면 데미지가
        // 적 HP를 한 방에 넘는 경우(강한 플레이어) 체력바가 0%를 거치지 않고 계속
        // 가득 찬 것처럼 보인다(리렌더 사이에 "죽어가는" 중간 프레임이 아예 없어짐).
        // 그래서 이번 틱은 HP를 0으로 확정해 최소 한 프레임은 반드시 0%를 그리게
        // 하고, 처치 보상 지급/다음 적 등장은 다음 매크로태스크(processKill)로 미룬다.
        state.setBattle({ ...state.battle, enemyHp: 0 })
        setTimeout(processKill, 0)
      } else {
        state.setBattle({ ...state.battle, enemyHp: remainingHp })
      }
    }
  } catch (error) {
    console.error('[battleLoop] 틱 처리 중 오류 — 이번 틱만 건너뛰고 계속 진행합니다.', error)
  }

  scheduleNextTick()
}

// tick()에서 HP가 0으로 찍힌 다음 틱(0ms 뒤)에 실행 — 처치 보상 지급 + 다음 적 등장
// (또는 스테이지 진행)을 담당한다. rAF가 아니라 setTimeout(0)을 쓰는 이유: rAF는
// 백그라운드 탭에서 아예 멈추지만(방치형 게임은 탭을 오래 백그라운드에 둔다),
// setTimeout은 스로틀링될 뿐 결국은 실행되므로 처치가 무기한 안 끝나는 사고를 막는다.
function processKill() {
  try {
    const state = useGameStore.getState()
    // enemyHp가 이미 0보다 크면(방어적) 다른 경로로 이미 처리된 것 — 중복 집계 방지.
    if (state.battle.enemyHp > 0) return

    const clearedStage = generateStage(state.currentStage)
    const goldGainBonusPercent = computeActiveRelicEffects(state.activeRelics).goldGainBonusPercent
    state.addCurrency('gold', applyGoldGainBonus(clearedStage.rewards.gold, goldGainBonusPercent))
    state.addCurrency('growthEnergy', clearedStage.rewards.growthEnergy)
    state.addCurrency('exist', Math.floor(clearedStage.rewards.exist * state.stats.existGain))
    if (clearedStage.rewards.timeEnergy > 0) {
      state.addCurrency('timeEnergy', clearedStage.rewards.timeEnergy)
    }

    const kills = state.battle.kills + 1

    if (kills >= state.battle.killsRequired) {
      // 최초 클리어 판정 — rebirthMaxStage는 "지금까지 한 번이라도 있어본 가장
      // 높은 스테이지 번호"를 리버스해도 유지하며 실시간 갱신하는 기존 값이다.
      // setStage(currentStage+1)가 이 값을 currentStage+1로 갱신하기 *전*에 비교해야
      // "이 스테이지가 이미 클리어된 적 있는지"를 정확히 판정할 수 있다(리버스로
      // currentStage가 1로 되돌아가도 rebirthMaxStage는 그대로라 재클리어는 걸러진다).
      const isFirstClear = state.currentStage >= state.rebirthMaxStage
      if (isFirstClear && clearedStage.rewards.firstClearDiamond > 0) {
        state.addCurrency('diamond', clearedStage.rewards.firstClearDiamond)
        firstClearCounter += 1
        useGameStore.setState({
          lastFirstClear: {
            id: firstClearCounter,
            stage: state.currentStage,
            diamond: clearedStage.rewards.firstClearDiamond,
          },
        })
      }

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
  } catch (error) {
    console.error('[battleLoop] 처치 처리 중 오류 — 다음 틱에서 계속 진행합니다.', error)
  }
}

export function startBattleLoop() {
  if (started) return
  started = true
  scheduleNextTick()
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
