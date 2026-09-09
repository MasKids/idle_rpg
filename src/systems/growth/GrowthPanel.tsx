import { useState } from 'react'
import { MASTERY_WEAPONS, masteryMultiplier, masteryPrimaryStat, masteryUpgradeCost } from '../../data/mastery'
import { statUpgradeCost } from '../../data/stats'
import { getButtonLabel, getCurrencyName, getGrowthUiLabel, getStatName, getTabName, getWeaponUiLabel } from '../../data/uiStrings'
import { useGameStore } from '../../store/gameStore'
import type { StatKey } from '../../types/game'
import { formatNumber } from '../../utils/format'
import { parseWeaponId } from '../weapon/weapon'

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

type GrowthSubTab = 'stat' | 'mastery'

export function GrowthPanel() {
  const [subTab, setSubTab] = useState<GrowthSubTab>('stat')

  return (
    <div className="flex h-full flex-col gap-2">
      <h2 className="text-sm font-semibold text-cyan-300">{getTabName('growth')}</h2>

      <div className="flex shrink-0 gap-1 rounded-lg bg-black/20 p-1">
        <button
          type="button"
          onClick={() => setSubTab('stat')}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium ${
            subTab === 'stat' ? 'bg-cyan-600 text-white' : 'text-cyan-100/60'
          }`}
        >
          {getGrowthUiLabel('statSubTab')}
        </button>
        <button
          type="button"
          onClick={() => setSubTab('mastery')}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium ${
            subTab === 'mastery' ? 'bg-cyan-600 text-white' : 'text-cyan-100/60'
          }`}
        >
          {getGrowthUiLabel('masterySubTab')}
        </button>
      </div>

      {subTab === 'stat' ? <StatSubTab /> : <MasterySubTab />}
    </div>
  )
}

function StatSubTab() {
  const statLevels = useGameStore((state) => state.statLevels)
  const stats = useGameStore((state) => state.stats)
  const growthEnergy = useGameStore((state) => state.currencies.growthEnergy)
  const upgradeStat = useGameStore((state) => state.upgradeStat)
  const maxUpgradeAll = useGameStore((state) => state.maxUpgradeAll)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={maxUpgradeAll}
          className="rounded-lg bg-cyan-600 px-3 py-1 text-xs font-medium text-white"
        >
          {getButtonLabel('maxAll')}
        </button>
      </div>

      {STAT_ORDER.map((key) => {
        const level = statLevels[key]
        const cost = statUpgradeCost(key, level)
        const canAfford = growthEnergy >= cost

        return (
          <div key={key} className="flex items-center justify-between gap-2 rounded-lg bg-black/20 px-2.5 py-1.5">
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
  )
}

// 무기 종류별(검/창/활) 숙련. docs/WEAPON_SYSTEM.md 1.5 — 장비(무기고) 탭이 아니라
// 성장 탭에 두고, 숙련의 정수 보유량도 여기서만 보여준다. 전투에는 "현재 장착한
// 무기 종류"의 숙련만 적용되므로(gameStore.computeEffectiveStats), 그 종류를
// 강조 표시해 왜 나머지 두 종류가 대기 상태인지 보이게 한다.
function MasterySubTab() {
  const masteryLevels = useGameStore((state) => state.masteryLevels)
  const essence = useGameStore((state) => state.currencies.essence)
  const equippedWeaponId = useGameStore((state) => state.equippedWeaponId)
  const upgradeMastery = useGameStore((state) => state.upgradeMastery)
  const maxUpgradeMastery = useGameStore((state) => state.maxUpgradeMastery)

  const equippedType = equippedWeaponId ? parseWeaponId(equippedWeaponId).type : null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
      <div className="text-[11px] text-cyan-100/50">
        {getCurrencyName('essence')} {formatNumber(essence)}
      </div>

      {!equippedType && (
        <p className="rounded-lg bg-black/20 px-2.5 py-2 text-center text-[11px] text-white/40">
          {getWeaponUiLabel('noWeaponEquipped')}
        </p>
      )}

      {MASTERY_WEAPONS.map((weapon) => {
        const level = masteryLevels[weapon.id] ?? 0
        const cost = masteryUpgradeCost(weapon.id, level)
        const canAfford = essence >= cost
        const multiplier = masteryMultiplier(weapon.id, level)
        const isEquippedType = weapon.id === equippedType

        return (
          <div
            key={weapon.id}
            className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 ${
              isEquippedType ? 'border border-cyan-400/40 bg-cyan-900/30' : 'border border-transparent bg-black/20'
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs font-medium text-cyan-100">{weapon.name}</span>
                <span className="text-[10px] text-cyan-100/50">Lv.{level}</span>
                {isEquippedType && <span className="text-[10px] text-emerald-300">{getWeaponUiLabel('equipped')}</span>}
              </div>
              <div className="text-[11px] text-cyan-100/70">
                {getStatName(masteryPrimaryStat(weapon.id))} ×{multiplier.toFixed(2)}
              </div>
            </div>

            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                disabled={!canAfford}
                onClick={() => upgradeMastery(weapon.id)}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${
                  canAfford ? 'bg-cyan-600 text-white' : 'cursor-not-allowed bg-white/10 text-white/30'
                }`}
              >
                {getButtonLabel('train')}
                <div className="text-[10px] opacity-80">{formatNumber(cost)}</div>
              </button>
              <button
                type="button"
                disabled={!canAfford}
                onClick={() => maxUpgradeMastery(weapon.id)}
                className={`rounded-lg px-2 py-1.5 text-[10px] font-medium ${
                  canAfford ? 'bg-cyan-700 text-white' : 'cursor-not-allowed bg-white/10 text-white/30'
                }`}
              >
                {getButtonLabel('maxAll')}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
