import type { ReactNode } from 'react'
import { getRebirthConfig } from '../../data/balance'
import { getButtonLabel, getRebirthBonusLabel, getSystemName } from '../../data/uiStrings'
import { useGameStore } from '../../store/gameStore'
import { computeAllStatBonusPercent, computeRebirthBonusPoints } from './rebirthBonus'
import { formatNumber } from '../../utils/format'

interface RebirthModalProps {
  isOpen: boolean
  onCancel: () => void
  onConfirm: () => void
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

export function RebirthModal({ isOpen, onCancel, onConfirm }: RebirthModalProps) {
  const spent = useGameStore((state) => state.rebirthSpent)
  const unlockedCount = useGameStore((state) => state.unlockedCount)
  const currentStage = useGameStore((state) => state.currentStage)
  const rebirthCount = useGameStore((state) => state.rebirthCount)
  const rebirthBonusPoint = useGameStore((state) => state.rebirthBonusPoint)

  if (!isOpen) return null

  const config = getRebirthConfig()
  const pendingPoints = computeRebirthBonusPoints(currentStage)
  const currentBonusPercent = computeAllStatBonusPercent(rebirthBonusPoint)
  const nextBonusPercent = computeAllStatBonusPercent(rebirthBonusPoint + pendingPoints)
  const belowMinStage = currentStage < config.MinStageForBonus

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-6"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-xs rounded-xl border border-purple-400/30 bg-slate-900 p-4 text-white"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-sm font-semibold text-purple-300">{getSystemName('reverse')}</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-white/60">
          스테이지·스탯·장비·숙련을 초기화하는 대신, 그동안 소비한 재화를 전액 돌려받습니다. 존재력 트리는
          그대로 유지됩니다.
        </p>

        <RebirthSection title={getRebirthBonusLabel('title')} tone="text-amber-300">
          <li>
            {getRebirthBonusLabel('currentCycle')} {rebirthCount + 1}회차
          </li>
          <li>
            {getRebirthBonusLabel('totalPoints')} {formatNumber(rebirthBonusPoint)} ({getRebirthBonusLabel('allStatBonus')}{' '}
            +{formatPercent(currentBonusPercent)})
          </li>
          <li>
            {getRebirthBonusLabel('pendingPoints')} +{formatNumber(pendingPoints)}
          </li>
          <li>
            리버스 후 {getRebirthBonusLabel('allStatBonus')} +{formatPercent(nextBonusPercent)}
          </li>
          {belowMinStage && (
            <li className="text-red-400">
              ⚠ 현재 스테이지가 {config.MinStageForBonus}스테이지 미만이라 이번 리버스는 보너스를 얻지 못합니다
            </li>
          )}
        </RebirthSection>

        <RebirthSection title="초기화" tone="text-red-300">
          <li>스테이지 → 1-1</li>
          <li>6스탯 레벨 전부 0</li>
          <li>장비 5부위 강화 레벨 전부 0</li>
          <li>무기 숙련 레벨 0</li>
        </RebirthSection>

        <RebirthSection title="환급" tone="text-emerald-300">
          <li>성장에너지 +{formatNumber(spent.growthEnergy)}</li>
          <li>골드 +{formatNumber(spent.gold)}</li>
          <li>정수 +{formatNumber(spent.essence)}</li>
        </RebirthSection>

        <RebirthSection title="유지" tone="text-sky-300">
          <li>존재력 트리 ({unlockedCount}/50 해금)</li>
          <li>리버스 · 타임 하이스트 해금 상태</li>
          <li>존재력(EXIST), 시간에너지 보유량</li>
        </RebirthSection>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white"
          >
            {getButtonLabel('cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white"
          >
            {getButtonLabel('execute')}
          </button>
        </div>
      </div>
    </div>
  )
}

function RebirthSection({
  title,
  tone,
  children,
}: {
  title: string
  tone: string
  children: ReactNode
}) {
  return (
    <div className="mt-3 border-t border-white/10 pt-2">
      <p className={`mb-1 text-[10px] font-semibold ${tone}`}>{title}</p>
      <ul className="space-y-0.5 text-[11px] text-white/70">{children}</ul>
    </div>
  )
}
