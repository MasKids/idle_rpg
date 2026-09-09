import { useState } from 'react'
import { getButtonLabel, getTabName, getWeaponUiLabel } from '../../data/uiStrings'
import { RelicTab } from '../relic/RelicTab'
import { WeaponEquipmentTab } from './WeaponEquipmentTab'

type StorageSubTab = 'equipment' | 'relic'

interface WeaponStoragePanelProps {
  onBack: () => void
}

export function WeaponStoragePanel({ onBack }: WeaponStoragePanelProps) {
  const [subTab, setSubTab] = useState<StorageSubTab>('equipment')

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-slate-950 text-white">
      <div className="relative flex shrink-0 items-center justify-center border-b border-white/10 py-3">
        <button type="button" onClick={onBack} className="absolute left-4 text-sm text-cyan-300">
          ← {getButtonLabel('back')}
        </button>
        <div className="text-sm font-semibold text-cyan-200">{getTabName('equipment')}</div>
      </div>

      <div className="flex shrink-0 gap-1 bg-black/20 p-2">
        <button
          type="button"
          onClick={() => setSubTab('equipment')}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium ${
            subTab === 'equipment' ? 'bg-cyan-600 text-white' : 'text-cyan-100/60'
          }`}
        >
          {getWeaponUiLabel('equipmentSubTab')}
        </button>
        <button
          type="button"
          onClick={() => setSubTab('relic')}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium ${
            subTab === 'relic' ? 'bg-cyan-600 text-white' : 'text-cyan-100/60'
          }`}
        >
          {getWeaponUiLabel('relicSubTab')}
        </button>
      </div>

      {subTab === 'equipment' ? <WeaponEquipmentTab /> : <RelicTab />}
    </div>
  )
}
