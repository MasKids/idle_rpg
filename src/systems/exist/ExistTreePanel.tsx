import { useEffect, useMemo, useRef, useState } from 'react'
import { EXIST_SPECIAL_UNLOCKS, existNodeStatus, generateExistTree } from '../../data/existTree'
import { useGameStore } from '../../store/gameStore'
import type {
  CurrencyKey,
  ExistNodeEffect,
  ExistNodeStatus,
  ExistSpecialUnlock,
  ExistTreeLane,
  ExistTreeNode,
  StatKey,
} from '../../types/game'

interface ExistTreePanelProps {
  onBack: () => void
}

const STAT_ABBR: Record<StatKey, string> = {
  atk: 'ATK',
  def: 'DEF',
  aspd: 'ASPD',
  crit: 'CRIT',
  critDmg: 'CDMG',
  existGain: 'EGAIN',
}

const CURRENCY_ABBR: Record<CurrencyKey, string> = {
  exist: '존재력',
  growthEnergy: '성장',
  timeEnergy: '시간',
  gold: '골드',
  essence: '정수',
}

function effectSummary(effect: ExistNodeEffect): string {
  return effect.kind === 'stat'
    ? `${STAT_ABBR[effect.stat]}+${effect.value}`
    : `${CURRENCY_ABBR[effect.currency]}+${effect.amount}`
}

function oppositeLane(lane: ExistTreeLane): ExistTreeLane {
  return lane === 'left' ? 'right' : 'left'
}

const CIRCLE_STYLE: Record<ExistNodeStatus, string> = {
  unlocked: 'border-2 border-amber-300 bg-amber-400 text-amber-950',
  unlockable: 'border-2 border-amber-300 bg-amber-950 text-amber-200 ring-4 ring-amber-300/50 animate-pulse scale-110',
  locked: 'border border-amber-100/10 bg-amber-950/40 text-amber-100/30',
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
    <div className="relative flex min-h-0 flex-1 flex-col bg-amber-950 text-amber-100">
      <div className="relative flex shrink-0 items-center justify-center border-b border-amber-300/10 py-3">
        <button type="button" onClick={onBack} className="absolute left-4 text-sm text-amber-300">
          ← 뒤로
        </button>
        <div className="text-sm font-semibold text-amber-200">
          보유 존재력 <span className="text-amber-300">{exist}</span>
        </div>
      </div>

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
                <div className="flex items-center gap-2 px-6 py-2 text-[10px] text-amber-300/50">
                  <div className="h-px flex-1 bg-amber-300/20" />
                  {node.tier}티어
                  <div className="h-px flex-1 bg-amber-300/20" />
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

      <div className="w-px shrink-0 bg-amber-300/20" />

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
      <line x1="0" y1="2" x2="24" y2="2" stroke="currentColor" strokeWidth="2" className="text-amber-300/30" />
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
        {status === 'unlocked' && <span className="text-amber-200/80">{effectSummary(node.effect)}</span>}
        {status === 'unlockable' && <span className="text-amber-300">{node.cost}</span>}
        {status === 'locked' && <span className="text-amber-100/20">잠김</span>}
      </div>
    </button>
  )
}

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
    <button
      type="button"
      onClick={onClick}
      className="flex w-24 flex-col items-center gap-1"
    >
      <div
        className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 text-[10px] font-bold ${
          unlocked
            ? 'border-fuchsia-300 bg-fuchsia-500 text-white'
            : 'border-fuchsia-400 bg-fuchsia-950 text-fuchsia-200 ring-4 ring-fuchsia-400/40'
        }`}
      >
        {unlock.label}
      </div>
      <div className="text-center text-[9px] leading-tight text-fuchsia-200">
        {unlocked ? '해금됨' : unlock.cost}
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
    <div className="shrink-0 border-b border-amber-300/20 bg-amber-900/95 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-amber-200">
            {node.order}번 노드 · {node.tier}티어
          </div>
          <div className="mt-0.5 text-[11px] text-amber-100/70">효과 {effectSummary(node.effect)}</div>
          <div className="text-[11px] text-amber-100/70">
            {status === 'unlocked' ? '해금됨' : `비용 ${node.cost} 존재력`}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {status === 'unlockable' && (
            <button
              type="button"
              disabled={!canUnlock}
              onClick={onUnlock}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                canUnlock ? 'bg-amber-400 text-amber-950' : 'cursor-not-allowed bg-white/10 text-white/30'
              }`}
            >
              해금
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-amber-100"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
