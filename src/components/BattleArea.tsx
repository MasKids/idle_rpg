import { stageLabel } from '../data/stages'
import { computeActiveRelicEffects } from '../systems/relic/relic'
import { useGameStore } from '../store/gameStore'
import { useBattleLoop } from '../systems/battle/useBattleLoop'
import { timeHeistCooldownEndsAt, timeHeistCost } from '../systems/timeheist/timeHeist'
import type { CurrencyKey } from '../types/game'
import { formatCountdown } from '../utils/format'
import { useNow } from '../utils/useNow'
import { SYSTEM_ICON } from './icons'
import { CurrencyChip, ProgressBar } from './ui'

// HUD 재화 칩 4개(확정): 다이아 / 존재력 / 성장에너지 / 골드.
// 시간에너지는 유물 탭·타임 하이스트 모달에서만, 숙련의 정수는 성장 탭에서만 표시한다.
const CURRENCY_ORDER: CurrencyKey[] = ['diamond', 'exist', 'growthEnergy', 'gold']

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
  const { popups, enemyHp, enemyMaxHp, isBossStage, stage } = useBattleLoop()
  const hpPercent = enemyMaxHp > 0 ? Math.max(0, Math.round((enemyHp / enemyMaxHp) * 100)) : 0

  // 카운트다운 표시 갱신용. 남은 시간 자체는 항상 now와 절대시각의 차로 계산한다.
  const now = useNow()
  const cooldownReductionPercent = computeActiveRelicEffects(activeRelics).timeHeistCooldownReductionPercent
  const cooldownEndsAt = timeHeistCooldownEndsAt(timeHeistUsedCount, timeHeistLastUsedAt, cooldownReductionPercent)
  const cooldownRemainingMs = cooldownEndsAt !== null ? Math.max(0, cooldownEndsAt - now) : 0
  const isOnCooldown = cooldownRemainingMs > 0
  const canAffordTimeHeist = currencies.timeEnergy >= timeHeistCost(timeHeistUsedCount)
  const canTimeHeist = canAffordTimeHeist && !isOnCooldown
  const TimeHeistIcon = SYSTEM_ICON.timeHeist

  return (
    <div className="relative min-h-0 flex-1 bg-gradient-to-b from-blue-soft to-surface-base">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <button
          type="button"
          onClick={onStageInfoClick}
          className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-medium text-blue-strong backdrop-blur-sm transition-colors duration-150 hover:bg-black/50 active:bg-black/60"
        >
          STAGE {stageLabel(stage)}
          {isBossStage && <span className="ml-1 text-gold-strong">BOSS</span>}
        </button>

        <div className={`h-20 w-20 rounded-lg ${isBossStage ? 'bg-gold-base/70' : 'bg-danger-base/60'}`} />

        <div className="flex w-28 flex-col items-center gap-1">
          <ProgressBar
            value={enemyHp}
            max={enemyMaxHp}
            colorClassName={isBossStage ? 'bg-gold-strong' : 'bg-danger-strong'}
            className="bg-black/40"
          />
          <span className="text-[10px] font-medium tabular-nums text-text-secondary">{hpPercent}%</span>
        </div>

        {popups.map((popup) => (
          <span
            key={popup.id}
            className={`pointer-events-none absolute top-1/2 animate-[float-up_0.6s_ease-out_forwards] font-bold ${
              popup.isCrit
                ? 'text-lg text-gold-strong drop-shadow-[0_0_4px_rgba(0,0,0,0.6)]'
                : 'text-sm text-text-primary'
            }`}
            style={{ left: `${50 + ((popup.id * 37) % 40) - 20}%` }}
          >
            {popup.isCrit ? `${popup.amount}!` : popup.amount}
          </span>
        ))}
      </div>

      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-1.5 bg-gradient-to-b from-black/50 to-transparent p-2">
        <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-black/30 py-1 pl-1 pr-2 backdrop-blur-sm">
          <div className="h-6 w-6 shrink-0 rounded-full bg-blue-base/50" />
          <span className="whitespace-nowrap text-[10px] text-text-primary/80">플레이어</span>
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
