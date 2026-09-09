import { useState } from 'react'
import { getGachaUiLabel, getTabName } from '../../data/uiStrings'
import { PanelHeader } from '../../components/ui'
import { WeaponGachaTab } from './WeaponGachaTab'
import { RelicGachaTab } from './RelicGachaTab'

type SummonSubTab = 'weapon' | 'relic'

interface SummonPanelProps {
  onBack: () => void
}

// 무기고가 [장비]/[유물]로 나뉘듯, 소환도 [무기]/[유물]로 나눈다 — 무기 뽑기와
// 유물 뽑기 둘 다 "재화를 써서 새 걸 뽑는다"는 같은 성격이라 한 화면에 모았다.
// (보관/관리는 무기고, 뽑기는 소환 — 역할이 분리된다)
export function SummonPanel({ onBack }: SummonPanelProps) {
  const [subTab, setSubTab] = useState<SummonSubTab>('weapon')

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-surface-base text-text-primary">
      <PanelHeader title={getTabName('gacha')} onBack={onBack} toneClassName="text-gold-strong" />

      <div className="flex shrink-0 gap-1 bg-surface-card p-2">
        <button
          type="button"
          onClick={() => setSubTab('weapon')}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            subTab === 'weapon' ? 'bg-gold-base text-surface-base' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {getGachaUiLabel('weaponSubTab')}
        </button>
        <button
          type="button"
          onClick={() => setSubTab('relic')}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            subTab === 'relic' ? 'bg-gold-base text-surface-base' : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {getGachaUiLabel('relicSubTab')}
        </button>
      </div>

      {subTab === 'weapon' ? <WeaponGachaTab /> : <RelicGachaTab />}
    </div>
  )
}
