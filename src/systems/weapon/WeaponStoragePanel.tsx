import { useState } from 'react'
import { getTabName, getWeaponUiLabel } from '../../data/uiStrings'
import { RelicTab } from '../relic/RelicTab'
import { WeaponEquipmentTab } from './WeaponEquipmentTab'
import { PanelHeader } from '../../components/ui'

type StorageSubTab = 'equipment' | 'relic'

interface WeaponStoragePanelProps {
  onBack: () => void
}

export function WeaponStoragePanel({ onBack }: WeaponStoragePanelProps) {
  const [subTab, setSubTab] = useState<StorageSubTab>('equipment')

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-surface-base text-text-primary">
      <PanelHeader
        title={getTabName('equipment')}
        onBack={onBack}
        toneClassName="text-teal-strong"
        accentColorVar="var(--color-teal-strong)"
      />

      <div className="flex shrink-0 gap-1 bg-surface-card p-2">
        <button
          type="button"
          onClick={() => setSubTab('equipment')}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            subTab === 'equipment' ? 'bg-teal-base text-white' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {getWeaponUiLabel('equipmentSubTab')}
        </button>
        <button
          type="button"
          onClick={() => setSubTab('relic')}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            subTab === 'relic' ? 'bg-teal-base text-white' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {getWeaponUiLabel('relicSubTab')}
        </button>
      </div>

      <div key={subTab} className="flex min-h-0 flex-1 flex-col animate-[panel-fade-in_180ms_ease-out]">
        {subTab === 'equipment' ? <WeaponEquipmentTab /> : <RelicTab />}
      </div>
    </div>
  )
}
