import { useState } from 'react'
import { getCommon, getRelicConfig, getString } from '../../data/balance'
import { getCommonUiLabel, getCurrencyName, getRelicUiLabel } from '../../data/uiStrings'
import { useGameStore } from '../../store/gameStore'
import type { RelicGachaPullResult } from '../../types/game'
import { formatNumber } from '../../utils/format'
import { GRADE_BG_COLOR, GRADE_BORDER_COLOR, GRADE_GLOW_SHADOW, GRADE_TEXT_COLOR } from '../weapon/weaponUi'
import { relicEffectLabel, relicGradeName } from '../relic/relic'
import { Button } from '../../components/ui'

export function RelicGachaTab() {
  const [lastResult, setLastResult] = useState<RelicGachaPullResult | null>(null)
  // 같은 유물이 연속으로 나와도(relicId 동일) 등장 애니메이션이 다시 재생되도록
  // 뽑을 때마다 증가하는 별도 카운터를 key로 쓴다.
  const [pullToken, setPullToken] = useState(0)
  const ownedRelics = useGameStore((state) => state.ownedRelics)
  const timeEnergy = useGameStore((state) => state.currencies.timeEnergy)
  const pullRelicGacha = useGameStore((state) => state.pullRelicGacha)

  const cost = getCommon('RelicGachaCostTimeEnergy')
  const canPull = timeEnergy >= cost

  const handlePull = () => {
    setLastResult(pullRelicGacha())
    setPullToken((token) => token + 1)
  }

  const resultRelic = lastResult ? getRelicConfig(lastResult.relicId) : undefined

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="flex items-center justify-between rounded-lg bg-surface-card px-3 py-2 text-[11px] text-text-secondary">
        <span>
          {getCommonUiLabel('owned')} {getCurrencyName('timeEnergy')} {formatNumber(timeEnergy)}
        </span>
        <span className={canPull ? undefined : 'font-medium text-danger-strong'}>
          {getCommonUiLabel('costPerPull')} {formatNumber(cost)} {getCurrencyName('timeEnergy')}
        </span>
      </div>

      <Button variant="gold" disabled={!canPull} onClick={handlePull} className="mt-3 w-full">
        {getRelicUiLabel('pullRelic')}
      </Button>

      {lastResult && resultRelic && (
        <div
          key={pullToken}
          className={`mt-3 rounded-lg border p-2 text-center text-xs animate-[reveal-pop_360ms_ease-out] ${GRADE_BORDER_COLOR[resultRelic.RelicGrade]} ${GRADE_BG_COLOR[resultRelic.RelicGrade]} ${GRADE_GLOW_SHADOW[resultRelic.RelicGrade]}`}
        >
          <div className={`font-semibold ${GRADE_TEXT_COLOR[resultRelic.RelicGrade]}`}>
            {getString(resultRelic.Name, 'KOR')} ({relicGradeName(resultRelic.RelicGrade)})
          </div>
          <div className="mt-0.5 text-text-secondary">{relicEffectLabel(resultRelic)}</div>
          {lastResult.isDuplicate && (
            <div className="mt-0.5 text-gold-strong">
              {getRelicUiLabel('duplicateRefund')} +{formatNumber(getCommon('RelicDuplicateRefundTimeEnergy'))}{' '}
              {getCurrencyName('timeEnergy')}
            </div>
          )}
        </div>
      )}

      <p className="mt-2 text-center text-[10px] text-text-disabled">
        {getCommonUiLabel('owned')} {ownedRelics.length}
        {getCommonUiLabel('kindSuffix')}
      </p>
    </div>
  )
}
