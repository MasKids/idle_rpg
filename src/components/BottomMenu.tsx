import { TAB_ICON } from './icons'
import { getBadgeLabel, getTabName } from '../data/uiStrings'
import { useTabBadges } from '../systems/onboarding/useTabBadges'
import type { TabKey } from '../types/game'

const MENU_KEYS: TabKey[] = ['growth', 'equipment', 'gacha', 'exist', 'dogam']

interface BottomMenuProps {
  activeTab: TabKey
  onSelect: (tab: TabKey) => void
}

export function BottomMenu({ activeTab, onSelect }: BottomMenuProps) {
  const badges = useTabBadges()

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
            className={`relative flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 py-2.5 text-xs transition-colors duration-150 active:bg-surface-elevated active:scale-95 ${
              isActive ? 'text-teal-strong' : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <span className="relative">
              <Icon size={20} strokeWidth={2} />
              {badges[key] && (
                <span
                  aria-label={getBadgeLabel('new')}
                  className="absolute -right-1 -top-0.5 h-2 w-2 rounded-full bg-danger-strong ring-2 ring-surface-card animate-pulse"
                />
              )}
            </span>
            <span>{getTabName(key)}</span>
          </button>
        )
      })}
    </nav>
  )
}
