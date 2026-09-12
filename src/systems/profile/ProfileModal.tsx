import { ChevronRight, Pencil } from 'lucide-react'
import { useEffect, useState } from 'react'
import { BALANCE_TABLES } from '../../data/balance'
import { Button, Modal } from '../../components/ui'
import { getButtonLabel, getCommonUiLabel, getProfileUiLabel, getRankingUiLabel } from '../../data/uiStrings'
import { audioManager, type AudioSettings } from '../../lib/audio'
import { useNumericNotice } from '../onboarding/useNumericNotice'
import { useGameStore } from '../../store/gameStore'
import { formatDuration } from '../../utils/format'
import { isValidPlayerName, normalizePlayerName } from './playerName'

// audioManager는 React 밖의 싱글턴이라 값이 바뀔 때마다 onSettingsChange로
// 알려줘야 리렌더된다(localStorage 자체는 읽지 않고 항상 audioManager를
// 단일 소스로 삼는다 — 다른 화면에서 바꿔도 여기 슬라이더가 어긋나지 않음).
function useAudioSettings(): AudioSettings {
  const [settings, setSettings] = useState(() => audioManager.getSettings())
  useEffect(() => audioManager.onSettingsChange(setSettings), [])
  return settings
}

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
  onPatchNoteClick: () => void
}

// 전투 화면 좌상단 프로필 칩을 눌러 여는 패널. 이름 표시 + 연필 아이콘으로 수정,
// 참고용 프로필 정보(총 플레이 시간·리버스 횟수), 패치노트 진입을 함께 담는다.
export function ProfileModal({ isOpen, onClose, onPatchNoteClick }: ProfileModalProps) {
  const playerName = useGameStore((state) => state.playerName)
  const setPlayerName = useGameStore((state) => state.setPlayerName)
  const totalPlayTime = useGameStore((state) => state.totalPlayTime)
  const rebirthCount = useGameStore((state) => state.rebirthCount)
  // 패치노트 항목 수가 마지막으로 열어본 시점보다 늘었으면(=새 버전이 나왔으면) 점 표시.
  const patchNoteNotice = useNumericNotice('patch-note-count', BALANCE_TABLES.PatchNoteTable.length)

  const [isEditing, setEditing] = useState(false)
  const [draft, setDraft] = useState(playerName)
  const [showError, setShowError] = useState(false)
  const audioSettings = useAudioSettings()

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

        <div className="space-y-2 border-t border-surface-border pt-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-text-secondary">{getProfileUiLabel('settingsTitle')}</span>
            <button type="button" onClick={() => audioManager.setMuted(!audioSettings.muted)} className="flex items-center gap-1.5">
              <span className="text-[10px] text-text-disabled">{getProfileUiLabel('muteAll')}</span>
              <span
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                  audioSettings.muted ? 'bg-surface-card' : 'bg-blue-base'
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                    audioSettings.muted ? 'translate-x-0' : 'translate-x-4'
                  }`}
                />
              </span>
            </button>
          </div>

          <label className="flex items-center gap-2 text-[11px] text-text-secondary">
            <span className="w-14 shrink-0">{getProfileUiLabel('bgmVolume')}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(audioSettings.bgmVolume * 100)}
              onChange={(event) => audioManager.setBgmVolume(Number(event.target.value) / 100)}
              className="h-1.5 flex-1 accent-blue-base"
            />
            <span className="w-8 shrink-0 text-right text-text-primary">{Math.round(audioSettings.bgmVolume * 100)}%</span>
          </label>

          <label className="flex items-center gap-2 text-[11px] text-text-secondary">
            <span className="w-14 shrink-0">{getProfileUiLabel('sfxVolume')}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(audioSettings.sfxVolume * 100)}
              onChange={(event) => audioManager.setSfxVolume(Number(event.target.value) / 100)}
              className="h-1.5 flex-1 accent-blue-base"
            />
            <span className="w-8 shrink-0 text-right text-text-primary">{Math.round(audioSettings.sfxVolume * 100)}%</span>
          </label>
        </div>

        <button
          type="button"
          onClick={() => {
            patchNoteNotice.acknowledge()
            onPatchNoteClick()
          }}
          className="flex w-full items-center justify-between rounded-lg border border-surface-border bg-surface-elevated px-3 py-2 text-xs text-text-primary transition-colors hover:bg-surface-border"
        >
          <span className="flex items-center gap-1.5">
            {getProfileUiLabel('patchNoteTitle')}
            {patchNoteNotice.hasNotice && <span className="h-1.5 w-1.5 rounded-full bg-danger-strong" />}
          </span>
          <ChevronRight size={14} className="text-text-secondary" />
        </button>
      </div>
    </Modal>
  )
}
