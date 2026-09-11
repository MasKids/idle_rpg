import { Pencil } from 'lucide-react'
import { useState } from 'react'
import { Button, Modal } from '../../components/ui'
import { getButtonLabel, getCommonUiLabel, getProfileUiLabel, getRankingUiLabel } from '../../data/uiStrings'
import { useGameStore } from '../../store/gameStore'
import { formatDuration } from '../../utils/format'
import { isValidPlayerName, normalizePlayerName } from './playerName'

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
}

// 전투 화면 좌상단 프로필 칩을 눌러 여는 패널. 이름 표시 + 연필 아이콘으로 수정,
// 참고용 프로필 정보(총 플레이 시간·리버스 횟수) 몇 가지를 함께 보여준다.
export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const playerName = useGameStore((state) => state.playerName)
  const setPlayerName = useGameStore((state) => state.setPlayerName)
  const totalPlayTime = useGameStore((state) => state.totalPlayTime)
  const rebirthCount = useGameStore((state) => state.rebirthCount)

  const [isEditing, setEditing] = useState(false)
  const [draft, setDraft] = useState(playerName)
  const [showError, setShowError] = useState(false)

  const startEdit = () => {
    setDraft(playerName)
    setShowError(false)
    setEditing(true)
  }

  const handleSave = () => {
    const normalized = normalizePlayerName(draft)
    if (!isValidPlayerName(normalized)) {
      setShowError(true)
      return
    }
    setPlayerName(normalized)
    setEditing(false)
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={getProfileUiLabel('profileTitle')}
      footer={
        <Button variant="secondary" onClick={onClose} className="px-3 py-1.5 text-xs">
          {getButtonLabel('close')}
        </Button>
      }
    >
      <div className="space-y-3">
        <div>
          <p className="text-[10px] text-text-disabled">{getRankingUiLabel('columnName')}</p>
          {isEditing ? (
            <div className="mt-1">
              <input
                type="text"
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value)
                  if (showError) setShowError(false)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleSave()
                }}
                maxLength={20}
                autoFocus
                className="w-full rounded-lg border border-surface-border bg-surface-elevated px-3 py-1.5 text-sm text-text-primary outline-none focus:border-blue-strong"
              />
              {showError && <p className="mt-1 text-[11px] text-danger-strong">{getProfileUiLabel('nameEntryError')}</p>}
              <div className="mt-2 flex justify-end gap-1.5">
                <Button variant="secondary" onClick={() => setEditing(false)} className="px-3 py-1 text-xs">
                  {getButtonLabel('cancel')}
                </Button>
                <Button variant="primary" onClick={handleSave} className="px-3 py-1 text-xs">
                  {getButtonLabel('confirm')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-1 flex items-center gap-1.5">
              <span className="text-sm font-medium text-text-primary">{playerName}</span>
              <button
                type="button"
                onClick={startEdit}
                aria-label={getProfileUiLabel('editName')}
                className="rounded-md p-1 text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-primary"
              >
                <Pencil size={12} strokeWidth={2} />
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-between border-t border-surface-border pt-3 text-xs text-text-secondary">
          <span>{getProfileUiLabel('profileTotalPlayTime')}</span>
          <span className="text-text-primary">{formatDuration(totalPlayTime * 1000)}</span>
        </div>
        <div className="flex justify-between text-xs text-text-secondary">
          <span>{getRankingUiLabel('columnRebirthCount')}</span>
          <span className="text-text-primary">
            {rebirthCount}
            {getCommonUiLabel('cycleSuffix')}
          </span>
        </div>
      </div>
    </Modal>
  )
}
