import { useEffect, useRef, useState } from 'react'
import { stageLabel } from '../data/stages'
import { getBattleUiLabel } from '../data/uiStrings'
import { computeActiveRelicEffects } from '../systems/relic/relic'
import { useGameStore } from '../store/gameStore'
import { useBattleLoop } from '../systems/battle/useBattleLoop'
import { timeHeistCooldownEndsAt, timeHeistCost } from '../systems/timeheist/timeHeist'
import type { CurrencyKey } from '../types/game'
import { formatCountdown } from '../utils/format'
import { useNow } from '../utils/useNow'
import { usePageVisible } from '../utils/usePageVisible'
import { SYSTEM_ICON } from './icons'
import { CurrencyChip, ProgressBar } from './ui'

// HUD 재화 칩 4개(확정): 다이아 / 존재력 / 성장에너지 / 골드.
// 시간에너지는 유물 탭·타임 하이스트 모달에서만, 숙련의 정수는 성장 탭에서만 표시한다.
const CURRENCY_ORDER: CurrencyKey[] = ['diamond', 'exist', 'growthEnergy', 'gold']

// 배경 장식용 파티클 — 매 렌더 새로 뽑으면 애니메이션이 계속 리셋되어 보이므로
// 모듈 스코프에서 한 번만 계산해 고정한다. 속도/크기/지연을 서로 다르게 줘서
// 기계적으로 반복되는 느낌을 줄인다.
const PARTICLES = Array.from({ length: 8 }, (_, i) => ({
  left: 8 + ((i * 37) % 84),
  size: 2 + (i % 3),
  duration: 9 + (i % 5) * 2.4,
  delay: -(i * 1.8),
}))

// 시계 눈금 12개의 좌표도 고정값이라 모듈 스코프에서 한 번만 계산한다.
const CLOCK_TICKS = Array.from({ length: 12 }, (_, i) => {
  const angle = (i * 30 * Math.PI) / 180
  return {
    x1: 210 + 195 * Math.cos(angle),
    y1: 210 + 195 * Math.sin(angle),
    x2: 210 + 208 * Math.cos(angle),
    y2: 210 + 208 * Math.sin(angle),
  }
})

interface BattleAreaProps {
  onStageInfoClick: () => void
  onTimeHeistClick: () => void
}

export function BattleArea({ onStageInfoClick, onTimeHeistClick }: BattleAreaProps) {
  const currencies = useGameStore((state) => state.currencies)
  const timeHeistUnlocked = useGameStore((state) => state.specialUnlocks.timeHeist)
  const timeHeistUsedCount = useGameStore((state) => state.timeHeistUsedCount)
  const timeHeistLastUsedAt = useGameStore((state) => state.timeHeistLastUsedAt)
  const activeRelics = useGameStore((state) => state.activeRelics)
  const { popups, enemyHp, enemyMaxHp, isBossStage, stage, lastHitId } = useBattleLoop()
  const hpPercent = enemyMaxHp > 0 ? Math.max(0, Math.round((enemyHp / enemyMaxHp) * 100)) : 0
  const isPageVisible = usePageVisible()
  const decorClassName = `decor-motion${isPageVisible ? '' : ' decor-paused'}`

  // 카운트다운 표시 갱신용. 남은 시간 자체는 항상 now와 절대시각의 차로 계산한다.
  const now = useNow()
  const cooldownReductionPercent = computeActiveRelicEffects(activeRelics).timeHeistCooldownReductionPercent
  const cooldownEndsAt = timeHeistCooldownEndsAt(timeHeistUsedCount, timeHeistLastUsedAt, cooldownReductionPercent)
  const cooldownRemainingMs = cooldownEndsAt !== null ? Math.max(0, cooldownEndsAt - now) : 0
  const isOnCooldown = cooldownRemainingMs > 0
  const canAffordTimeHeist = currencies.timeEnergy >= timeHeistCost(timeHeistUsedCount)
  const canTimeHeist = canAffordTimeHeist && !isOnCooldown
  const TimeHeistIcon = SYSTEM_ICON.timeHeist

  // 다음 적 등장 감지 — 데미지로는 hp가 줄어들기만 하므로, hp가 "늘어났다"는 건
  // 곧 리스폰(같은 스테이지 반복이든 다음 스테이지 진입이든)뿐이다. 그 순간에
  // 이전 적은 짧게 사라지는 연출(ghost)을 남기고, 새 적은 key를 바꿔 등장 연출을 튼다.
  const prevHpRef = useRef(enemyHp)
  const prevIsBossRef = useRef(isBossStage)
  const genKeyRef = useRef(0)
  const [genKey, setGenKey] = useState(0)
  const [ghosts, setGhosts] = useState<{ key: number; isBoss: boolean }[]>([])

  useEffect(() => {
    if (enemyHp > prevHpRef.current) {
      const ghostKey = genKeyRef.current
      setGhosts((prev) => [...prev.slice(-2), { key: ghostKey, isBoss: prevIsBossRef.current }])
      setTimeout(() => {
        setGhosts((prev) => prev.filter((ghost) => ghost.key !== ghostKey))
      }, 320)
      genKeyRef.current += 1
      setGenKey(genKeyRef.current)
    }
    prevHpRef.current = enemyHp
    prevIsBossRef.current = isBossStage
  }, [enemyHp, isBossStage])

  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-gradient-to-b from-blue-soft to-surface-base">
      {/* 배경 레이어 1: 흐린 시계 눈금 — 거의 안 보이는 수준으로 아주 천천히 회전 */}
      <div
        className={`pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 ${decorClassName}`}
        style={{ animation: 'spin-slow 60s linear infinite', opacity: 0.045 }}
      >
        <svg viewBox="0 0 420 420" className="h-full w-full">
          <circle cx="210" cy="210" r="200" fill="none" stroke="var(--color-text-secondary)" strokeWidth="1" />
          <circle cx="210" cy="210" r="150" fill="none" stroke="var(--color-text-secondary)" strokeWidth="1" />
          <circle cx="210" cy="210" r="100" fill="none" stroke="var(--color-text-secondary)" strokeWidth="1" />
          {CLOCK_TICKS.map((tick, index) => (
            <line
              key={index}
              x1={tick.x1}
              y1={tick.y1}
              x2={tick.x2}
              y2={tick.y2}
              stroke="var(--color-text-secondary)"
              strokeWidth="2"
            />
          ))}
        </svg>
      </div>

      {/* 배경 레이어 2: 위로 떠오르는 파티클 */}
      <div className={`pointer-events-none absolute inset-0 overflow-hidden ${decorClassName}`}>
        {PARTICLES.map((particle, index) => (
          <span
            key={index}
            className="absolute bottom-0 rounded-full bg-text-secondary/25"
            style={{
              left: `${particle.left}%`,
              width: particle.size,
              height: particle.size,
              animation: `particle-rise ${particle.duration}s linear infinite`,
              animationDelay: `${particle.delay}s`,
            }}
          />
        ))}
      </div>

      {/* 배경 레이어 3: 적 뒤 스포트라이트 (surface-elevated 명도차만 이용) */}
      <div
        className="pointer-events-none absolute left-1/2 top-[42%] h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle, var(--color-surface-elevated) 0%, transparent 72%)' }}
      />

      {/* 배경 레이어 4: 원근감 있는 지면 — 소실점으로 수렴하는 사다리꼴 + 격자선 */}
      <svg
        className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full"
        viewBox="0 0 400 100"
        preserveAspectRatio="none"
      >
        <polygon points="130,0 270,0 400,100 0,100" fill="var(--color-surface-elevated)" opacity="0.35" />
        <line x1="130" y1="0" x2="0" y2="100" stroke="var(--color-surface-border)" strokeWidth="1" />
        <line x1="200" y1="0" x2="200" y2="100" stroke="var(--color-surface-border)" strokeWidth="1" />
        <line x1="270" y1="0" x2="400" y2="100" stroke="var(--color-surface-border)" strokeWidth="1" />
        <line x1="20" y1="62" x2="380" y2="62" stroke="var(--color-surface-border)" strokeWidth="1" opacity="0.6" />
      </svg>

      {/* 배경 레이어 5: 비네트 — 검정 알파만 사용 */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 50% 45%, transparent 45%, rgba(0,0,0,0.55) 100%)' }}
      />

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
        <button
          type="button"
          onClick={onStageInfoClick}
          className="rounded-full border border-white/10 bg-black/30 px-4 py-1.5 text-sm font-medium text-blue-strong backdrop-blur-sm transition-colors duration-150 hover:bg-black/50 active:bg-black/60"
        >
          STAGE {stageLabel(stage)}
          {isBossStage && <span className="ml-1 text-gold-strong">BOSS</span>}
        </button>

        <div className="relative flex h-36 w-36 items-center justify-center">
          {ghosts.map((ghost) => (
            <div
              key={ghost.key}
              className={`pointer-events-none absolute rounded-lg animate-[enemy-defeat_300ms_ease-in_forwards] ${
                ghost.isBoss ? 'h-36 w-36 bg-gold-base/70' : 'h-28 w-28 bg-danger-base/60'
              }`}
            />
          ))}

          <div
            key={genKey}
            className={
              isBossStage
                ? 'h-36 w-36 rounded-lg animate-[boss-appear_450ms_ease-out]'
                : 'h-28 w-28 rounded-lg animate-[enemy-appear_250ms_ease-out]'
            }
          >
            <div
              key={lastHitId ?? 'idle'}
              className={`h-full w-full rounded-lg ${isBossStage ? 'bg-gold-base/70' : 'bg-danger-base/60'}`}
              style={lastHitId !== null ? { animation: 'hit-shake 100ms ease-out' } : undefined}
            />
          </div>
        </div>

        <div className="flex w-36 flex-col items-center gap-1">
          <ProgressBar
            value={enemyHp}
            max={enemyMaxHp}
            colorClassName={isBossStage ? 'bg-gold-strong' : 'bg-danger-strong'}
            trailColorClassName={isBossStage ? 'bg-gold-strong/35' : 'bg-danger-strong/35'}
            thick={isBossStage}
            segments={isBossStage ? 5 : undefined}
            className="bg-black/40"
          />
          <span className="text-xs font-medium tabular-nums text-text-secondary">{hpPercent}%</span>
        </div>

        {popups.map((popup) => {
          const left = 50 + ((popup.id * 37) % 44) - 22
          const topJitter = (popup.id * 13) % 20 - 10
          return (
            <span
              key={popup.id}
              className={`pointer-events-none absolute top-1/2 font-bold ${
                popup.isCrit
                  ? 'text-lg text-gold-strong drop-shadow-[0_0_4px_rgba(0,0,0,0.6)]'
                  : 'text-sm text-text-primary'
              }`}
              style={{
                left: `${left}%`,
                top: `calc(50% + ${topJitter}px)`,
                animation: popup.isCrit
                  ? 'float-up 700ms ease-out forwards, crit-pop 400ms ease-out'
                  : 'float-up 700ms ease-out forwards',
              }}
            >
              {popup.isCrit ? `${popup.amount}!` : popup.amount}
            </span>
          )
        })}
      </div>

      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-1.5 bg-gradient-to-b from-black/50 to-transparent p-2">
        <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-black/30 py-1 pl-1 pr-2 backdrop-blur-sm">
          <div className="h-6 w-6 shrink-0 rounded-full bg-blue-base/50" />
          <span className="whitespace-nowrap text-[10px] text-text-primary/80">{getBattleUiLabel('playerName')}</span>
        </div>

        <div className="flex flex-1 justify-end gap-1">
          {CURRENCY_ORDER.map((key) => (
            <CurrencyChip key={key} currency={key} amount={currencies[key]} className="shrink-0 px-1.5 py-1" />
          ))}
        </div>
      </div>

      {timeHeistUnlocked && (
        <button
          type="button"
          onClick={onTimeHeistClick}
          aria-disabled={!canTimeHeist}
          className={`absolute bottom-3 right-3 flex h-14 w-14 flex-col items-center justify-center rounded-full border-2 shadow-lg transition-all duration-150 hover:brightness-110 active:scale-95 ${
            canTimeHeist ? 'border-gold-strong bg-gold-base' : 'border-gold-strong/30 bg-gold-soft text-text-disabled'
          }`}
        >
          {isOnCooldown ? (
            <span className="text-[9px] font-semibold leading-none tabular-nums">
              {formatCountdown(cooldownRemainingMs)}
            </span>
          ) : (
            <TimeHeistIcon size={22} strokeWidth={2} />
          )}
        </button>
      )}
    </div>
  )
}
