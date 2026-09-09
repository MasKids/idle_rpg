import { useState } from 'react'
import { BALANCE_TABLES, getCommon, getString } from '../../data/balance'
import { getCurrencyName, getRelicUiLabel, getStateLabel } from '../../data/uiStrings'
import { useGameStore } from '../../store/gameStore'
import type { RelicGachaPullResult } from '../../types/game'
import { formatNumber } from '../../utils/format'
import { GRADE_BG_COLOR, GRADE_BORDER_COLOR, GRADE_TEXT_COLOR } from '../weapon/weaponUi'
import { RelicDetailModal } from './RelicDetailModal'
import { computeRelicSlotCount, relicEffectLabel, relicGradeName, sortedRelicRows, RELIC_SLOT_MAX } from './relic'

export function RelicTab() {
  const [selectedRelicId, setSelectedRelicId] = useState<number | null>(null)
  const ownedRelics = useGameStore((state) => state.ownedRelics)
  const activeRelics = useGameStore((state) => state.activeRelics)
  const unlockedCount = useGameStore((state) => state.unlockedCount)
  const slotCount = computeRelicSlotCount(unlockedCount)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <SlotSection activeRelics={activeRelics} slotCount={slotCount} unlockedCount={unlockedCount} />
      <RelicGachaSection ownedRelics={ownedRelics} />
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
    <div className="shrink-0 border-b border-white/10 p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-semibold text-amber-300">
          {getRelicUiLabel('activeSlots')} {slotCount}/{RELIC_SLOT_MAX}
        </span>
        {nextSlotRow && (
          <span className="text-[10px] text-white/50">
            {getRelicUiLabel('nextSlot')}: 존재력 {nextSlotRow.RequireUnlockedCount}노드 ({unlockedCount}/
            {nextSlotRow.RequireUnlockedCount})
          </span>
        )}
      </div>

      <div className="flex gap-1.5">
        {Array.from({ length: RELIC_SLOT_MAX }, (_, index) => {
          const locked = index >= slotCount
          const relicId = activeRelics[index] ?? null
          const relic = relicId !== null ? BALANCE_TABLES.RelicTable.find((r) => r.Id === relicId) : undefined

          return (
            <button
              key={index}
              type="button"
              disabled={locked || !relic}
              onClick={() => setRelicSlot(index, null)}
              className={`flex h-14 flex-1 flex-col items-center justify-center rounded-lg border text-[9px] ${
                locked
                  ? 'border-white/5 bg-black/30 text-white/20'
                  : relic
                    ? `${GRADE_BORDER_COLOR[relic.RelicGrade]} ${GRADE_BG_COLOR[relic.RelicGrade]} ${GRADE_TEXT_COLOR[relic.RelicGrade]}`
                    : 'border-dashed border-white/20 bg-black/20 text-white/30'
              }`}
            >
              {locked ? (
                getStateLabel('locked')
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

function RelicGachaSection({ ownedRelics }: { ownedRelics: number[] }) {
  const [lastResult, setLastResult] = useState<RelicGachaPullResult | null>(null)
  const timeEnergy = useGameStore((state) => state.currencies.timeEnergy)
  const pullRelicGacha = useGameStore((state) => state.pullRelicGacha)

  const cost = getCommon('RelicGachaCostTimeEnergy')
  const canPull = timeEnergy >= cost

  const handlePull = () => {
    setLastResult(pullRelicGacha())
  }

  const resultRelic = lastResult ? BALANCE_TABLES.RelicTable.find((r) => r.Id === lastResult.relicId) : undefined

  return (
    <div className="shrink-0 border-b border-white/10 p-3">
      <p className="mb-2 text-xs font-semibold text-amber-300">{getRelicUiLabel('pullRelic')}</p>

      <div className="mb-2 flex items-center justify-between text-[11px] text-white/70">
        <span>
          보유 {getCurrencyName('timeEnergy')} {formatNumber(timeEnergy)}
        </span>
        <span>
          1회 비용 {formatNumber(cost)} {getCurrencyName('timeEnergy')}
        </span>
      </div>

      <button
        type="button"
        disabled={!canPull}
        onClick={handlePull}
        className={`w-full rounded-lg px-3 py-2 text-sm font-medium ${
          canPull ? 'bg-amber-500 text-amber-950' : 'cursor-not-allowed bg-white/10 text-white/30'
        }`}
      >
        {getRelicUiLabel('pullRelic')}
      </button>

      {lastResult && resultRelic && (
        <div
          className={`mt-2 rounded-lg border p-2 text-center text-xs ${GRADE_BORDER_COLOR[resultRelic.RelicGrade]} ${GRADE_BG_COLOR[resultRelic.RelicGrade]}`}
        >
          <div className={`font-semibold ${GRADE_TEXT_COLOR[resultRelic.RelicGrade]}`}>
            {getString(resultRelic.Name, 'KOR')} ({relicGradeName(resultRelic.RelicGrade)})
          </div>
          <div className="mt-0.5 text-white/70">{relicEffectLabel(resultRelic)}</div>
          {lastResult.isDuplicate && (
            <div className="mt-0.5 text-amber-300">
              {getRelicUiLabel('duplicateRefund')} +{formatNumber(getCommon('RelicDuplicateRefundTimeEnergy'))}{' '}
              {getCurrencyName('timeEnergy')}
            </div>
          )}
        </div>
      )}
      <p className="mt-1 text-center text-[10px] text-white/30">보유 {ownedRelics.length}종</p>
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
      <p className="mb-2 text-xs font-semibold text-amber-300">
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
              className={`relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded-lg border p-1 text-center text-[9px] ${
                owned
                  ? `${GRADE_BORDER_COLOR[relic.RelicGrade]} ${GRADE_BG_COLOR[relic.RelicGrade]}`
                  : 'border-white/10 bg-black/20 opacity-40'
              }`}
            >
              {isActive && (
                <span className="absolute -top-1 -right-1 rounded-full bg-emerald-500 px-1 text-[8px] text-white">
                  A
                </span>
              )}
              <span className={owned ? GRADE_TEXT_COLOR[relic.RelicGrade] : 'text-white/30'}>
                {getString(relic.Name, 'KOR')}
              </span>
              <span className="text-white/40">{relicGradeName(relic.RelicGrade)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
