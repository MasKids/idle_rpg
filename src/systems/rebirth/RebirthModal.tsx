import type { CSSProperties, ReactNode } from 'react'
import { BALANCE_TABLES, getRebirthDiamondReward } from '../../data/balance'
import type { CurrencyKey } from '../../types/game'
import { EXIST_TREE_TOTAL_NODES } from '../../data/existTree'
import { getButtonLabel, getCommonUiLabel, getCurrencyName, getRebirthBonusLabel, getRebirthUiLabel, getSystemName } from '../../data/uiStrings'
import { useGameStore } from '../../store/gameStore'
import { computeRebirthBonusPoints, computeRefundMultiplier } from './rebirthBonus'
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

function formatPoints(value: number): string {
  return value.toFixed(2)
}

export function RebirthModal({ isOpen, onCancel, onConfirm }: RebirthModalProps) {
  const spent = useGameStore((state) => state.rebirthSpent)
  const unlockedCount = useGameStore((state) => state.unlockedCount)
  const currentStage = useGameStore((state) => state.currentStage)
  const rebirthCount = useGameStore((state) => state.rebirthCount)
  const rebirthBonusPoint = useGameStore((state) => state.rebirthBonusPoint)
  const shouldRender = useMountTransition(isOpen, TRANSITION_MS)

  if (!shouldRender) return null

  // 이번 리버스에서 도달 스테이지로 얻는 포인트(pendingPoints)는 이번 환급 배율에
  // 바로 반영된다 — 도달 스테이지가 이번 환급에 즉시 체감되게.
  const pendingPoints = computeRebirthBonusPoints(currentStage)
  const currentMultiplier = computeRefundMultiplier(currentStage, rebirthBonusPoint + pendingPoints)
  const diamondReward = getRebirthDiamondReward(currentStage)
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
            {getRebirthBonusLabel('currentCycle')} {rebirthCount + 1}회차
          </li>
          <li>
            {getRebirthBonusLabel('totalPoints')} {formatPoints(rebirthBonusPoint)}
          </li>
          <li>
            {getRebirthBonusLabel('pendingPoints')} +{formatPoints(pendingPoints)} {getRebirthUiLabel('pendingNote')}
          </li>
          <li>
            {getRebirthBonusLabel('refundMultiplier')} {formatMultiplier(currentMultiplier)}
          </li>
        </RebirthSection>

        <RebirthSection title={getRebirthUiLabel('resetSectionTitle')} tone="text-danger-strong">
          <li>{getRebirthUiLabel('resetStage')}</li>
          <li>{getRebirthUiLabel('resetStats')}</li>
          <li>{getRebirthUiLabel('resetWeapons')}</li>
          <li>{getRebirthUiLabel('resetRelics')}</li>
          <li>{getRebirthUiLabel('resetMastery')}</li>
        </RebirthSection>

        <RebirthSection
          title={`환급 (${getRebirthBonusLabel('refundMultiplier')} ${formatMultiplier(currentMultiplier)})`}
          tone="text-success-strong"
        >
          <RefundRow currency="growthEnergy" spent={spent.growthEnergy} multiplier={currentMultiplier} />
          <RefundRow currency="gold" spent={spent.gold} multiplier={currentMultiplier} />
          <RefundRow currency="essence" spent={spent.essence} multiplier={currentMultiplier} />
        </RebirthSection>

        <RebirthSection title={getRebirthUiLabel('grantSectionTitle')} tone="text-gold-strong">
          <li>
            {getCurrencyName('diamond')} +{formatNumber(diamondReward)}
          </li>
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

// 소비량을 그대로 돌려받는 게 아니라 "소비량 × 배율"만큼 새로 지급되는 것임을
// 한 줄에서 바로 읽을 수 있게 — 예전엔 "37.5K → +40.9K"처럼만 보여줘서 보유량이
// 그만큼 불어나는 것처럼 오해하기 쉬웠다.
function RefundRow({ currency, spent, multiplier }: { currency: CurrencyKey; spent: number; multiplier: number }) {
  const granted = Math.floor(spent * multiplier)
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="text-text-primary">{getCurrencyName(currency)}</span>
      <span className="text-right">
        {getCommonUiLabel('consume')} {formatNumber(spent)} × {multiplier.toFixed(2)} →{' '}
        <span className="font-medium text-success-strong">
          {formatNumber(granted)} {getRebirthUiLabel('grantSectionTitle')}
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
