import { useEffect, useState } from 'react'
import { BattleArea } from './components/BattleArea'
import { BottomMenu } from './components/BottomMenu'
import { ControlArea } from './components/ControlArea'
import { DevPanel } from './components/DevPanel'
import { DesignSystemPreview } from './dev/DesignSystemPreview'
import { StageInfoModal } from './components/StageInfoModal'
import { StubPanel } from './components/StubPanel'
import { startBattleLoop } from './systems/battle/battleLoop'
import { OfflineRewardModal } from './systems/battle/OfflineRewardModal'
import { getTabName } from './data/uiStrings'
import { ExistTreePanel } from './systems/exist/ExistTreePanel'
import { RebirthModal } from './systems/rebirth/RebirthModal'
import { TimeHeistModal } from './systems/timeheist/TimeHeistModal'
import { SummonPanel } from './systems/gacha/SummonPanel'
import { WeaponStoragePanel } from './systems/weapon/WeaponStoragePanel'
import { WelcomeOnboarding } from './systems/onboarding/WelcomeOnboarding'
import { useGameStore } from './store/gameStore'
import type { TabKey } from './types/game'

const FULLSCREEN_TABS: TabKey[] = ['equipment', 'gacha', 'exist', 'dogam']

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('growth')
  const [isStageInfoOpen, setStageInfoOpen] = useState(false)
  const [isRebirthModalOpen, setRebirthModalOpen] = useState(false)
  const [rebirthFlashKey, setRebirthFlashKey] = useState(0)
  const [isTimeHeistModalOpen, setTimeHeistModalOpen] = useState(false)
  const [timeHeistFlashKey, setTimeHeistFlashKey] = useState(0)
  const [isDesignSystemOpen, setDesignSystemOpen] = useState(false)
  const executeRebirth = useGameStore((state) => state.executeRebirth)
  const executeTimeHeist = useGameStore((state) => state.executeTimeHeist)
  const claimOfflineReward = useGameStore((state) => state.claimOfflineReward)
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

  const handleTimeHeistConfirm = () => {
    if (executeTimeHeist()) {
      setTimeHeistFlashKey((key) => key + 1)
    }
    setTimeHeistModalOpen(false)
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-black">
      <div className="relative flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-slate-950 sm:h-[900px] sm:max-h-[95dvh] sm:rounded-2xl sm:border sm:border-white/10 sm:shadow-2xl">
        {isFullscreen ? (
          <div className="flex min-h-0 flex-1 flex-col animate-[panel-fade-in_200ms_ease-out]">
            {activeTab === 'equipment' && <WeaponStoragePanel onBack={goBack} />}
            {activeTab === 'gacha' && <SummonPanel onBack={goBack} />}
            {activeTab === 'dogam' && <StubPanel title={getTabName('dogam')} onBack={goBack} />}
            {activeTab === 'exist' && <ExistTreePanel onBack={goBack} />}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col animate-[panel-fade-in_200ms_ease-out]">
            <BattleArea
              onStageInfoClick={() => setStageInfoOpen(true)}
              onTimeHeistClick={() => setTimeHeistModalOpen(true)}
            />
            <ControlArea activeTab={activeTab} />
          </div>
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

        <TimeHeistModal
          isOpen={isTimeHeistModalOpen}
          onCancel={() => setTimeHeistModalOpen(false)}
          onConfirm={handleTimeHeistConfirm}
        />

        <OfflineRewardModal onClaim={claimOfflineReward} />

        {rebirthFlashKey > 0 && (
          <div
            key={`rebirth-${rebirthFlashKey}`}
            className="pointer-events-none absolute inset-0 z-40 animate-[rebirth-flash_0.8s_ease-out_forwards] bg-white"
          />
        )}

        {timeHeistFlashKey > 0 && (
          <div
            key={`timeheist-${timeHeistFlashKey}`}
            className="pointer-events-none absolute inset-0 z-40 animate-[time-warp_0.7s_ease-out_forwards] bg-gold-strong"
          />
        )}

        <WelcomeOnboarding />

        {import.meta.env.DEV && <DevPanel onOpenDesignSystem={() => setDesignSystemOpen(true)} />}
        {import.meta.env.DEV && isDesignSystemOpen && (
          <DesignSystemPreview onClose={() => setDesignSystemOpen(false)} />
        )}
      </div>
    </div>
  )
}

export default App
