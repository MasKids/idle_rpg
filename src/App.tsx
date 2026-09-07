import { useState } from 'react'
import { BattleArea } from './components/BattleArea'
import { BottomMenu } from './components/BottomMenu'
import { ControlArea } from './components/ControlArea'
import { StageInfoModal } from './components/StageInfoModal'
import { StubPanel } from './components/StubPanel'
import { ExistTreePanel } from './systems/exist/ExistTreePanel'
import type { TabKey } from './types/game'

const FULLSCREEN_TABS: TabKey[] = ['gacha', 'exist', 'dogam']

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('growth')
  const [isStageInfoOpen, setStageInfoOpen] = useState(false)
  const goBack = () => setActiveTab('growth')

  const isFullscreen = FULLSCREEN_TABS.includes(activeTab)

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

        <StageInfoModal isOpen={isStageInfoOpen} onClose={() => setStageInfoOpen(false)} />
      </div>
    </div>
  )
}

export default App
