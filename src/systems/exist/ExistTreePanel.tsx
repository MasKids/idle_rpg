import { useMemo } from 'react'
import { existNodeStatus, generateExistTree } from '../../data/existTree'
import { useGameStore } from '../../store/gameStore'
import type { CurrencyKey, ExistNodeEffect, ExistNodeStatus, ExistTreeNode, StatKey } from '../../types/game'

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

const CIRCLE_STYLE: Record<ExistNodeStatus, string> = {
  unlocked: 'border-2 border-amber-300 bg-amber-400 text-amber-950',
  unlockable: 'border-2 border-amber-300 bg-amber-950 text-amber-200 ring-4 ring-amber-300/30',
  locked: 'border border-amber-100/10 bg-amber-950/40 text-amber-100/30',
}

export function ExistTreePanel({ onBack }: ExistTreePanelProps) {
  const exist = useGameStore((state) => state.currencies.exist)
  const unlockedCount = useGameStore((state) => state.unlockedCount)
  const nodes = useMemo(() => generateExistTree(), [])

  return (
    <div className="flex h-full flex-col bg-amber-950 text-amber-100">
      <div className="relative flex shrink-0 items-center justify-center border-b border-amber-300/10 py-3">
        <button type="button" onClick={onBack} className="absolute left-4 text-sm text-amber-300">
          ← 뒤로
        </button>
        <div className="text-sm font-semibold text-amber-200">
          보유 존재력 <span className="text-amber-300">{exist}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {nodes.map((node) => {
          const status = existNodeStatus(node.order, unlockedCount)
          const showTierDivider = node.order > 1 && node.order % 10 === 1

          return (
            <div key={node.order}>
              {showTierDivider && (
                <div className="flex items-center gap-2 px-6 py-2 text-[10px] text-amber-300/50">
                  <div className="h-px flex-1 bg-amber-300/20" />
                  {node.tier}티어
                  <div className="h-px flex-1 bg-amber-300/20" />
                </div>
              )}
              <NodeRow node={node} status={status} />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function NodeRow({ node, status }: { node: ExistTreeNode; status: ExistNodeStatus }) {
  return (
    <div className="flex h-24 w-full items-stretch">
      <div className="flex w-1/2 items-center justify-end">
        {node.lane === 'left' && (
          <>
            <NodeCircle node={node} status={status} />
            <Connector />
          </>
        )}
      </div>

      <div className="w-px shrink-0 bg-amber-300/20" />

      <div className="flex w-1/2 items-center justify-start">
        {node.lane === 'right' && (
          <>
            <Connector />
            <NodeCircle node={node} status={status} />
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

function NodeCircle({ node, status }: { node: ExistTreeNode; status: ExistNodeStatus }) {
  return (
    <div className="flex w-20 flex-col items-center gap-1">
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${CIRCLE_STYLE[status]}`}
      >
        {node.order}
      </div>
      <div className="text-center text-[9px] leading-tight">
        {status === 'unlocked' && <span className="text-amber-200/80">{effectSummary(node.effect)}</span>}
        {status === 'unlockable' && <span className="text-amber-300">{node.cost}</span>}
        {status === 'locked' && <span className="text-amber-100/20">잠김</span>}
      </div>
    </div>
  )
}
