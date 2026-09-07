import { generateStage, stageLabel } from '../data/stages'
import { useGameStore } from '../store/gameStore'

interface StageInfoModalProps {
  isOpen: boolean
  onClose: () => void
}

export function StageInfoModal({ isOpen, onClose }: StageInfoModalProps) {
  const stage = useGameStore((state) => state.currentStage)
  const kills = useGameStore((state) => state.battle.kills)
  const killsRequired = useGameStore((state) => state.battle.killsRequired)
  const isBossStage = useGameStore((state) => state.battle.isBossStage)
  const reverseUnlocked = useGameStore((state) => state.specialUnlocks.reverse)

  if (!isOpen) return null

  const data = generateStage(stage)

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
            <dd className="text-white">{data.enemyHp}</dd>
          </div>
          <div className="flex justify-between">
            <dt>적 공격력</dt>
            <dd className="text-white">{data.enemyAtk}</dd>
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
            <span>골드 {data.rewards.gold}</span>
            <span>성장에너지 {data.rewards.growthEnergy}</span>
            <span>존재력 {data.rewards.exist}</span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <div>
            {reverseUnlocked && (
              <button
                type="button"
                className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-medium text-white"
              >
                리버스
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
