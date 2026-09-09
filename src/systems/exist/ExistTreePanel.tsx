import { useEffect, useMemo, useRef, useState } from 'react'
import { EXIST_SPECIAL_UNLOCKS, existNodeStatus, generateExistTree } from '../../data/existTree'
import { getButtonLabel, getCurrencyAbbr, getCurrencyName, getStateLabel } from '../../data/uiStrings'
import { useGameStore } from '../../store/gameStore'
import { formatNumber } from '../../utils/format'
import type {
  ExistNodeEffect,
  ExistNodeStatus,
  ExistSpecialUnlock,
  ExistTreeLane,
  ExistTreeNode,
  StatKey,
} from '../../types/game'
import { Button, PanelHeader } from '../../components/ui'
import { STATE_ICON } from '../../components/icons'

interface ExistTreePanelProps {
  onBack: () => void
}

// 노드 원형 안 작은 영문 태그 — StringTable의 6스탯 정식 명칭과는 별개의 표시 전용 축약형
const STAT_ABBR: Record<StatKey, string> = {
  atk: 'ATK',
  def: 'DEF',
  aspd: 'ASPD',
  crit: 'CRIT',
  critDmg: 'CDMG',
  existGain: 'EGAIN',
}

function effectSummary(effect: ExistNodeEffect): string {
  return effect.kind === 'stat'
    ? `${STAT_ABBR[effect.stat]}+${formatNumber(effect.value)}`
    : `${getCurrencyAbbr(effect.currency)}+${formatNumber(effect.amount)}`
}

function oppositeLane(lane: ExistTreeLane): ExistTreeLane {
  return lane === 'left' ? 'right' : 'left'
}

const CIRCLE_STYLE: Record<ExistNodeStatus, string> = {
  unlocked: 'border-2 border-teal-strong bg-teal-base text-white',
  unlockable: 'border-2 border-teal-strong bg-surface-elevated text-teal-strong ring-4 ring-teal-strong/50 animate-pulse scale-110',
  locked: 'border border-surface-border bg-surface-card text-text-disabled',
}

export function ExistTreePanel({ onBack }: ExistTreePanelProps) {
  const exist = useGameStore((state) => state.currencies.exist)
  const unlockedCount = useGameStore((state) => state.unlockedCount)
  const specialUnlocks = useGameStore((state) => state.specialUnlocks)
  const unlockNextExistNode = useGameStore((state) => state.unlockNextExistNode)
  const unlockSpecial = useGameStore((state) => state.unlockSpecial)

  const [selectedOrder, setSelectedOrder] = useState<number | null>(null)

  // 50번(최상단) -> 1번(최하단) 순서로 렌더링. 시각적으로 아래에서 위로 올라가는 구조.
  const nodesTopToBottom = useMemo(() => [...generateExistTree()].reverse(), [])
  const specialByAnchor = useMemo(() => {
    const map = new Map<number, ExistSpecialUnlock>()
    for (const unlock of EXIST_SPECIAL_UNLOCKS) map.set(unlock.anchorOrder, unlock)
    return map
  }, [])

  const scrollRef = useRef<HTMLDivElement>(null)
  const scrolledOnce = useRef(false)

  useEffect(() => {
    const el = scrollRef.current
    if (el && !scrolledOnce.current) {
      el.scrollTop = el.scrollHeight
      scrolledOnce.current = true
    }
  }, [])

  const selectedNode = nodesTopToBottom.find((node) => node.order === selectedOrder) ?? null
  const selectedStatus = selectedNode ? existNodeStatus(selectedNode.order, unlockedCount) : null

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-surface-base text-text-primary">
      <PanelHeader
        title={
          <>
            보유 {getCurrencyName('exist')} <span className="text-teal-strong">{formatNumber(exist)}</span>
          </>
        }
        onBack={onBack}
        toneClassName="text-text-primary"
      />

      {selectedNode && selectedStatus && (
        <NodeInfoBar
          node={selectedNode}
          status={selectedStatus}
          exist={exist}
          onClose={() => setSelectedOrder(null)}
          onUnlock={() => {
            if (unlockNextExistNode()) setSelectedOrder(null)
          }}
        />
      )}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        {nodesTopToBottom.map((node, index) => {
          const status = existNodeStatus(node.order, unlockedCount)
          const nextNode = nodesTopToBottom[index + 1]
          const showTierDividerBelow = nextNode !== undefined && nextNode.tier !== node.tier

          const special = specialByAnchor.get(node.order)
          const specialVisible = special !== undefined && unlockedCount >= special.requiredUnlockedCount
          const specialUnlocked = special !== undefined && specialUnlocks[special.id]

          return (
            <div key={node.order}>
              <NodeRow
                node={node}
                status={status}
                isSelected={node.order === selectedOrder}
                onSelect={() => setSelectedOrder(node.order)}
                special={specialVisible ? special : undefined}
                specialUnlocked={specialUnlocked}
                onSpecialClick={special ? () => unlockSpecial(special.id) : undefined}
              />
              {showTierDividerBelow && (
                <div className="flex items-center gap-2 px-6 py-2 text-[10px] text-text-secondary">
                  <div className="h-px flex-1 bg-surface-border" />
                  {node.tier}
                  {getStateLabel('tier')}
                  <div className="h-px flex-1 bg-surface-border" />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface NodeRowProps {
  node: ExistTreeNode
  status: ExistNodeStatus
  isSelected: boolean
  onSelect: () => void
  special?: ExistSpecialUnlock
  specialUnlocked: boolean
  onSpecialClick?: () => void
}

function NodeRow({ node, status, isSelected, onSelect, special, specialUnlocked, onSpecialClick }: NodeRowProps) {
  const specialLane = special ? oppositeLane(node.lane) : null

  return (
    <div className="flex h-24 w-full items-stretch">
      <div className="flex w-1/2 items-center justify-end">
        {node.lane === 'left' && (
          <>
            <NodeCircle node={node} status={status} isSelected={isSelected} onClick={onSelect} />
            <Connector />
          </>
        )}
        {specialLane === 'left' && special && (
          <>
            <SpecialCircle unlock={special} unlocked={specialUnlocked} onClick={onSpecialClick} />
            <Connector />
          </>
        )}
      </div>

      <div className="w-px shrink-0 bg-surface-border" />

      <div className="flex w-1/2 items-center justify-start">
        {node.lane === 'right' && (
          <>
            <Connector />
            <NodeCircle node={node} status={status} isSelected={isSelected} onClick={onSelect} />
          </>
        )}
        {specialLane === 'right' && special && (
          <>
            <Connector />
            <SpecialCircle unlock={special} unlocked={specialUnlocked} onClick={onSpecialClick} />
          </>
        )}
      </div>
    </div>
  )
}

function Connector() {
  return (
    <svg width="24" height="4" className="shrink-0">
      <line x1="0" y1="2" x2="24" y2="2" stroke="currentColor" strokeWidth="2" className="text-surface-border" />
    </svg>
  )
}

function NodeCircle({
  node,
  status,
  isSelected,
  onClick,
}: {
  node: ExistTreeNode
  status: ExistNodeStatus
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-20 flex-col items-center gap-1 ${isSelected ? 'opacity-100' : ''}`}
    >
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition ${CIRCLE_STYLE[status]} ${isSelected ? 'scale-110' : ''}`}
      >
        {node.order}
      </div>
      <div className="text-center text-[9px] leading-tight">
        {status === 'unlocked' && <span className="text-text-secondary">{effectSummary(node.effect)}</span>}
        {status === 'unlockable' && <span className="text-teal-strong">{formatNumber(node.cost)}</span>}
        {status === 'locked' && <span className="text-text-disabled">{getStateLabel('locked')}</span>}
      </div>
    </button>
  )
}

// 리버스/타임 하이스트 같은 특별 해금 — 일반 노드(청록)와 다른 계열(등급색 중 보라)을 써서
// 트리 스크롤 중에도 눈에 띄게 한다.
function SpecialCircle({
  unlock,
  unlocked,
  onClick,
}: {
  unlock: ExistSpecialUnlock
  unlocked: boolean
  onClick?: () => void
}) {
  return (
    <button type="button" onClick={onClick} className="flex w-24 flex-col items-center gap-1">
      <div
        className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 text-[10px] font-bold ${
          unlocked
            ? 'border-grade-epic bg-grade-epic text-white'
            : 'border-grade-epic bg-surface-elevated text-grade-epic ring-4 ring-grade-epic/40'
        }`}
      >
        {unlock.label}
      </div>
      <div className="text-center text-[9px] leading-tight text-grade-epic">
        {unlocked ? getStateLabel('unlocked') : formatNumber(unlock.cost)}
      </div>
    </button>
  )
}

function NodeInfoBar({
  node,
  status,
  exist,
  onClose,
  onUnlock,
}: {
  node: ExistTreeNode
  status: ExistNodeStatus
  exist: number
  onClose: () => void
  onUnlock: () => void
}) {
  const canUnlock = status === 'unlockable' && exist >= node.cost

  return (
    <div className="shrink-0 border-b border-surface-border bg-surface-elevated px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-text-primary">
            {node.order}번 노드 · {node.tier}
            {getStateLabel('tier')}
          </div>
          <div className="mt-0.5 text-[11px] text-text-secondary">
            {getStateLabel('effect')} {effectSummary(node.effect)}
          </div>
          <div className="text-[11px] text-text-secondary">
            {status === 'unlocked'
              ? getStateLabel('unlocked')
              : `${getStateLabel('cost')} ${formatNumber(node.cost)} ${getCurrencyName('exist')}`}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {status === 'unlockable' && (
            <Button variant="teal" disabled={!canUnlock} onClick={onUnlock} className="gap-1 px-3 py-1.5 text-xs">
              <STATE_ICON.unlocked size={14} strokeWidth={2} />
              {getButtonLabel('unlock')}
            </Button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-surface-card px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-surface-border"
          >
            {getButtonLabel('close')}
          </button>
        </div>
      </div>
    </div>
  )
}
