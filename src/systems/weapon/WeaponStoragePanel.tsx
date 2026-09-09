import { useState } from 'react'
import { getButtonLabel, getTabName, getWeaponUiLabel } from '../../data/uiStrings'
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

      {subTab === 'equipment' ? <WeaponEquipmentTab /> : <RelicSubTabPlaceholder />}
    </div>
  )
}

// 유물 하위 탭은 4단계에서 구현 — 지금은 자리만 잡아둔다.
function RelicSubTabPlaceholder() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-amber-100/70">
      <p className="text-sm font-semibold">{getWeaponUiLabel('relicSubTab')}</p>
      <p className="text-xs">설계 완료 · 프로토타입 미구현</p>
    </div>
  )
}
