import { useState } from 'react'
import { MASTERY_WEAPONS, masteryBonusPercent, masteryPrimaryStat, masteryUpgradeCost } from '../../data/mastery'
import { statUpgradeCost } from '../../data/stats'
import { getButtonLabel, getCurrencyName, getGrowthUiLabel, getStatName, getTabName, getWeaponUiLabel } from '../../data/uiStrings'
import { useGameStore } from '../../store/gameStore'
import type { StatKey } from '../../types/game'
import { formatNumber, formatPercent } from '../../utils/format'
import { parseWeaponId } from '../weapon/weapon'
import { Button, CostLabel } from '../../components/ui'

const STAT_ORDER: StatKey[] = ['atk', 'aspd', 'crit', 'critDmg', 'existGain']

function formatStatValue(key: StatKey, value: number): string {
  switch (key) {
    case 'atk':
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
      <h2 className="text-sm font-semibold text-text-primary">{getTabName('growth')}</h2>

      <div className="flex shrink-0 gap-1 rounded-lg bg-surface-card p-1">
        <button
          type="button"
          onClick={() => setSubTab('stat')}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            subTab === 'stat' ? 'bg-blue-base text-white' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {getGrowthUiLabel('statSubTab')}
        </button>
        <button
          type="button"
          onClick={() => setSubTab('mastery')}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            subTab === 'mastery' ? 'bg-blue-base text-white' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {getGrowthUiLabel('masterySubTab')}
        </button>
      </div>

      <div key={subTab} className="flex min-h-0 flex-1 flex-col animate-[panel-fade-in_180ms_ease-out]">
        {subTab === 'stat' ? <StatSubTab /> : <MasterySubTab />}
      </div>
    </div>
  )
}

function StatSubTab() {
  const statLevels = useGameStore((state) => state.statLevels)
  const stats = useGameStore((state) => state.stats)
  const growthEnergy = useGameStore((state) => state.currencies.growthEnergy)
  const upgradeStat = useGameStore((state) => state.upgradeStat)
  const maxUpgradeAll = useGameStore((state) => state.maxUpgradeAll)
  const autoUpgradeStats = useGameStore((state) => state.autoUpgradeStats)
  const setAutoUpgradeStats = useGameStore((state) => state.setAutoUpgradeStats)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setAutoUpgradeStats(!autoUpgradeStats)}
          className="flex items-center gap-1.5"
        >
          <span
            className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
              autoUpgradeStats ? 'bg-blue-base' : 'bg-surface-card'
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                autoUpgradeStats ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </span>
          <span className="text-[11px] font-medium text-text-secondary">{getGrowthUiLabel('autoUpgrade')}</span>
        </button>

        <Button variant="secondary" onClick={maxUpgradeAll}>
          {getButtonLabel('maxAll')}
        </Button>
      </div>

      {STAT_ORDER.map((key) => {
        const level = statLevels[key]
        const cost = statUpgradeCost(key, level)
        const canAfford = growthEnergy >= cost

        return (
          <div key={key} className="flex items-center justify-between gap-2 rounded-lg bg-surface-card px-2.5 py-1.5">
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs font-medium text-text-primary">{getStatName(key)}</span>
                <span className="text-[10px] text-text-secondary">Lv.{level}</span>
              </div>
              <div className="text-[11px] text-text-secondary">{formatStatValue(key, stats[key])}</div>
            </div>

            <Button variant="primary" disabled={!canAfford} onClick={() => upgradeStat(key)} className="shrink-0">
              <span className="flex flex-col items-center leading-tight">
                <span className="text-[11px]">{getButtonLabel('upgrade')}</span>
                <CostLabel currency="growthEnergy" amount={cost} affordable={canAfford} />
              </span>
            </Button>
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
      <div className="text-[11px] text-text-secondary">
        {getCurrencyName('essence')} {formatNumber(essence)}
      </div>

      {!equippedType && (
        <p className="rounded-lg bg-surface-card px-2.5 py-2 text-center text-[11px] text-text-disabled">
          {getWeaponUiLabel('noWeaponEquipped')}
        </p>
      )}

      {MASTERY_WEAPONS.map((weapon) => {
        const level = masteryLevels[weapon.id] ?? 0
        const cost = masteryUpgradeCost(weapon.id, level)
        const canAfford = essence >= cost
        const bonusPercent = masteryBonusPercent(weapon.id, level)
        const isEquippedType = weapon.id === equippedType

        return (
          <div
            key={weapon.id}
            className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 ${
              isEquippedType ? 'border border-blue-strong/40 bg-blue-soft' : 'border border-transparent bg-surface-card'
            }`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs font-medium text-text-primary">{weapon.name}</span>
                <span className="text-[10px] text-text-secondary">Lv.{level}</span>
                {isEquippedType && <span className="text-[10px] text-success-strong">{getWeaponUiLabel('equipped')}</span>}
              </div>
              <div className="text-[11px] text-text-secondary">
                {getStatName(masteryPrimaryStat(weapon.id))} +{formatPercent(bonusPercent)}
              </div>
            </div>

            <div className="flex shrink-0 gap-1">
              <Button variant="primary" disabled={!canAfford} onClick={() => upgradeMastery(weapon.id)}>
                <span className="flex flex-col items-center leading-tight">
                  <span className="text-[11px]">{getButtonLabel('train')}</span>
                  <CostLabel currency="essence" amount={cost} affordable={canAfford} />
                </span>
              </Button>
              <Button variant="secondary" disabled={!canAfford} onClick={() => maxUpgradeMastery(weapon.id)}>
                {getButtonLabel('maxAll')}
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
