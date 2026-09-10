import { stageLabel } from '../../data/stages'
import { getButtonLabel, getCommonUiLabel, getCurrencyName, getStateLabel, getSystemName } from '../../data/uiStrings'
import { computeActiveRelicEffects } from '../relic/relic'
import { useGameStore } from '../../store/gameStore'
import { formatCountdown, formatNumber } from '../../utils/format'
import { useNow } from '../../utils/useNow'
import { computeTimeHeistPreview, timeHeistCooldownEndsAt } from './timeHeist'
import { useMountTransition } from '../../utils/useMountTransition'
import { Button } from '../../components/ui'
import type { CSSProperties } from 'react'

const TRANSITION_MS = 180

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
  const activeRelics = useGameStore((state) => state.activeRelics)
  const now = useNow()
  const shouldRender = useMountTransition(isOpen, TRANSITION_MS)

  if (!shouldRender) return null

  const relicEffects = computeActiveRelicEffects(activeRelics)
  const preview = computeTimeHeistPreview(
    currentStage,
    existGain,
    usedCount,
    relicEffects.goldGainBonusPercent,
    relicEffects.timeHeistCooldownReductionPercent,
  )
  const cooldownEndsAt = timeHeistCooldownEndsAt(usedCount, lastUsedAt, relicEffects.timeHeistCooldownReductionPercent)
  const cooldownRemainingMs = cooldownEndsAt !== null ? Math.max(0, cooldownEndsAt - now) : 0
  const isOnCooldown = cooldownRemainingMs > 0
  const canAfford = timeEnergy >= preview.cost
  const canExecute = canAfford && !isOnCooldown

  return (
    <div
      className={`absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-6 ${
        isOpen ? 'animate-[backdrop-fade-in_180ms_ease-out]' : 'animate-[backdrop-fade-out_180ms_ease-in_forwards]'
      }`}
      onClick={onCancel}
    >
      <div
        className={`panel-frame w-full max-w-xs rounded-xl border border-gold-strong/30 bg-surface-card p-4 text-text-primary ${
          isOpen ? 'animate-[modal-pop-in_180ms_ease-out]' : 'animate-[modal-pop-out_180ms_ease-in_forwards]'
        }`}
        style={{ '--panel-accent-color': 'var(--color-gold-strong)' } as CSSProperties}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-sm font-semibold text-gold-strong">{getSystemName('timeHeist')}</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">
          미래 스테이지의 보상을 시간에너지로 미리 훔쳐옵니다. 스테이지 진행에는 영향을 주지 않습니다.
        </p>

        <div className="mt-3 border-t border-surface-border pt-2">
          <p className="mb-1 text-[10px] font-semibold text-gold-strong">{getCommonUiLabel('targetStage')}</p>
          <p className="text-[11px] text-text-secondary">
            {stageLabel(preview.currentStage)} → {stageLabel(preview.targetStage)} ({preview.clearCount}
            {getCommonUiLabel('clearConversion')})
          </p>
        </div>

        <div className="mt-3 border-t border-surface-border pt-2">
          <p className="mb-1 text-[10px] font-semibold text-success-strong">{getCommonUiLabel('expectedGain')}</p>
          <ul className="space-y-0.5 text-[11px] text-text-secondary">
            <li>{getCurrencyName('gold')} +{formatNumber(preview.rewards.gold)}</li>
            <li>{getCurrencyName('growthEnergy')} +{formatNumber(preview.rewards.growthEnergy)}</li>
            <li>{getCurrencyName('exist')} +{formatNumber(preview.rewards.exist)}</li>
          </ul>
        </div>

        <div className="mt-3 border-t border-surface-border pt-2 text-[11px] text-text-secondary">
          <div className="flex justify-between">
            <span>
              {getCommonUiLabel('consume')} {getCurrencyName('timeEnergy')}
            </span>
            <span className={canAfford ? 'text-text-primary' : 'text-danger-strong'}>{formatNumber(preview.cost)}</span>
          </div>
          <div className="flex justify-between">
            <span>
              {getCommonUiLabel('owned')} {getCurrencyName('timeEnergy')}
            </span>
            <span className="text-text-primary">{formatNumber(timeEnergy)}</span>
          </div>
          <div className="flex justify-between">
            <span>{getCommonUiLabel('useCount')}</span>
            <span className="text-text-primary">
              {usedCount}
              {getCommonUiLabel('timesSuffix')}
            </span>
          </div>
          <div className="flex justify-between">
            <span>{getCommonUiLabel('cooldown')}</span>
            <span className={isOnCooldown ? 'text-danger-strong' : 'text-success-strong'}>
              {isOnCooldown ? formatCountdown(cooldownRemainingMs) : getStateLabel('available')}
            </span>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} className="px-3 py-1.5 text-xs">
            {getButtonLabel('cancel')}
          </Button>
          <Button variant="gold" disabled={!canExecute} onClick={onConfirm} className="px-3 py-1.5 text-xs">
            {getButtonLabel('steal')}
          </Button>
        </div>
      </div>
    </div>
  )
}
