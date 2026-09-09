import { useState } from 'react'
import { BALANCE_TABLES, getRelicConfig, getString } from '../../data/balance'
import { getCommonUiLabel, getCurrencyName, getRelicUiLabel } from '../../data/uiStrings'
import { useGameStore } from '../../store/gameStore'
import { GRADE_BG_COLOR, GRADE_BORDER_COLOR, GRADE_TEXT_COLOR } from '../weapon/weaponUi'
import { RelicDetailModal } from './RelicDetailModal'
import { computeRelicSlotCount, relicGradeName, sortedRelicRows, RELIC_SLOT_MAX } from './relic'
import { GradeBadge } from '../../components/ui'
import { STATE_ICON } from '../../components/icons'

// 유물 뽑기(소환)는 systems/gacha/RelicGachaTab.tsx로 옮겨졌다 — 여기는 슬롯
// 활성화/비활성화와 보유 유물 열람(무기고=보관·관리, 소환=뽑기 역할 분리)만 담당한다.
export function RelicTab() {
  const [selectedRelicId, setSelectedRelicId] = useState<number | null>(null)
  const ownedRelics = useGameStore((state) => state.ownedRelics)
  const activeRelics = useGameStore((state) => state.activeRelics)
  const unlockedCount = useGameStore((state) => state.unlockedCount)
  const slotCount = computeRelicSlotCount(unlockedCount)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <SlotSection activeRelics={activeRelics} slotCount={slotCount} unlockedCount={unlockedCount} />
      <RelicGrid ownedRelics={ownedRelics} activeRelics={activeRelics} onSelect={setSelectedRelicId} />

      {selectedRelicId !== null && (
        <RelicDetailModal relicId={selectedRelicId} onClose={() => setSelectedRelicId(null)} />
      )}
    </div>
  )
}

function SlotSection({
  activeRelics,
  slotCount,
  unlockedCount,
}: {
  activeRelics: (number | null)[]
  slotCount: number
  unlockedCount: number
}) {
  const setRelicSlot = useGameStore((state) => state.setRelicSlot)

  const nextSlotRow = [...BALANCE_TABLES.RelicSlotTable]
    .sort((a, b) => a.SlotIndex - b.SlotIndex)
    .find((row) => row.SlotIndex > slotCount)

  return (
    <div className="shrink-0 border-b border-surface-border p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-semibold text-teal-strong">
          {getRelicUiLabel('activeSlots')} {slotCount}/{RELIC_SLOT_MAX}
        </span>
        {nextSlotRow && (
          <span className="text-[10px] text-text-secondary">
            {getRelicUiLabel('nextSlot')}: {getCurrencyName('exist')} {nextSlotRow.RequireUnlockedCount}
            {getCommonUiLabel('nodeSuffix')} ({unlockedCount}/
            {nextSlotRow.RequireUnlockedCount})
          </span>
        )}
      </div>

      <div className="flex gap-1.5">
        {Array.from({ length: RELIC_SLOT_MAX }, (_, index) => {
          const locked = index >= slotCount
          const relicId = activeRelics[index] ?? null
          const relic = relicId !== null ? getRelicConfig(relicId) : undefined

          return (
            <button
              key={index}
              type="button"
              disabled={locked || !relic}
              onClick={() => setRelicSlot(index, null)}
              className={`flex h-14 flex-1 flex-col items-center justify-center rounded-lg border text-[9px] transition-colors ${
                locked
                  ? 'border-surface-border bg-surface-card text-text-disabled'
                  : relic
                    ? `${GRADE_BORDER_COLOR[relic.RelicGrade]} ${GRADE_BG_COLOR[relic.RelicGrade]} ${GRADE_TEXT_COLOR[relic.RelicGrade]} hover:brightness-125`
                    : 'border-dashed border-surface-border bg-surface-card text-text-disabled'
              }`}
            >
              {locked ? (
                <STATE_ICON.locked size={14} strokeWidth={2} />
              ) : relic ? (
                <span className="px-1 text-center leading-tight">{getString(relic.Name, 'KOR')}</span>
              ) : (
                '-'
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// 무기 그리드와 동일한 규칙: 전체 유물을 등급순으로 나열하고, 셀을 눌러 상세 팝업을 연다.
// 미보유 유물도 회색으로 함께 보여 "무엇을 더 모아야 하는지" 알 수 있게 한다.
function RelicGrid({
  ownedRelics,
  activeRelics,
  onSelect,
}: {
  ownedRelics: number[]
  activeRelics: (number | null)[]
  onSelect: (relicId: number) => void
}) {
  return (
    <div className="min-h-0 flex-1 p-3">
      <p className="mb-2 text-xs font-semibold text-teal-strong">
        {getRelicUiLabel('ownedRelics')} {ownedRelics.length}/{BALANCE_TABLES.RelicTable.length}
      </p>

      <div className="grid grid-cols-3 gap-1.5">
        {sortedRelicRows().map((relic) => {
          const owned = ownedRelics.includes(relic.Id)
          const isActive = activeRelics.includes(relic.Id)

          return (
            <button
              key={relic.Id}
              type="button"
              onClick={() => onSelect(relic.Id)}
              className={`relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border p-1 text-center text-[9px] transition-colors ${
                owned
                  ? `${GRADE_BORDER_COLOR[relic.RelicGrade]} ${GRADE_BG_COLOR[relic.RelicGrade]} hover:brightness-125`
                  : 'border-surface-border bg-surface-card opacity-40 hover:opacity-60'
              }`}
            >
              {isActive && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-success-base text-white">
                  <STATE_ICON.equipped size={11} strokeWidth={2.5} />
                </span>
              )}
              <span className={owned ? GRADE_TEXT_COLOR[relic.RelicGrade] : 'text-text-disabled'}>
                {getString(relic.Name, 'KOR')}
              </span>
              {owned ? (
                <GradeBadge grade={relic.RelicGrade} className="text-[8px]" />
              ) : (
                <span className="text-text-disabled">{relicGradeName(relic.RelicGrade)}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
