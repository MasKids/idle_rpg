import { getButtonLabel, getCommonUiLabel, getCurrencyName, getOfflineRewardUiLabel } from '../../data/uiStrings'
import { useGameStore } from '../../store/gameStore'
import { formatDuration, formatNumber } from '../../utils/format'
import { Button } from '../../components/ui'

interface OfflineRewardModalProps {
  onClaim: () => void
}

export function OfflineRewardModal({ onClaim }: OfflineRewardModalProps) {
  const reward = useGameStore((state) => state.offlineReward)

  if (!reward) return null

  const isCapped = reward.elapsedMs > reward.cappedMs

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-6">
      <div className="w-full max-w-xs rounded-xl border border-blue-strong/30 bg-surface-card p-4 text-text-primary">
        <h2 className="text-sm font-semibold text-blue-strong">{getCommonUiLabel('offlineRewardTitle')}</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">{getOfflineRewardUiLabel('description')}</p>

        <div className="mt-3 border-t border-surface-border pt-2 text-[11px] text-text-secondary">
          <div className="flex justify-between">
            <span>{getCommonUiLabel('awayTime')}</span>
            <span>
              {formatDuration(reward.elapsedMs)}
              {isCapped && (
                <span className="ml-1 text-text-disabled">
                  ({getCommonUiLabel('maxRecognizedPrefix')} {formatDuration(reward.cappedMs)}{' '}
                  {getCommonUiLabel('maxRecognizedSuffix')})
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="mt-3 border-t border-surface-border pt-2">
          <p className="mb-1 text-[10px] font-semibold text-success-strong">{getCommonUiLabel('rewardsEarned')}</p>
          <ul className="space-y-0.5 text-[11px] text-text-secondary">
            <li>{getCurrencyName('gold')} +{formatNumber(reward.rewards.gold)}</li>
            <li>{getCurrencyName('growthEnergy')} +{formatNumber(reward.rewards.growthEnergy)}</li>
            <li>{getCurrencyName('exist')} +{formatNumber(reward.rewards.exist)}</li>
          </ul>
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="primary" onClick={onClaim} className="px-4 py-1.5 text-xs">
            {getButtonLabel('claim')}
          </Button>
        </div>
      </div>
    </div>
  )
}
