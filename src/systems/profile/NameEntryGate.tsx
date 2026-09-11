import { useState, type CSSProperties } from 'react'
import { Button } from '../../components/ui'
import { getButtonLabel, getProfileUiLabel } from '../../data/uiStrings'
import { DEFAULT_PLAYER_NAME, useGameStore } from '../../store/gameStore'
import { wasSaveResetOnLoad } from '../../store/gameStateStorage'
import { isValidPlayerName, normalizePlayerName } from './playerName'

// 세이브가 이번 로드에서 초기화됐는지는 앱 부팅(모듈 로드) 시점에 한 번만 정해지고
// 세션 내내 바뀌지 않는다 — 컴포넌트 state로 옮길 필요 없이 상수로 캡처해둔다.
const SHOW_RESET_NOTICE = wasSaveResetOnLoad()

// 새 게임(또는 세이브 초기화 직후) 진입 시 이름을 반드시 입력하게 막는 화면.
// playerName이 아직 기본값(DEFAULT_PLAYER_NAME)인 동안에만 렌더링되고, 이름을
// 정하고 나면 다시 렌더링되지 않는다 — 별도의 "이름을 입력했는지" 플래그가 없다.
// App.tsx가 이 컴포넌트를 WelcomeOnboarding보다 먼저 배치해 순서를 보장한다.
export function NameEntryGate() {
  const playerName = useGameStore((state) => state.playerName)
  const setPlayerName = useGameStore((state) => state.setPlayerName)
  const [noticeAcknowledged, setNoticeAcknowledged] = useState(false)
  const [draft, setDraft] = useState('')
  const [showError, setShowError] = useState(false)

  if (playerName !== DEFAULT_PLAYER_NAME) return null

  const showNotice = SHOW_RESET_NOTICE && !noticeAcknowledged

  const handleSubmit = () => {
    const normalized = normalizePlayerName(draft)
    if (!isValidPlayerName(normalized)) {
      setShowError(true)
      return
    }
    setPlayerName(normalized)
  }

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-6 animate-[backdrop-fade-in_180ms_ease-out]">
      <div
        className="panel-frame w-full max-w-xs rounded-xl border border-surface-border bg-surface-card p-5 text-text-primary animate-[modal-pop-in_180ms_ease-out]"
        style={{ '--panel-accent-color': 'var(--color-blue-strong)' } as CSSProperties}
      >
        {showNotice ? (
          <div key="notice" className="animate-[panel-fade-in_200ms_ease-out]">
            <h2 className="text-base font-semibold text-blue-strong">{getProfileUiLabel('resetNoticeTitle')}</h2>
            <p className="mt-2 text-xs leading-relaxed text-text-secondary">{getProfileUiLabel('resetNoticeBody')}</p>
            <Button variant="primary" onClick={() => setNoticeAcknowledged(true)} className="mt-5 w-full">
              {getButtonLabel('confirm')}
            </Button>
          </div>
        ) : (
          <div key="name-entry" className="animate-[panel-fade-in_200ms_ease-out]">
            <h2 className="text-base font-semibold text-blue-strong">{getProfileUiLabel('nameEntryTitle')}</h2>
            <p className="mt-2 text-xs leading-relaxed text-text-secondary">{getProfileUiLabel('nameEntryBody')}</p>
            <input
              type="text"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value)
                if (showError) setShowError(false)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleSubmit()
              }}
              placeholder={getProfileUiLabel('nameEntryPlaceholder')}
              maxLength={20}
              autoFocus
              className="mt-4 w-full rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-sm text-text-primary outline-none focus:border-blue-strong"
            />
            {showError && <p className="mt-1.5 text-[11px] text-danger-strong">{getProfileUiLabel('nameEntryError')}</p>}
            <Button variant="primary" onClick={handleSubmit} className="mt-4 w-full">
              {getButtonLabel('start')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
