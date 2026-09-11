import type { CSSProperties, ReactNode } from 'react'
import { BALANCE_TABLES, getRebirthRewardRow, type RebirthRewardTableRow } from '../../data/balance'
import type { CurrencyKey } from '../../types/game'
import { EXIST_TREE_TOTAL_NODES } from '../../data/existTree'
import { getButtonLabel, getCurrencyName, getRebirthBonusLabel, getRebirthUiLabel, getSystemName } from '../../data/uiStrings'
import { useGameStore } from '../../store/gameStore'
import { computeRebirthCountMultiplier } from './rebirthBonus'
import { formatNumber } from '../../utils/format'
import { useMountTransition } from '../../utils/useMountTransition'
import { Button } from '../../components/ui'
import { IntroBanner } from '../onboarding/IntroBanner'
import { SYSTEM_INTRO_LINES } from '../onboarding/onboardingContent'

const TRANSITION_MS = 180

interface RebirthModalProps {
  isOpen: boolean
  onCancel: () => void
  onConfirm: () => void
}

function formatMultiplier(value: number): string {
  return `×${value.toFixed(2)}`
}

// RebirthRewardTable의 마지막 구간은 StageTo가 사실상 무한대(999999)를 가리키는
// 관례라 그대로 보여주면 어색해서 "200+"처럼 열린 구간으로 표시한다.
function formatStageBracket(row: RebirthRewardTableRow): string {
  return row.StageTo >= 999999 ? `${row.StageFrom}+` : `${row.StageFrom}~${row.StageTo}`
}

export function RebirthModal({ isOpen, onCancel, onConfirm }: RebirthModalProps) {
  const unlockedCount = useGameStore((state) => state.unlockedCount)
  const currentStage = useGameStore((state) => state.currentStage)
  const rebirthCount = useGameStore((state) => state.rebirthCount)
  const shouldRender = useMountTransition(isOpen, TRANSITION_MS)

  if (!shouldRender) return null

  // 회차 배율은 "이번 리버스를 실행하기 전" rebirthCount 기준 — executeRebirth와
  // 같은 값을 미리 보여준다. nextCountMultiplier는 "그다음 리버스"(이번 리버스 후
  // rebirthCount+1)를 실행할 때 적용될 배율 미리보기.
  const rewardRow = getRebirthRewardRow(currentStage)
  const countMultiplier = computeRebirthCountMultiplier(rebirthCount)
  const nextCountMultiplier = computeRebirthCountMultiplier(rebirthCount + 1)

  // 다음 구간 미리보기 — 지금 스테이지보다 뒤에서 시작하는 구간 중 가장 가까운 것.
  // 이미 마지막 구간(StageTo가 사실상 무한대)에 들어와 있으면 다음 구간이 없다.
  const nextRewardTier = [...BALANCE_TABLES.RebirthRewardTable]
    .sort((a, b) => a.StageFrom - b.StageFrom)
    .find((row) => row.StageFrom > currentStage)

  return (
    <div
      className={`absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-6 ${
        isOpen ? 'animate-[backdrop-fade-in_180ms_ease-out]' : 'animate-[backdrop-fade-out_180ms_ease-in_forwards]'
      }`}
      onClick={onCancel}
    >
      <div
        className={`panel-frame w-full max-w-xs rounded-xl border border-grade-epic/30 bg-surface-card p-4 text-text-primary ${
          isOpen ? 'animate-[modal-pop-in_180ms_ease-out]' : 'animate-[modal-pop-out_180ms_ease-in_forwards]'
        }`}
        style={{ '--panel-accent-color': 'var(--color-grade-epic)' } as CSSProperties}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-sm font-semibold text-grade-epic">{getSystemName('reverse')}</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">{getRebirthUiLabel('description')}</p>

        <IntroBanner
          storageKey="intro-reverse"
          title={getSystemName('reverse')}
          lines={SYSTEM_INTRO_LINES.reverse}
          accentColorVar="var(--color-grade-epic)"
          className="mt-2"
        />

        <RebirthSection title={getRebirthBonusLabel('title')} tone="text-gold-strong">
          <li>
            {getRebirthUiLabel('currentBracket')} {formatStageBracket(rewardRow)}
          </li>
          <li>
            {getRebirthBonusLabel('currentCycle')} {rebirthCount + 1}회차
          </li>
          <li>
            {getRebirthBonusLabel('countMultiplier')} {formatMultiplier(countMultiplier)}
          </li>
          <li>
            {getRebirthUiLabel('nextMultiplier')} {formatMultiplier(nextCountMultiplier)}
          </li>
        </RebirthSection>

        <RebirthSection title={getRebirthUiLabel('resetSectionTitle')} tone="text-danger-strong">
          <li>{getRebirthUiLabel('resetStage')}</li>
          <li>{getRebirthUiLabel('resetStats')}</li>
          <li>{getRebirthUiLabel('resetWeapons')}</li>
          <li>{getRebirthUiLabel('resetRelics')}</li>
          <li>{getRebirthUiLabel('resetMastery')}</li>
        </RebirthSection>

        <RebirthSection title={getRebirthUiLabel('rewardSectionTitle')} tone="text-success-strong">
          <RewardRow currency="diamond" base={rewardRow.DiamondReward} />
          <RewardRow currency="growthEnergy" base={rewardRow.GrowthEnergyReward} multiplier={countMultiplier} />
          <RewardRow currency="gold" base={rewardRow.GoldReward} multiplier={countMultiplier} />
          <RewardRow currency="essence" base={rewardRow.MasteryEssenceReward} multiplier={countMultiplier} />
          {nextRewardTier && (
            <li className="font-medium text-gold-strong">
              {getRebirthUiLabel('nextTierReachPrefix')} {nextRewardTier.StageFrom} {getRebirthUiLabel('nextTierReachSuffix')}{' '}
              {formatNumber(nextRewardTier.DiamondReward)} {getCurrencyName('diamond')}
            </li>
          )}
        </RebirthSection>

        <RebirthSection title={getRebirthUiLabel('keepSectionTitle')} tone="text-blue-strong">
          <li>
            {getSystemName('existTree')} ({unlockedCount}/{EXIST_TREE_TOTAL_NODES} {getRebirthUiLabel('keepUnlockedSuffix')})
          </li>
          <li>{getRebirthUiLabel('keepUnlockState')}</li>
          <li>{getRebirthUiLabel('keepCurrency')}</li>
        </RebirthSection>

        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} className="px-3 py-1.5 text-xs">
            {getButtonLabel('cancel')}
          </Button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-grade-epic px-3 py-1.5 text-xs font-medium text-white transition-colors hover:brightness-110 active:scale-95"
          >
            {getButtonLabel('execute')}
          </button>
        </div>
      </div>
    </div>
  )
}

// 구간 고정 지급량에 회차 배율을 곱해 최종 지급량을 보여준다. multiplier가 없으면
// (다이아) 배율 없이 지급량 그대로 — 다이아는 회차 배율이 적용되지 않는 유일한 재화다.
function RewardRow({ currency, base, multiplier }: { currency: CurrencyKey; base: number; multiplier?: number }) {
  const final = multiplier != null ? Math.floor(base * multiplier) : base
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="text-text-primary">{getCurrencyName(currency)}</span>
      <span className="text-right">
        {multiplier != null && (
          <>
            {getRebirthUiLabel('baseAmount')} {formatNumber(base)} × {multiplier.toFixed(2)} →{' '}
          </>
        )}
        <span className="font-medium text-success-strong">
          {formatNumber(final)} {getRebirthUiLabel('grantSectionTitle')}
        </span>
      </span>
    </li>
  )
}

function RebirthSection({ title, tone, children }: { title: string; tone: string; children: ReactNode }) {
  return (
    <div className="mt-3 border-t border-surface-border pt-2">
      <p className={`mb-1 text-[10px] font-semibold ${tone}`}>{title}</p>
      <ul className="space-y-0.5 text-[11px] text-text-secondary">{children}</ul>
    </div>
  )
}
