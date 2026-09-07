import { useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { clearGameState, disableAutosave } from '../store/gameStateStorage'

// 개발 모드 전용 테스트 도구. App.tsx에서 import.meta.env.DEV일 때만 렌더링된다.
export function DevPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [unlockCount, setUnlockCount] = useState(33)
  const addCurrency = useGameStore((state) => state.addCurrency)
  const unlockNextExistNode = useGameStore((state) => state.unlockNextExistNode)
  const resetTimeHeistCooldown = useGameStore((state) => state.resetTimeHeistCooldown)
  const resetTimeHeistUsedCount = useGameStore((state) => state.resetTimeHeistUsedCount)

  const handleUnlockNodes = () => {
    for (let i = 0; i < unlockCount; i++) {
      if (!unlockNextExistNode()) break
    }
  }

  const handleFullReset = () => {
    disableAutosave()
    clearGameState()
    window.location.reload()
  }

  return (
    <div className="absolute right-2 top-16 z-50">
      {isOpen && (
        <div className="absolute right-0 top-9 w-60 rounded-lg border border-white/10 bg-slate-900/95 p-2 shadow-xl">
          <p className="mb-2 text-[10px] font-semibold text-white/50">개발자 도구</p>

          <button
            type="button"
            onClick={() => addCurrency('exist', 100_000)}
            className="mb-1 w-full rounded bg-white/10 px-2 py-1 text-left text-[11px] text-white hover:bg-white/20"
          >
            EXIST +100,000
          </button>

          <button
            type="button"
            onClick={() => addCurrency('timeEnergy', 1_000)}
            className="mb-1 w-full rounded bg-white/10 px-2 py-1 text-left text-[11px] text-white hover:bg-white/20"
          >
            시간에너지 +1,000
          </button>

          <div className="mb-1 flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={50}
              value={unlockCount}
              onChange={(event) => setUnlockCount(Number(event.target.value))}
              className="w-12 rounded bg-white/10 px-1 py-1 text-[11px] text-white"
            />
            <button
              type="button"
              onClick={handleUnlockNodes}
              className="flex-1 rounded bg-white/10 px-2 py-1 text-[11px] text-white hover:bg-white/20"
            >
              노드 N개 해금
            </button>
          </div>

          <button
            type="button"
            onClick={resetTimeHeistCooldown}
            className="mb-1 w-full rounded bg-white/10 px-2 py-1 text-left text-[11px] text-white hover:bg-white/20"
          >
            타임 하이스트 쿨타임 초기화
          </button>

          <button
            type="button"
            onClick={resetTimeHeistUsedCount}
            className="mb-1 w-full rounded bg-white/10 px-2 py-1 text-left text-[11px] text-white hover:bg-white/20"
          >
            타임 하이스트 사용 횟수 초기화
          </button>

          <button
            type="button"
            onClick={handleFullReset}
            className="w-full rounded bg-red-500/20 px-2 py-1 text-left text-[11px] text-red-300 hover:bg-red-500/30"
          >
            전체 상태 초기화
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-sm backdrop-blur-sm"
      >
        🛠️
      </button>
    </div>
  )
}
