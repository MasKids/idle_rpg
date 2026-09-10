import type { CSSProperties } from 'react'
import { getRelicConfig, getString } from '../../data/balance'
import { getButtonLabel, getCommonUiLabel, getRelicUiLabel, getStateLabel, getWeaponUiLabel } from '../../data/uiStrings'
import { useGameStore } from '../../store/gameStore'
import { GRADE_TEXT_COLOR } from '../weapon/weaponUi'
import { computeRelicSlotCount, relicEffectLabel } from './relic'
import { Button, GradeBadge } from '../../components/ui'
import { STATE_ICON } from '../../components/icons'

interface RelicDetailModalProps {
  relicId: number
  onClose: () => void
}

export function RelicDetailModal({ relicId, onClose }: RelicDetailModalProps) {
  const ownedRelics = useGameStore((state) => state.ownedRelics)
  const activeRelics = useGameStore((state) => state.activeRelics)
  const unlockedCount = useGameStore((state) => state.unlockedCount)
  const setRelicSlot = useGameStore((state) => state.setRelicSlot)

  // relicId는 항상 sortedRelicRows()가 나열한 실제 유물 id만 넘어오므로
  // 존재를 항상 보장하는 getRelicConfig를 그대로 쓴다(없으면 기본값+경고).
  const relic = getRelicConfig(relicId)

  const owned = ownedRelics.includes(relicId)
  const activeIndex = activeRelics.indexOf(relicId)
  const isActive = activeIndex !== -1
  const slotCount = computeRelicSlotCount(unlockedCount)
  const hasEmptySlot = activeRelics.some((value, index) => index < slotCount && value === null)
  const canToggle = isActive || (owned && hasEmptySlot)

  const handleToggle = () => {
    if (isActive) {
      setRelicSlot(activeIndex, null)
      return
    }
    const emptyIndex = activeRelics.findIndex((value, index) => index < slotCount && value === null)
    if (emptyIndex !== -1) setRelicSlot(emptyIndex, relicId)
  }

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-6 animate-[backdrop-fade-in_180ms_ease-out]"
      onClick={onClose}
    >
      <div
        className="panel-frame w-full max-w-xs rounded-xl border border-surface-border bg-surface-card p-4 text-text-primary animate-[modal-pop-in_180ms_ease-out]"
        style={{ '--panel-accent-color': `var(--color-grade-${relic.RelicGrade.toLowerCase()})` } as CSSProperties}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className={`text-sm font-semibold ${GRADE_TEXT_COLOR[relic.RelicGrade]}`}>
              {getString(relic.Name, 'KOR')}
            </h2>
            {isActive && <span className="text-[10px] text-success-strong">{getStateLabel('unlocked')}</span>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg bg-surface-elevated px-2 py-1 text-[11px] text-text-secondary transition-colors hover:bg-surface-border hover:text-text-primary"
          >
            {getButtonLabel('close')}
          </button>
        </div>

        <dl className="mt-3 space-y-1 text-xs text-text-secondary">
          <div className="flex items-center justify-between">
            <dt>{getWeaponUiLabel('grade')}</dt>
            <dd>
              <GradeBadge grade={relic.RelicGrade} />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>{getStateLabel('effect')}</dt>
            <dd className="text-text-primary">{relicEffectLabel(relic)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt>{getCommonUiLabel('owned')}</dt>
            <dd className={owned ? 'text-success-strong' : 'text-text-disabled'}>
              {owned ? <STATE_ICON.equipped size={14} strokeWidth={2} /> : <STATE_ICON.locked size={14} strokeWidth={2} />}
            </dd>
          </div>
        </dl>

        <Button
          variant={isActive ? 'secondary' : 'teal'}
          disabled={!canToggle}
          onClick={handleToggle}
          className="mt-3 w-full"
        >
          {isActive ? getButtonLabel('deactivate') : getButtonLabel('activate')}
        </Button>

        {!owned && <p className="mt-2 text-center text-[10px] text-text-disabled">보유하지 않은 유물입니다</p>}
        {owned && !isActive && !hasEmptySlot && (
          <p className="mt-2 text-center text-[10px] text-danger-strong">{getRelicUiLabel('slotsFull')}</p>
        )}
      </div>
    </div>
  )
}
