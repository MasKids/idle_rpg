import { stageLabel } from '../../data/stages'
import { useGameStore } from '../../store/gameStore'
import { formatCountdown, formatNumber } from '../../utils/format'
import { useNow } from '../../utils/useNow'
import { computeTimeHeistPreview, timeHeistCooldownEndsAt } from './timeHeist'

interface TimeHeistModalProps {
  isOpen: boolean
  onCancel: () => void
  onConfirm: () => void
}

export function TimeHeistModal({ isOpen, onCancel, onConfirm }: TimeHeistModalProps) {
  const currentStage = useGameStore((state) => state.currentStage)
  const existGain = useGameStore((state) => state.stats.existGain)
  const timeEnergy = useGameStore((state) => state.currencies.timeEnergy)
  const usedCount = useGameStore((state) => state.timeHeistUsedCount)
  const lastUsedAt = useGameStore((state) => state.timeHeistLastUsedAt)
  const now = useNow()

  if (!isOpen) return null

  const preview = computeTimeHeistPreview(currentStage, existGain, usedCount)
  const cooldownEndsAt = timeHeistCooldownEndsAt(usedCount, lastUsedAt)
  const cooldownRemainingMs = cooldownEndsAt !== null ? Math.max(0, cooldownEndsAt - now) : 0
  const isOnCooldown = cooldownRemainingMs > 0
  const canAfford = timeEnergy >= preview.cost
  const canExecute = canAfford && !isOnCooldown

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-6"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-xs rounded-xl border border-amber-400/30 bg-slate-900 p-4 text-white"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-sm font-semibold text-amber-300">타임 하이스트</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-white/60">
          미래 스테이지의 보상을 시간에너지로 미리 훔쳐옵니다. 스테이지 진행에는 영향을 주지 않습니다.
        </p>

        <div className="mt-3 border-t border-white/10 pt-2">
          <p className="mb-1 text-[10px] font-semibold text-amber-300">대상 스테이지</p>
          <p className="text-[11px] text-white/70">
            {stageLabel(preview.currentStage)} → {stageLabel(preview.targetStage)} ({preview.clearCount}클리어 환산)
          </p>
        </div>

        <div className="mt-3 border-t border-white/10 pt-2">
          <p className="mb-1 text-[10px] font-semibold text-emerald-300">획득 예정</p>
          <ul className="space-y-0.5 text-[11px] text-white/70">
            <li>골드 +{formatNumber(preview.rewards.gold)}</li>
            <li>성장에너지 +{formatNumber(preview.rewards.growthEnergy)}</li>
            <li>존재력 +{formatNumber(preview.rewards.exist)}</li>
          </ul>
        </div>

        <div className="mt-3 border-t border-white/10 pt-2 text-[11px] text-white/70">
          <div className="flex justify-between">
            <span>소모 시간에너지</span>
            <span className={canAfford ? 'text-white' : 'text-red-400'}>{formatNumber(preview.cost)}</span>
          </div>
          <div className="flex justify-between">
            <span>보유 시간에너지</span>
            <span>{formatNumber(timeEnergy)}</span>
          </div>
          <div className="flex justify-between">
            <span>사용 횟수</span>
            <span>{usedCount}회</span>
          </div>
          <div className="flex justify-between">
            <span>쿨타임</span>
            <span className={isOnCooldown ? 'text-red-400' : 'text-emerald-300'}>
              {isOnCooldown ? formatCountdown(cooldownRemainingMs) : '사용 가능'}
            </span>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white"
          >
            취소
          </button>
          <button
            type="button"
            disabled={!canExecute}
            onClick={onConfirm}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
              canExecute ? 'bg-amber-500 text-amber-950' : 'cursor-not-allowed bg-white/10 text-white/30'
            }`}
          >
            강탈
          </button>
        </div>
      </div>
    </div>
  )
}
