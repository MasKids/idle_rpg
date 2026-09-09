import { BALANCE_TABLES, getString } from '../../data/balance'
import { getButtonLabel, getRelicUiLabel, getStateLabel, getWeaponUiLabel } from '../../data/uiStrings'
import { useGameStore } from '../../store/gameStore'
import { GRADE_TEXT_COLOR } from '../weapon/weaponUi'
import { computeRelicSlotCount, relicEffectLabel, relicGradeName } from './relic'

interface RelicDetailModalProps {
  relicId: number
  onClose: () => void
}

export function RelicDetailModal({ relicId, onClose }: RelicDetailModalProps) {
  const ownedRelics = useGameStore((state) => state.ownedRelics)
  const activeRelics = useGameStore((state) => state.activeRelics)
  const unlockedCount = useGameStore((state) => state.unlockedCount)
  const setRelicSlot = useGameStore((state) => state.setRelicSlot)

  const relic = BALANCE_TABLES.RelicTable.find((row) => row.Id === relicId)
  if (!relic) return null

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
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-6" onClick={onClose}>
      <div
        className="w-full max-w-xs rounded-xl border border-white/10 bg-slate-900 p-4 text-white"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className={`text-sm font-semibold ${GRADE_TEXT_COLOR[relic.RelicGrade]}`}>
              {getString(relic.Name, 'KOR')}
            </h2>
            {isActive && <span className="text-[10px] text-emerald-300">{getStateLabel('unlocked')}</span>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg bg-white/10 px-2 py-1 text-[11px] text-white"
          >
            {getButtonLabel('close')}
          </button>
        </div>

        <dl className="mt-3 space-y-1 text-xs text-white/70">
          <div className="flex justify-between">
            <dt>{getWeaponUiLabel('grade')}</dt>
            <dd className={GRADE_TEXT_COLOR[relic.RelicGrade]}>{relicGradeName(relic.RelicGrade)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>{getStateLabel('effect')}</dt>
            <dd className="text-white">{relicEffectLabel(relic)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>보유</dt>
            <dd className="text-white">{owned ? getStateLabel('unlocked') : getStateLabel('locked')}</dd>
          </div>
        </dl>

        <button
          type="button"
          disabled={!canToggle}
          onClick={handleToggle}
          className={`mt-3 w-full rounded-lg px-3 py-2 text-sm font-medium ${
            canToggle
              ? isActive
                ? 'bg-white/10 text-white'
                : 'bg-cyan-600 text-white'
              : 'cursor-not-allowed bg-white/10 text-white/30'
          }`}
        >
          {isActive ? getButtonLabel('deactivate') : getButtonLabel('activate')}
        </button>

        {!owned && <p className="mt-2 text-center text-[10px] text-white/40">보유하지 않은 유물입니다</p>}
        {owned && !isActive && !hasEmptySlot && (
          <p className="mt-2 text-center text-[10px] text-red-400">{getRelicUiLabel('slotsFull')}</p>
        )}
      </div>
    </div>
  )
}
