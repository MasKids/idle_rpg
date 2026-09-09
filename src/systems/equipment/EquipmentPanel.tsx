import { getButtonLabel, getStatName } from '../../data/uiStrings'
import { MASTERY_WEAPONS, masteryMultiplier, masteryPrimaryStat, masteryUpgradeCost } from '../../data/equipment'
import { useGameStore } from '../../store/gameStore'
import { formatNumber } from '../../utils/format'

// 5부위 장비 강화는 폐기됨 — 이 패널은 당분간 무기 숙련만 보여준다.
// 무기 시스템(종류별 숙련 재설계 포함)이 들어오면 이 패널 자체가 대체될 예정.
export function EquipmentPanel() {
  return (
    <div className="flex h-full flex-col gap-2">
      <MasteryList />
    </div>
  )
}

function MasteryList() {
  const masteryLevels = useGameStore((state) => state.masteryLevels)
  const essence = useGameStore((state) => state.currencies.essence)
  const upgradeMastery = useGameStore((state) => state.upgradeMastery)
  const maxUpgradeMastery = useGameStore((state) => state.maxUpgradeMastery)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={maxUpgradeMastery}
          className="rounded-lg bg-cyan-600 px-3 py-1 text-xs font-medium text-white"
        >
          {getButtonLabel('maxAll')}
        </button>
      </div>

      {MASTERY_WEAPONS.map((weapon) => {
        const level = masteryLevels[weapon.id] ?? 0
        const cost = masteryUpgradeCost(weapon.id, level)
        const canAfford = essence >= cost
        const multiplier = masteryMultiplier(weapon.id, level)

        return (
          <div
            key={weapon.id}
            className="flex items-center justify-between gap-2 rounded-lg bg-black/20 px-2.5 py-1.5"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs font-medium text-cyan-100">{weapon.name}</span>
                <span className="text-[10px] text-cyan-100/50">Lv.{level}</span>
              </div>
              <div className="text-[11px] text-cyan-100/70">
                {getStatName(masteryPrimaryStat(weapon.id))} ×{multiplier.toFixed(2)}
              </div>
            </div>

            <button
              type="button"
              disabled={!canAfford}
              onClick={() => upgradeMastery(weapon.id)}
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${
                canAfford ? 'bg-cyan-600 text-white' : 'cursor-not-allowed bg-white/10 text-white/30'
              }`}
            >
              {getButtonLabel('train')}
              <div className="text-[10px] opacity-80">{formatNumber(cost)}</div>
            </button>
          </div>
        )
      })}
    </div>
  )
}
