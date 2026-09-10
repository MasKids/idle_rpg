import type { CSSProperties } from 'react'
import { generateStage, stageLabel } from '../data/stages'
import { getButtonLabel, getCommonUiLabel, getCurrencyName, getRebirthBonusLabel, getSystemName } from '../data/uiStrings'
import { useGameStore } from '../store/gameStore'
import { computeRebirthBonusPoints, computeRefundMultiplier } from '../systems/rebirth/rebirthBonus'
import { formatNumber } from '../utils/format'
import { useMountTransition } from '../utils/useMountTransition'
import { Button } from './ui'

const TRANSITION_MS = 180

interface StageInfoModalProps {
  isOpen: boolean
  onClose: () => void
  onRebirthClick: () => void
}

export function StageInfoModal({ isOpen, onClose, onRebirthClick }: StageInfoModalProps) {
  const stage = useGameStore((state) => state.currentStage)
  const kills = useGameStore((state) => state.battle.kills)
  const killsRequired = useGameStore((state) => state.battle.killsRequired)
  const isBossStage = useGameStore((state) => state.battle.isBossStage)
  const reverseUnlocked = useGameStore((state) => state.specialUnlocks.reverse)
  const rebirthCount = useGameStore((state) => state.rebirthCount)
  const rebirthBonusPoint = useGameStore((state) => state.rebirthBonusPoint)
  const rebirthMaxStage = useGameStore((state) => state.rebirthMaxStage)
  const shouldRender = useMountTransition(isOpen, TRANSITION_MS)

  if (!shouldRender) return null

  const data = generateStage(stage)
  // 지금 리버스한다면 적용될 배율 미리보기 — 도달 스테이지로 얻는 포인트가 즉시 반영되는
  // RebirthModal과 동일한 기준(rebirthBonusPoint + 이번 스테이지분 pending)으로 맞춘다.
  const refundMultiplier = computeRefundMultiplier(stage, rebirthBonusPoint + computeRebirthBonusPoints(stage))

  return (
    <div
      className={`absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-6 ${
        isOpen ? 'animate-[backdrop-fade-in_180ms_ease-out]' : 'animate-[backdrop-fade-out_180ms_ease-in_forwards]'
      }`}
      onClick={onClose}
    >
      <div
        className={`panel-frame w-full max-w-xs rounded-xl border border-surface-border bg-surface-card p-4 text-text-primary ${
          isOpen ? 'animate-[modal-pop-in_180ms_ease-out]' : 'animate-[modal-pop-out_180ms_ease-in_forwards]'
        }`}
        style={{ '--panel-accent-color': 'var(--color-blue-strong)' } as CSSProperties}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-sm font-semibold text-blue-strong">
          STAGE {stageLabel(stage)}
          {isBossStage && <span className="ml-1 text-gold-strong">BOSS</span>}
        </h2>

        <dl className="mt-3 space-y-1.5 text-xs text-text-secondary">
          <div className="flex justify-between">
            <dt>{getCommonUiLabel('enemyHp')}</dt>
            <dd className="text-text-primary">{formatNumber(data.enemyHp)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>{getCommonUiLabel('enemyAtk')}</dt>
            <dd className="text-text-primary">{formatNumber(data.enemyAtk)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>{getCommonUiLabel('killProgress')}</dt>
            <dd className="text-text-primary">
              {kills} / {killsRequired}
            </dd>
          </div>
        </dl>

        <div className="mt-3 border-t border-surface-border pt-3">
          <p className="mb-1 text-[11px] text-text-secondary">{getCommonUiLabel('rewardPerKill')}</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-secondary">
            <span>{getCurrencyName('gold')} {formatNumber(data.rewards.gold)}</span>
            <span>{getCurrencyName('growthEnergy')} {formatNumber(data.rewards.growthEnergy)}</span>
            <span>{getCurrencyName('exist')} {formatNumber(data.rewards.exist)}</span>
          </div>
        </div>

        {reverseUnlocked && (
          <div className="mt-3 border-t border-surface-border pt-3">
            <p className="mb-1 text-[11px] text-text-secondary">{getRebirthBonusLabel('title')}</p>
            <dl className="space-y-1 text-xs text-text-secondary">
              <div className="flex justify-between">
                <dt>{getRebirthBonusLabel('currentCycle')}</dt>
                <dd className="text-text-primary">
                  {rebirthCount + 1}
                  {getCommonUiLabel('cycleSuffix')}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>{getRebirthBonusLabel('refundMultiplier')}</dt>
                <dd className="text-text-primary">×{refundMultiplier.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{getRebirthBonusLabel('maxStageReached')}</dt>
                <dd className="text-text-primary">{stageLabel(rebirthMaxStage)}</dd>
              </div>
            </dl>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          <div>
            {reverseUnlocked && (
              <button
                type="button"
                onClick={onRebirthClick}
                className="rounded-lg bg-grade-epic px-3 py-1.5 text-xs font-medium text-white transition-colors hover:brightness-110 active:scale-95"
              >
                {getSystemName('reverse')}
              </button>
            )}
          </div>
          <Button variant="secondary" onClick={onClose} className="px-3 py-1.5 text-xs">
            {getButtonLabel('close')}
          </Button>
        </div>
      </div>
    </div>
  )
}
