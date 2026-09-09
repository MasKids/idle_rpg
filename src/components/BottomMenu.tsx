import { TAB_ICON } from './icons'
import { getTabName } from '../data/uiStrings'
import type { TabKey } from '../types/game'

const MENU_KEYS: TabKey[] = ['growth', 'equipment', 'gacha', 'exist', 'dogam']

interface BottomMenuProps {
  activeTab: TabKey
  onSelect: (tab: TabKey) => void
}

export function BottomMenu({ activeTab, onSelect }: BottomMenuProps) {
  return (
    <nav className="flex shrink-0 border-t border-surface-border bg-surface-card">
      {MENU_KEYS.map((key) => {
        const isActive = key === activeTab
        const Icon = TAB_ICON[key]
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
              isActive ? 'text-teal-strong' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Icon size={20} strokeWidth={2} />
            <span>{getTabName(key)}</span>
          </button>
        )
      })}
    </nav>
  )
}
