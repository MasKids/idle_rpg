import { stageLabel } from '../data/stages'
import { useGameStore } from '../store/gameStore'
import { useBattleLoop } from '../systems/battle/useBattleLoop'
import { timeHeistCooldownEndsAt, timeHeistCost } from '../systems/timeheist/timeHeist'
import type { CurrencyKey } from '../types/game'
import { formatCountdown, formatNumber } from '../utils/format'
import { useNow } from '../utils/useNow'

const CURRENCY_ICON: Record<CurrencyKey, string> = {
  exist: '🌌',
  growthEnergy: '📈',
  timeEnergy: '⏳',
  gold: '🪙',
  essence: '💠',
  diamond: '💎',
}

const CURRENCY_ORDER: CurrencyKey[] = ['exist', 'growthEnergy', 'timeEnergy', 'gold', 'essence']

interface BattleAreaProps {
  onStageInfoClick: () => void
  onTimeHeistClick: () => void
}

export function BattleArea({ onStageInfoClick, onTimeHeistClick }: BattleAreaProps) {
  const currencies = useGameStore((state) => state.currencies)
  const timeHeistUnlocked = useGameStore((state) => state.specialUnlocks.timeHeist)
  const timeHeistUsedCount = useGameStore((state) => state.timeHeistUsedCount)
  const timeHeistLastUsedAt = useGameStore((state) => state.timeHeistLastUsedAt)
  const { popups, enemyHp, enemyMaxHp, isBossStage, stage } = useBattleLoop()
  const hpRatio = enemyMaxHp > 0 ? Math.max(0, enemyHp / enemyMaxHp) : 0

  // 카운트다운 표시 갱신용. 남은 시간 자체는 항상 now와 절대시각의 차로 계산한다.
  const now = useNow()
  const cooldownEndsAt = timeHeistCooldownEndsAt(timeHeistUsedCount, timeHeistLastUsedAt)
  const cooldownRemainingMs = cooldownEndsAt !== null ? Math.max(0, cooldownEndsAt - now) : 0
  const isOnCooldown = cooldownRemainingMs > 0
  const canAffordTimeHeist = currencies.timeEnergy >= timeHeistCost(timeHeistUsedCount)
  const canTimeHeist = canAffordTimeHeist && !isOnCooldown

  return (
    <div className="relative min-h-0 flex-1 bg-gradient-to-b from-blue-950 to-slate-900">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <button
          type="button"
          onClick={onStageInfoClick}
          className="rounded-full bg-black/30 px-3 py-1 text-xs text-blue-300 backdrop-blur-sm"
        >
          STAGE {stageLabel(stage)}
          {isBossStage && <span className="ml-1 text-amber-400">BOSS</span>}
        </button>

        <div
          className={`h-20 w-20 rounded-lg ${isBossStage ? 'bg-amber-600/70' : 'bg-red-500/60'}`}
        />

        <div className="h-2 w-40 overflow-hidden rounded-full bg-black/40">
          <div
            className={`h-full rounded-full transition-[width] duration-150 ${isBossStage ? 'bg-amber-400' : 'bg-red-400'}`}
            style={{ width: `${hpRatio * 100}%` }}
          />
        </div>

        {popups.map((popup) => (
          <span
            key={popup.id}
            className={`pointer-events-none absolute top-1/2 animate-[float-up_0.6s_ease-out_forwards] text-sm font-bold ${
              popup.isCrit ? 'text-amber-300' : 'text-white'
            }`}
            style={{ left: `${50 + ((popup.id * 37) % 40) - 20}%` }}
          >
            {popup.isCrit ? `${popup.amount}!` : popup.amount}
          </span>
        ))}
      </div>

      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-1.5 bg-gradient-to-b from-black/50 to-transparent p-2">
        <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-black/30 py-1 pl-1 pr-2 backdrop-blur-sm">
          <div className="h-6 w-6 shrink-0 rounded-full bg-blue-500/50" />
          <span className="whitespace-nowrap text-[10px] text-white/80">플레이어</span>
        </div>

        <div className="flex flex-1 justify-end gap-1">
          {CURRENCY_ORDER.map((key) => (
            <div
              key={key}
              className="flex min-w-[42px] shrink-0 items-center justify-center gap-0.5 whitespace-nowrap rounded-full bg-black/30 px-1.5 py-1 backdrop-blur-sm"
            >
              <span className="text-[10px] leading-none">{CURRENCY_ICON[key]}</span>
              <span className="text-[10px] font-medium leading-none text-white">{formatNumber(currencies[key])}</span>
            </div>
          ))}
        </div>
      </div>

      {timeHeistUnlocked && (
        <button
          type="button"
          onClick={onTimeHeistClick}
          aria-disabled={!canTimeHeist}
          className={`absolute bottom-3 right-3 flex h-14 w-14 flex-col items-center justify-center rounded-full border-2 shadow-lg ${
            canTimeHeist ? 'border-amber-300 bg-amber-500' : 'border-amber-300/30 bg-amber-900/50 text-white/30'
          }`}
        >
          {isOnCooldown ? (
            <span className="text-[9px] font-semibold leading-none tabular-nums">
              {formatCountdown(cooldownRemainingMs)}
            </span>
          ) : (
            <span className="text-lg leading-none">⏳</span>
          )}
        </button>
      )}
    </div>
  )
}
