import { useState } from 'react'
import { BALANCE_TABLES, type WeaponGradeEnum } from '../../data/balance'
import { getCommonUiLabel, getCurrencyName, getGachaUiLabel, getTabName } from '../../data/uiStrings'
import { useGameStore } from '../../store/gameStore'
import type { WeaponGachaPullResult } from '../../types/game'
import { formatNumber } from '../../utils/format'
import { currentGachaLevelConfig, weaponDisplayName } from './weapon'
import { GRADE_BG_COLOR, GRADE_BORDER_COLOR, GRADE_TEXT_COLOR } from './weaponUi'
import { Button, CostLabel, GradeBadge, PanelHeader } from '../../components/ui'

const GRADE_WEIGHT_KEYS = ['NormalWeight', 'RareWeight', 'EpicWeight', 'UniqueWeight', 'LegendaryWeight'] as const
const GRADES: WeaponGradeEnum[] = ['Normal', 'Rare', 'Epic', 'Unique', 'Legendary']

interface WeaponGachaPanelProps {
  onBack: () => void
}

export function WeaponGachaPanel({ onBack }: WeaponGachaPanelProps) {
  const [lastResults, setLastResults] = useState<WeaponGachaPullResult[]>([])
  const diamond = useGameStore((state) => state.currencies.diamond)
  const gachaCount = useGameStore((state) => state.gachaCount)
  const gachaLevel = useGameStore((state) => state.gachaLevel)
  const pullWeaponGacha = useGameStore((state) => state.pullWeaponGacha)
  const pullWeaponGachaTimes = useGameStore((state) => state.pullWeaponGachaTimes)

  const levelConfig = currentGachaLevelConfig(gachaCount)
  const nextLevelRow = [...BALANCE_TABLES.GachaTable]
    .sort((a, b) => a.GachaLevel - b.GachaLevel)
    .find((row) => row.GachaLevel > gachaLevel)
  const remainingToNextLevel = nextLevelRow ? Math.max(0, nextLevelRow.RequirePullCount - gachaCount) : null

  const totalWeight = GRADE_WEIGHT_KEYS.reduce((sum, key) => sum + Math.max(0, levelConfig[key]), 0)
  const cost = levelConfig.PullCostDiamond
  const canPullOnce = diamond >= cost
  const canPullTen = diamond >= cost * 10

  const handlePullOnce = () => {
    const result = pullWeaponGacha()
    setLastResults(result ? [result] : [])
  }

  const handlePullTen = () => {
    setLastResults(pullWeaponGachaTimes(10))
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-surface-base text-text-primary">
      <PanelHeader title={getTabName('gacha')} onBack={onBack} toneClassName="text-gold-strong" />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="flex items-center justify-between rounded-lg bg-surface-card px-3 py-2">
          <span className="text-xs text-text-secondary">{getCurrencyName('diamond')}</span>
          <span className="text-sm font-semibold text-gold-strong">{formatNumber(diamond)}</span>
        </div>

        <div className="mt-2 flex items-center justify-between rounded-lg bg-surface-card px-3 py-2 text-xs">
          <span className="text-text-secondary">
            {getGachaUiLabel('gachaLevel')} {gachaLevel}
          </span>
          <span className="text-text-secondary">
            {remainingToNextLevel === null
              ? 'MAX'
              : `${getGachaUiLabel('toNextLevel')} ${remainingToNextLevel}${getCommonUiLabel('timesSuffix')}`}
          </span>
        </div>

        <div className="mt-3 rounded-lg bg-surface-card p-3">
          <p className="mb-1.5 text-[11px] text-text-secondary">{getCommonUiLabel('gradeProbability')}</p>
          <div className="flex flex-col gap-1.5">
            {GRADES.map((grade, index) => {
              const weight = Math.max(0, levelConfig[GRADE_WEIGHT_KEYS[index]])
              const percent = totalWeight > 0 ? (weight / totalWeight) * 100 : 0
              return (
                <div key={grade} className="flex items-center justify-between text-[11px]">
                  <GradeBadge grade={grade} />
                  <span className="text-text-secondary">{percent.toFixed(1)}%</span>
                </div>
              )
            })}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="gold" disabled={!canPullOnce} onClick={handlePullOnce}>
            <span className="flex flex-col items-center leading-tight">
              <span>{getGachaUiLabel('pullOnce')}</span>
              <CostLabel currency="diamond" amount={cost} affordable={canPullOnce} />
            </span>
          </Button>
          <Button variant="gold" disabled={!canPullTen} onClick={handlePullTen}>
            <span className="flex flex-col items-center leading-tight">
              <span>{getGachaUiLabel('pullTen')}</span>
              <CostLabel currency="diamond" amount={cost * 10} affordable={canPullTen} />
            </span>
          </Button>
        </div>

        {lastResults.length > 0 && (
          <div className="mt-3 grid grid-cols-5 gap-1.5">
            {lastResults.map((result, index) => {
              const grade = result.weaponId.split('_')[1] as WeaponGradeEnum
              return (
                <div
                  key={`${result.weaponId}-${index}`}
                  className={`flex flex-col items-center gap-0.5 rounded-lg border p-1.5 text-center text-[9px] ${GRADE_BORDER_COLOR[grade]} ${GRADE_BG_COLOR[grade]}`}
                >
                  <span className={GRADE_TEXT_COLOR[grade]}>{weaponDisplayName(result.weaponId)}</span>
                  <span className={result.isDuplicate ? 'text-text-disabled' : 'text-success-strong'}>
                    {result.isDuplicate ? getGachaUiLabel('duplicate') : getGachaUiLabel('newItem')}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
