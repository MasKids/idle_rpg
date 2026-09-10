import type { CSSProperties, ReactNode } from 'react'
import { BALANCE_TABLES, getRebirthDiamondReward } from '../../data/balance'
import { EXIST_TREE_TOTAL_NODES } from '../../data/existTree'
import { getButtonLabel, getCurrencyName, getRebirthBonusLabel, getSystemName } from '../../data/uiStrings'
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
        <p className="mt-1 text-[11px] leading-relaxed text-text-secondary">
          스테이지·스탯·숙련을 초기화하고 무기·유물을 소멸/초기화하는 대신, 그동안 소비한 재화를 전액 돌려받고
          도달 스테이지에 비례한 다이아를 새로 받습니다. 존재력 트리는 그대로 유지됩니다.
        </p>

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
            {getRebirthBonusLabel('pendingPoints')} +{formatPoints(pendingPoints)} (도달 스테이지 기준, 이번 환급에 바로 반영)
          </li>
          <li>
            {getRebirthBonusLabel('refundMultiplier')} {formatMultiplier(currentMultiplier)}
          </li>
        </RebirthSection>

        <RebirthSection title="초기화 / 소멸" tone="text-danger-strong">
          <li>스테이지 → 1-1</li>
          <li>5스탯 레벨 전부 0</li>
          <li>무기 전부 소멸</li>
          <li>유물 전부 초기화</li>
          <li>무기 숙련 레벨 0</li>
        </RebirthSection>

        <RebirthSection
          title={`환급 (${getRebirthBonusLabel('refundMultiplier')} ${formatMultiplier(currentMultiplier)})`}
          tone="text-success-strong"
        >
          <li>
            {getCurrencyName('growthEnergy')} {formatNumber(spent.growthEnergy)} → +
            {formatNumber(Math.floor(spent.growthEnergy * currentMultiplier))}
          </li>
          <li>
            {getCurrencyName('gold')} {formatNumber(spent.gold)} → +{formatNumber(Math.floor(spent.gold * currentMultiplier))}
          </li>
          <li>
            {getCurrencyName('essence')} {formatNumber(spent.essence)} → +
            {formatNumber(Math.floor(spent.essence * currentMultiplier))}
          </li>
        </RebirthSection>

        <RebirthSection title="지급" tone="text-gold-strong">
          <li>
            {getCurrencyName('diamond')} +{formatNumber(diamondReward)}
          </li>
          {nextRewardTier && (
            <li className="font-medium text-gold-strong">
              → 스테이지 {nextRewardTier.StageFrom} 도달 시 {formatNumber(nextRewardTier.DiamondReward)}{' '}
              {getCurrencyName('diamond')}
            </li>
          )}
        </RebirthSection>

        <RebirthSection title="유지" tone="text-blue-strong">
          <li>
            존재력 트리 ({unlockedCount}/{EXIST_TREE_TOTAL_NODES} 해금)
          </li>
          <li>리버스 · 타임 하이스트 해금 상태</li>
          <li>존재력(EXIST), 시간에너지 보유량</li>
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

function RebirthSection({ title, tone, children }: { title: string; tone: string; children: ReactNode }) {
  return (
    <div className="mt-3 border-t border-surface-border pt-2">
      <p className={`mb-1 text-[10px] font-semibold ${tone}`}>{title}</p>
      <ul className="space-y-0.5 text-[11px] text-text-secondary">{children}</ul>
    </div>
  )
}
