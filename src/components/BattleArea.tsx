import { stageLabel } from '../data/stages'
import { useGameStore } from '../store/gameStore'
import { useBattleLoop } from '../systems/battle/useBattleLoop'
import type { CurrencyKey } from '../types/game'

const CURRENCY_LABELS: Record<CurrencyKey, string> = {
  exist: '존재력',
  growthEnergy: '성장에너지',
  timeEnergy: '시간에너지',
  gold: '골드',
  essence: '정수',
}

const CURRENCY_ORDER: CurrencyKey[] = ['exist', 'growthEnergy', 'timeEnergy', 'gold']

interface BattleAreaProps {
  onStageInfoClick: () => void
}

export function BattleArea({ onStageInfoClick }: BattleAreaProps) {
  const currencies = useGameStore((state) => state.currencies)
  const { popups, enemyHp, enemyMaxHp, isBossStage, stage } = useBattleLoop()
  const hpRatio = enemyMaxHp > 0 ? Math.max(0, enemyHp / enemyMaxHp) : 0

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

      <div className="absolute inset-x-0 top-0 flex items-start justify-between bg-gradient-to-b from-black/50 to-transparent p-3">
        <div className="flex shrink-0 items-center gap-2 rounded-full bg-black/30 px-3 py-1.5 backdrop-blur-sm">
          <div className="h-7 w-7 shrink-0 rounded-full bg-blue-500/50" />
          <span className="whitespace-nowrap text-xs text-white/80">플레이어</span>
        </div>

        <div className="flex gap-1 overflow-x-auto">
          {CURRENCY_ORDER.map((key) => (
            <div
              key={key}
              className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-black/30 px-2 py-1 backdrop-blur-sm"
            >
              <span className="text-[9px] text-white/60">{CURRENCY_LABELS[key]}</span>
              <span className="text-xs font-medium text-white">{currencies[key]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
