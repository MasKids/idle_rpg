import { useGameStore } from '../store/gameStore'
import type { CurrencyKey } from '../types/game'

const CURRENCY_LABELS: Record<CurrencyKey, string> = {
  exist: '존재력',
  growthEnergy: '성장에너지',
  timeEnergy: '시간에너지',
  gold: '골드',
}

const CURRENCY_ORDER: CurrencyKey[] = ['exist', 'growthEnergy', 'timeEnergy', 'gold']

export function BattleArea() {
  const currencies = useGameStore((state) => state.currencies)

  return (
    <div className="relative min-h-0 flex-1 bg-gradient-to-b from-blue-950 to-slate-900">
      <div className="absolute inset-0 flex items-center justify-center text-sm text-blue-300/40">
        전투 영역 (플레이스홀더)
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
