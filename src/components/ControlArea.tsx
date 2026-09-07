import { GrowthPanel } from '../systems/growth/GrowthPanel'
import type { TabKey } from '../types/game'

interface ControlAreaProps {
  activeTab: TabKey
}

export function ControlArea({ activeTab }: ControlAreaProps) {
  return (
    <div className="h-[44dvh] shrink-0 overflow-y-auto bg-cyan-950/30 p-4">
      {activeTab === 'growth' && <GrowthPanel />}
      {activeTab === 'equipment' && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-cyan-300">장비</h2>
          <p className="text-xs text-cyan-100/60">장비 5부위 강화 — 준비 중</p>
        </div>
      )}
    </div>
  )
}
