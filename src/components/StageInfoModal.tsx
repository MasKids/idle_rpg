import { generateStage, stageLabel } from '../data/stages'
import { getButtonLabel, getCurrencyName, getRebirthBonusLabel, getSystemName } from '../data/uiStrings'
import { useGameStore } from '../store/gameStore'
import { computeAllStatBonusPercent } from '../systems/rebirth/rebirthBonus'
import { formatNumber } from '../utils/format'

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

  if (!isOpen) return null

  const data = generateStage(stage)
  const bonusPercent = computeAllStatBonusPercent(rebirthBonusPoint)

  return (
    <div
      className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs rounded-xl border border-white/10 bg-slate-900 p-4 text-white"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-sm font-semibold text-blue-300">
          STAGE {stageLabel(stage)}
          {isBossStage && <span className="ml-1 text-amber-400">BOSS</span>}
        </h2>

        <dl className="mt-3 space-y-1.5 text-xs text-white/70">
          <div className="flex justify-between">
            <dt>적 HP</dt>
            <dd className="text-white">{formatNumber(data.enemyHp)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>적 공격력</dt>
            <dd className="text-white">{formatNumber(data.enemyAtk)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>처치 진행도</dt>
            <dd className="text-white">
              {kills} / {killsRequired}
            </dd>
          </div>
        </dl>

        <div className="mt-3 border-t border-white/10 pt-3">
          <p className="mb-1 text-[11px] text-white/50">스테이지 보상 (처치당)</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/70">
            <span>{getCurrencyName('gold')} {formatNumber(data.rewards.gold)}</span>
            <span>{getCurrencyName('growthEnergy')} {formatNumber(data.rewards.growthEnergy)}</span>
            <span>{getCurrencyName('exist')} {formatNumber(data.rewards.exist)}</span>
          </div>
        </div>

        {reverseUnlocked && (
          <div className="mt-3 border-t border-white/10 pt-3">
            <p className="mb-1 text-[11px] text-white/50">{getRebirthBonusLabel('title')}</p>
            <dl className="space-y-1 text-xs text-white/70">
              <div className="flex justify-between">
                <dt>{getRebirthBonusLabel('currentCycle')}</dt>
                <dd className="text-white">{rebirthCount + 1}회차</dd>
              </div>
              <div className="flex justify-between">
                <dt>{getRebirthBonusLabel('allStatBonus')}</dt>
                <dd className="text-white">+{bonusPercent.toFixed(1)}%</dd>
              </div>
              <div className="flex justify-between">
                <dt>{getRebirthBonusLabel('maxStageReached')}</dt>
                <dd className="text-white">{stageLabel(rebirthMaxStage)}</dd>
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
                className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white"
              >
                {getSystemName('reverse')}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white"
          >
            {getButtonLabel('close')}
          </button>
        </div>
      </div>
    </div>
  )
}
