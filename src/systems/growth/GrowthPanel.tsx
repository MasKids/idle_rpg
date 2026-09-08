import { statUpgradeCost } from '../../data/stats'
import { getButtonLabel, getStatName, getTabName } from '../../data/uiStrings'
import { useGameStore } from '../../store/gameStore'
import type { StatKey } from '../../types/game'
import { formatNumber } from '../../utils/format'

const STAT_ORDER: StatKey[] = ['atk', 'def', 'aspd', 'crit', 'critDmg', 'existGain']

function formatStatValue(key: StatKey, value: number): string {
  switch (key) {
    case 'atk':
    case 'def':
      return formatNumber(Math.round(value))
    case 'aspd':
      return `${value.toFixed(2)}/초`
    case 'crit':
      return `${value.toFixed(1)}%`
    case 'critDmg':
      return `${value.toFixed(0)}%`
    case 'existGain':
      return `×${value.toFixed(2)}`
    default:
      return value.toString()
  }
}

export function GrowthPanel() {
  const statLevels = useGameStore((state) => state.statLevels)
  const stats = useGameStore((state) => state.stats)
  const growthEnergy = useGameStore((state) => state.currencies.growthEnergy)
  const upgradeStat = useGameStore((state) => state.upgradeStat)
  const maxUpgradeAll = useGameStore((state) => state.maxUpgradeAll)

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-cyan-300">{getTabName('growth')}</h2>
        <button
          type="button"
          onClick={maxUpgradeAll}
          className="rounded-lg bg-cyan-600 px-3 py-1 text-xs font-medium text-white"
        >
          {getButtonLabel('maxAll')}
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        {STAT_ORDER.map((key) => {
          const level = statLevels[key]
          const cost = statUpgradeCost(key, level)
          const canAfford = growthEnergy >= cost

          return (
            <div
              key={key}
              className="flex items-center justify-between gap-2 rounded-lg bg-black/20 px-2.5 py-1.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xs font-medium text-cyan-100">{getStatName(key)}</span>
                  <span className="text-[10px] text-cyan-100/50">Lv.{level}</span>
                </div>
                <div className="text-[11px] text-cyan-100/70">{formatStatValue(key, stats[key])}</div>
              </div>

              <button
                type="button"
                disabled={!canAfford}
                onClick={() => upgradeStat(key)}
                className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${
                  canAfford ? 'bg-cyan-600 text-white' : 'cursor-not-allowed bg-white/10 text-white/30'
                }`}
              >
                {getButtonLabel('upgrade')}
                <div className="text-[10px] opacity-80">{formatNumber(cost)}</div>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
