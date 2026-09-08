import { getTabName } from '../data/uiStrings'
import type { TabKey } from '../types/game'

interface MenuItem {
  key: TabKey
  icon: string
}

const MENU_ITEMS: MenuItem[] = [
  { key: 'growth', icon: '📈' },
  { key: 'equipment', icon: '🗡️' },
  { key: 'gacha', icon: '🎰' },
  { key: 'exist', icon: '🌌' },
  { key: 'dogam', icon: '📖' },
]

interface BottomMenuProps {
  activeTab: TabKey
  onSelect: (tab: TabKey) => void
}

export function BottomMenu({ activeTab, onSelect }: BottomMenuProps) {
  return (
    <nav className="flex shrink-0 border-t border-white/10 bg-slate-900">
      {MENU_ITEMS.map((item) => {
        const isActive = item.key === activeTab
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.key)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
              isActive ? 'text-cyan-300' : 'text-white/50'
            }`}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            <span>{getTabName(item.key)}</span>
          </button>
        )
      })}
    </nav>
  )
}
