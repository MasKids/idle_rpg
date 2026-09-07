import { useEffect, useState } from 'react'
import { BattleArea } from './components/BattleArea'
import { BottomMenu } from './components/BottomMenu'
import { ControlArea } from './components/ControlArea'
import { StageInfoModal } from './components/StageInfoModal'
import { StubPanel } from './components/StubPanel'
import { startBattleLoop } from './systems/battle/battleLoop'
import { ExistTreePanel } from './systems/exist/ExistTreePanel'
import { RebirthModal } from './systems/rebirth/RebirthModal'
import { useGameStore } from './store/gameStore'
import type { TabKey } from './types/game'

const FULLSCREEN_TABS: TabKey[] = ['gacha', 'exist', 'dogam']

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('growth')
  const [isStageInfoOpen, setStageInfoOpen] = useState(false)
  const [isRebirthModalOpen, setRebirthModalOpen] = useState(false)
  const [rebirthFlashKey, setRebirthFlashKey] = useState(0)
  const executeRebirth = useGameStore((state) => state.executeRebirth)
  const goBack = () => setActiveTab('growth')

  // 전투 루프는 App이 살아있는 한(탭 전환/화면 이동과 무관하게) 단 한 번만 시작된다.
  useEffect(() => {
    startBattleLoop()
  }, [])

  const isFullscreen = FULLSCREEN_TABS.includes(activeTab)

  const handleRebirthConfirm = () => {
    executeRebirth()
    setRebirthModalOpen(false)
    setStageInfoOpen(false)
    setRebirthFlashKey((key) => key + 1)
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-black">
      <div className="relative flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-slate-950 sm:h-[900px] sm:max-h-[95dvh] sm:rounded-2xl sm:border sm:border-white/10 sm:shadow-2xl">
        {isFullscreen ? (
          <>
            {activeTab === 'gacha' && <StubPanel title="가챠" onBack={goBack} />}
            {activeTab === 'dogam' && <StubPanel title="도감" onBack={goBack} />}
            {activeTab === 'exist' && <ExistTreePanel onBack={goBack} />}
          </>
        ) : (
          <>
            <BattleArea onStageInfoClick={() => setStageInfoOpen(true)} />
            <ControlArea activeTab={activeTab} />
          </>
        )}

        <BottomMenu activeTab={activeTab} onSelect={setActiveTab} />

        <StageInfoModal
          isOpen={isStageInfoOpen}
          onClose={() => setStageInfoOpen(false)}
          onRebirthClick={() => setRebirthModalOpen(true)}
        />

        <RebirthModal
          isOpen={isRebirthModalOpen}
          onCancel={() => setRebirthModalOpen(false)}
          onConfirm={handleRebirthConfirm}
        />

        {rebirthFlashKey > 0 && (
          <div
            key={rebirthFlashKey}
            className="pointer-events-none absolute inset-0 z-40 animate-[rebirth-flash_0.8s_ease-out_forwards] bg-white"
          />
        )}
      </div>
    </div>
  )
}

export default App
