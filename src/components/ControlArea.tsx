import { GrowthPanel } from '../systems/growth/GrowthPanel'
import type { TabKey } from '../types/game'

interface ControlAreaProps {
  activeTab: TabKey
}

export function ControlArea({ activeTab }: ControlAreaProps) {
  return (
    <div className="h-[44dvh] shrink-0 overflow-y-auto bg-cyan-950/30 p-4">
      {activeTab === 'growth' && <GrowthPanel />}
    </div>
  )
}
