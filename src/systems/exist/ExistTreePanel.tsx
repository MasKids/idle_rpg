import { useEffect, useMemo, useRef, useState } from 'react'
import { EXIST_SPECIAL_UNLOCKS, EXIST_TREE_TOTAL_NODES, existNodeStatus, generateExistTree } from '../../data/existTree'
import {
  getButtonLabel,
  getCommonUiLabel,
  getCurrencyAbbr,
  getCurrencyName,
  getExistUiLabel,
  getStateLabel,
} from '../../data/uiStrings'
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
import { Button, PanelHeader, ProgressBar } from '../../components/ui'
import { STATE_ICON } from '../../components/icons'
import { IntroBanner } from '../onboarding/IntroBanner'
import { SYSTEM_INTRO_LINES } from '../onboarding/onboardingContent'

interface ExistTreePanelProps {
  onBack: () => void
}

// 노드 원형 안 작은 영문 태그 — StringTable의 6스탯 정식 명칭과는 별개의 표시 전용 축약형
const STAT_ABBR: Record<StatKey, string> = {
  atk: 'ATK',
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

  // 노드 해금 순간 그 노드 자리에서 짧게 발광이 퍼지는 연출. unlockedCount가
  // 늘어난 순간의 값이 곧 "방금 해금된 노드의 order"다.
  const [burstOrder, setBurstOrder] = useState<number | null>(null)
  const prevUnlockedCountRef = useRef(unlockedCount)

  useEffect(() => {
    if (unlockedCount > prevUnlockedCountRef.current) {
      const order = unlockedCount
      setBurstOrder(order)
      const timer = setTimeout(() => {
        setBurstOrder((current) => (current === order ? null : current))
      }, 500)
      prevUnlockedCountRef.current = unlockedCount
      return () => clearTimeout(timer)
    }
    prevUnlockedCountRef.current = unlockedCount
  }, [unlockedCount])

  const selectedNode = nodesTopToBottom.find((node) => node.order === selectedOrder) ?? null
  const selectedStatus = selectedNode ? existNodeStatus(selectedNode.order, unlockedCount) : null

  // 상시 진행도 표시용 — 아직 해금하지 않은 특별 해금 중 가장 가까운 것까지 남은 노드 수.
  const nextSpecial = [...EXIST_SPECIAL_UNLOCKS]
    .filter((unlock) => !specialUnlocks[unlock.id])
    .sort((a, b) => a.requiredUnlockedCount - b.requiredUnlockedCount)[0]
  const nextSpecialRemain = nextSpecial ? Math.max(0, nextSpecial.requiredUnlockedCount - unlockedCount) : null

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
        accentColorVar="var(--color-teal-strong)"
      />

      <IntroBanner
        storageKey="intro-exist-tree"
        title={getCurrencyName('exist') + ' 트리'}
        lines={SYSTEM_INTRO_LINES.existTree}
        accentColorVar="var(--color-teal-strong)"
        className="m-3"
      />

      <div className="shrink-0 border-b border-surface-border px-4 py-2">
        <div className="flex items-center justify-between text-[11px] text-text-secondary">
          <span className="tabular-nums">
            {unlockedCount}/{EXIST_TREE_TOTAL_NODES}
          </span>
          {nextSpecial && nextSpecialRemain !== null && nextSpecialRemain > 0 && (
            <span className="tabular-nums">
              {getExistUiLabel('untilNextSpecial')} {nextSpecialRemain}
              {getCommonUiLabel('nodeSuffix')}
            </span>
          )}
        </div>
        <ProgressBar value={unlockedCount} max={EXIST_TREE_TOTAL_NODES} colorClassName="bg-teal-base" className="mt-1" />
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

          // 조건을 채우기 전에도 위치는 계속 보여준다(해금 가능 여부만 다르게 표시) —
          // 그래야 트리를 스크롤하면서 "몇 번 노드에 리버스/타임 하이스트가 있는지" 미리 알 수 있다.
          const special = specialByAnchor.get(node.order)
          const specialReachable = special !== undefined && unlockedCount >= special.requiredUnlockedCount
          const specialUnlocked = special !== undefined && specialUnlocks[special.id]

          return (
            <div key={node.order}>
              <NodeRow
                node={node}
                status={status}
                isSelected={node.order === selectedOrder}
                isBursting={node.order === burstOrder}
                onSelect={() => setSelectedOrder(node.order)}
                special={special}
                specialReachable={specialReachable}
                specialUnlocked={specialUnlocked}
                exist={exist}
                onSpecialClick={specialReachable ? () => unlockSpecial(special!.id) : undefined}
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
  isBursting: boolean
  onSelect: () => void
  special?: ExistSpecialUnlock
  specialReachable: boolean
  specialUnlocked: boolean
  exist: number
  onSpecialClick?: () => void
}

function NodeRow({
  node,
  status,
  isSelected,
  isBursting,
  onSelect,
  special,
  specialReachable,
  specialUnlocked,
  exist,
  onSpecialClick,
}: NodeRowProps) {
  const specialLane = special ? oppositeLane(node.lane) : null

  return (
    <div className="flex h-24 w-full items-stretch">
      <div className="flex w-1/2 items-center justify-end">
        {node.lane === 'left' && (
          <>
            <NodeCircle node={node} status={status} isSelected={isSelected} isBursting={isBursting} onClick={onSelect} />
            <Connector />
          </>
        )}
        {specialLane === 'left' && special && (
          <>
            <SpecialCircle unlock={special} reachable={specialReachable} unlocked={specialUnlocked} exist={exist} onClick={onSpecialClick} />
            <Connector />
          </>
        )}
      </div>

      <div className="w-px shrink-0 bg-surface-border" />

      <div className="flex w-1/2 items-center justify-start">
        {node.lane === 'right' && (
          <>
            <Connector />
            <NodeCircle node={node} status={status} isSelected={isSelected} isBursting={isBursting} onClick={onSelect} />
          </>
        )}
        {specialLane === 'right' && special && (
          <>
            <Connector />
            <SpecialCircle unlock={special} reachable={specialReachable} unlocked={specialUnlocked} exist={exist} onClick={onSpecialClick} />
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
  isBursting,
  onClick,
}: {
  node: ExistTreeNode
  status: ExistNodeStatus
  isSelected: boolean
  isBursting: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-20 flex-col items-center gap-1 ${isSelected ? 'opacity-100' : ''}`}
    >
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
        {isBursting && (
          <span className="pointer-events-none absolute h-12 w-12 rounded-full border-2 border-teal-strong animate-[node-unlock-burst_500ms_ease-out_forwards]" />
        )}
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold transition ${CIRCLE_STYLE[status]} ${isSelected ? 'scale-110' : ''}`}
        >
          {node.order}
        </div>
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
// 트리 스크롤 중에도 눈에 띄게 한다. 조건(requiredUnlockedCount)을 채우기 전에도 자리는
// 계속 보여준다 — 대신 흐리게 표시해 "아직 멀었다"는 걸 알 수 있게 한다.
function SpecialCircle({
  unlock,
  reachable,
  unlocked,
  exist,
  onClick,
}: {
  unlock: ExistSpecialUnlock
  reachable: boolean
  unlocked: boolean
  exist: number
  onClick?: () => void
}) {
  const canAfford = exist >= unlock.cost

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`flex w-24 flex-col items-center gap-1 ${!reachable ? 'cursor-default' : ''}`}
    >
      <div
        className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-4 text-[10px] font-bold ${
          unlocked
            ? 'border-grade-epic bg-grade-epic text-white'
            : reachable
              ? 'border-grade-epic bg-surface-elevated text-grade-epic ring-4 ring-grade-epic/40'
              : 'border-surface-border bg-surface-card text-text-disabled'
        }`}
      >
        {reachable ? unlock.label : <STATE_ICON.locked size={18} strokeWidth={2} />}
      </div>
      <div
        className={`text-center text-[9px] leading-tight ${
          !reachable ? 'text-text-disabled' : !unlocked && !canAfford ? 'text-danger-strong' : 'text-grade-epic'
        }`}
      >
        {unlocked
          ? getStateLabel('unlocked')
          : reachable
            ? formatNumber(unlock.cost)
            : `${unlock.label} · ${unlock.requiredUnlockedCount}${getCommonUiLabel('nodeSuffix')}`}
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
          <div className={`text-[11px] ${status === 'unlockable' && !canUnlock ? 'text-danger-strong' : 'text-text-secondary'}`}>
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
