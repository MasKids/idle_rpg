import { useEffect, useState } from 'react'
import { SYSTEM_ICON } from '../../components/icons'
import { Button, EmptyState, Modal } from '../../components/ui'
import { stageLabel } from '../../data/stages'
import { getButtonLabel, getCommonUiLabel, getRankingUiLabel } from '../../data/uiStrings'
import { IntroBanner } from '../onboarding/IntroBanner'
import { SYSTEM_INTRO_LINES } from '../onboarding/onboardingContent'
import { useGameStore } from '../../store/gameStore'
import { formatDuration } from '../../utils/format'
import { fetchRankings, type RankingRow } from './ranking'

interface RankingModalProps {
  isOpen: boolean
  onClose: () => void
}

type Status = 'loading' | 'error' | 'success'

function RankingListRow({ row, isSelf }: { row: RankingRow; isSelf: boolean }) {
  return (
    <div
      className={`grid grid-cols-[24px_1fr_auto] items-center gap-x-2 gap-y-0.5 rounded-lg px-2 py-1.5 ${
        isSelf ? 'bg-blue-soft ring-1 ring-blue-strong/50' : ''
      }`}
    >
      <span className={`text-right text-xs font-semibold tabular-nums ${isSelf ? 'text-blue-strong' : 'text-text-secondary'}`}>
        {row.rank}
      </span>
      <span className={`truncate text-xs font-medium ${isSelf ? 'text-blue-strong' : 'text-text-primary'}`}>
        {row.playerName}
      </span>
      <span className={`text-xs font-semibold tabular-nums ${isSelf ? 'text-blue-strong' : 'text-text-primary'}`}>
        {stageLabel(row.maxStage)}
      </span>
      <span />
      <span className="col-span-2 truncate text-[10px] text-text-disabled">
        {getRankingUiLabel('columnPlayTime')} {formatDuration(row.playTime * 1000)} ·{' '}
        {getRankingUiLabel('columnRebirthCount')} {row.rebirthCount}
        {getCommonUiLabel('cycleSuffix')}
      </span>
    </div>
  )
}

export function RankingModal({ isOpen, onClose }: RankingModalProps) {
  const playerName = useGameStore((state) => state.playerName)
  const [status, setStatus] = useState<Status>('loading')
  const [top, setTop] = useState<RankingRow[]>([])
  const [ownEntry, setOwnEntry] = useState<RankingRow | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const RankingIcon = SYSTEM_ICON.ranking

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setStatus('loading')
    fetchRankings(playerName)
      .then((result) => {
        if (cancelled) return
        setTop(result.top)
        setOwnEntry(result.ownEntry)
        setStatus('success')
      })
      .catch(() => {
        if (cancelled) return
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, playerName, reloadKey])

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={getRankingUiLabel('title')}
      footer={
        <Button variant="secondary" onClick={onClose} className="px-3 py-1.5 text-xs">
          {getButtonLabel('close')}
        </Button>
      }
    >
      <IntroBanner
        storageKey="intro-ranking"
        title={getRankingUiLabel('title')}
        lines={SYSTEM_INTRO_LINES.ranking}
        accentColorVar="var(--color-blue-strong)"
        className="mb-3"
      />

      {status === 'loading' && (
        <div className="py-8 text-center text-xs text-text-secondary">{getRankingUiLabel('loading')}</div>
      )}

      {status === 'error' && (
        <div className="flex flex-col items-center gap-3">
          <EmptyState icon={<RankingIcon size={28} strokeWidth={1.5} />} message={getRankingUiLabel('errorTitle')} />
          <Button variant="secondary" onClick={() => setReloadKey((key) => key + 1)} className="px-3 py-1.5 text-xs">
            {getRankingUiLabel('retry')}
          </Button>
        </div>
      )}

      {status === 'success' && top.length === 0 && (
        <EmptyState icon={<RankingIcon size={28} strokeWidth={1.5} />} message={getRankingUiLabel('empty')} />
      )}

      {status === 'success' && top.length > 0 && (
        <>
          <div className="grid grid-cols-[24px_1fr_auto] gap-x-2 px-2 text-[10px] text-text-disabled">
            <span className="text-right">{getRankingUiLabel('columnRank')}</span>
            <span>{getRankingUiLabel('columnName')}</span>
            <span>{getRankingUiLabel('columnMaxStage')}</span>
          </div>
          <div className="mt-1 max-h-64 space-y-0.5 overflow-y-auto">
            {top.map((row) => (
              <RankingListRow key={row.id} row={row} isSelf={row.playerName === playerName} />
            ))}
          </div>

          {ownEntry && (
            <div className="mt-2 border-t border-surface-border pt-2">
              <p className="mb-1 px-2 text-[10px] text-text-disabled">{getRankingUiLabel('myRecord')}</p>
              <RankingListRow row={ownEntry} isSelf />
            </div>
          )}
        </>
      )}
    </Modal>
  )
}
