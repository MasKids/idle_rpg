import { useState } from 'react'
import {
  EQUIPMENT_SLOTS,
  equipmentUpgradeCost,
  equipmentValuePerLevel,
  MASTERY_WEAPONS,
  masteryAtkMultiplier,
  masteryUpgradeCost,
} from '../../data/equipment'
import { useGameStore } from '../../store/gameStore'
import { formatNumber } from '../../utils/format'

type EquipmentSubTab = 'equipment' | 'mastery'

const STAT_LABEL: Record<'atk' | 'def', string> = { atk: '공격력', def: '방어력' }

export function EquipmentPanel() {
  const [subTab, setSubTab] = useState<EquipmentSubTab>('equipment')

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex gap-1 rounded-lg bg-black/20 p-1">
        <button
          type="button"
          onClick={() => setSubTab('equipment')}
          className={`flex-1 rounded-md px-3 py-1 text-xs font-medium ${
            subTab === 'equipment' ? 'bg-cyan-600 text-white' : 'text-cyan-100/60'
          }`}
        >
          장비
        </button>
        <button
          type="button"
          onClick={() => setSubTab('mastery')}
          className={`flex-1 rounded-md px-3 py-1 text-xs font-medium ${
            subTab === 'mastery' ? 'bg-cyan-600 text-white' : 'text-cyan-100/60'
          }`}
        >
          숙련
        </button>
      </div>

      {subTab === 'equipment' ? <EquipmentSlotsList /> : <MasteryList />}
    </div>
  )
}

function EquipmentSlotsList() {
  const equipmentLevels = useGameStore((state) => state.equipmentLevels)
  const gold = useGameStore((state) => state.currencies.gold)
  const upgradeEquipment = useGameStore((state) => state.upgradeEquipment)
  const maxUpgradeEquipment = useGameStore((state) => state.maxUpgradeEquipment)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={maxUpgradeEquipment}
          className="rounded-lg bg-cyan-600 px-3 py-1 text-xs font-medium text-white"
        >
          최대로
        </button>
      </div>

      {EQUIPMENT_SLOTS.map((slot) => {
        const level = equipmentLevels[slot.id]
        const cost = equipmentUpgradeCost(slot.id, level)
        const canAfford = gold >= cost
        const bonus = level * equipmentValuePerLevel(slot.id)

        return (
          <div
            key={slot.id}
            className="flex items-center justify-between gap-2 rounded-lg bg-black/20 px-2.5 py-1.5"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs font-medium text-cyan-100">{slot.label}</span>
                <span className="text-[10px] text-cyan-100/50">Lv.{level}</span>
              </div>
              <div className="text-[11px] text-cyan-100/70">
                {STAT_LABEL[slot.stat]} +{formatNumber(bonus)}
              </div>
            </div>

            <button
              type="button"
              disabled={!canAfford}
              onClick={() => upgradeEquipment(slot.id)}
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${
                canAfford ? 'bg-cyan-600 text-white' : 'cursor-not-allowed bg-white/10 text-white/30'
              }`}
            >
              강화
              <div className="text-[10px] opacity-80">{formatNumber(cost)}</div>
            </button>
          </div>
        )
      })}
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
          최대로
        </button>
      </div>

      {MASTERY_WEAPONS.map((weapon) => {
        const level = masteryLevels[weapon.id] ?? 0
        const cost = masteryUpgradeCost(weapon.id, level)
        const canAfford = essence >= cost
        const multiplier = masteryAtkMultiplier(weapon.id, level)

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
              <div className="text-[11px] text-cyan-100/70">공격력 ×{multiplier.toFixed(2)}</div>
            </div>

            <button
              type="button"
              disabled={!canAfford}
              onClick={() => upgradeMastery(weapon.id)}
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${
                canAfford ? 'bg-cyan-600 text-white' : 'cursor-not-allowed bg-white/10 text-white/30'
              }`}
            >
              수련
              <div className="text-[10px] opacity-80">{formatNumber(cost)}</div>
            </button>
          </div>
        )
      })}
    </div>
  )
}
