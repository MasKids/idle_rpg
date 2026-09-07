import { useGameStore } from '../../store/gameStore'
import { formatDuration, formatNumber } from '../../utils/format'

interface OfflineRewardModalProps {
  onClaim: () => void
}

export function OfflineRewardModal({ onClaim }: OfflineRewardModalProps) {
  const reward = useGameStore((state) => state.offlineReward)

  if (!reward) return null

  const isCapped = reward.elapsedMs > reward.cappedMs

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-6">
      <div className="w-full max-w-xs rounded-xl border border-blue-400/30 bg-slate-900 p-4 text-white">
        <h2 className="text-sm font-semibold text-blue-300">오프라인 보상</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-white/60">
          자리를 비운 동안 전투가 계속된 것으로 계산해 보상을 지급합니다.
        </p>

        <div className="mt-3 border-t border-white/10 pt-2 text-[11px] text-white/70">
          <div className="flex justify-between">
            <span>비운 시간</span>
            <span>
              {formatDuration(reward.elapsedMs)}
              {isCapped && <span className="ml-1 text-white/40">(최대 {formatDuration(reward.cappedMs)} 인정)</span>}
            </span>
          </div>
        </div>

        <div className="mt-3 border-t border-white/10 pt-2">
          <p className="mb-1 text-[10px] font-semibold text-emerald-300">획득 재화</p>
          <ul className="space-y-0.5 text-[11px] text-white/70">
            <li>골드 +{formatNumber(reward.rewards.gold)}</li>
            <li>성장에너지 +{formatNumber(reward.rewards.growthEnergy)}</li>
            <li>존재력 +{formatNumber(reward.rewards.exist)}</li>
          </ul>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClaim}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-medium text-white"
          >
            받기
          </button>
        </div>
      </div>
    </div>
  )
}
