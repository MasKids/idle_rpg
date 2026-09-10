import type { CSSProperties } from 'react'
import { getWeaponFusionConfig } from '../../data/balance'
import { getButtonLabel, getStatName, getWeaponUiLabel } from '../../data/uiStrings'
import { useGameStore } from '../../store/gameStore'
import { formatNumber } from '../../utils/format'
import {
  canBreakthrough,
  canMerge,
  nextBreakthroughStep,
  nextWeaponIdForMerge,
  parseWeaponId,
  weaponBaseAtkEquipBonus,
  weaponBaseAtkOwnBonus,
  weaponDisplayName,
  weaponEquipBonus,
  weaponLevelUpCost,
  weaponMaxLevel,
  weaponOwnBonus,
  WEAPON_MAX_BREAKTHROUGH,
} from './weapon'
import { GRADE_TEXT_COLOR } from './weaponUi'
import { masteryPrimaryStat } from '../../data/mastery'
import { Button, CostLabel, GradeBadge, ProgressBar } from '../../components/ui'

interface WeaponDetailModalProps {
  weaponId: string
  onClose: () => void
}

export function WeaponDetailModal({ weaponId, onClose }: WeaponDetailModalProps) {
  const entry = useGameStore((state) => state.ownedWeapons[weaponId])
  const equippedWeaponId = useGameStore((state) => state.equippedWeaponId)
  const gold = useGameStore((state) => state.currencies.gold)
  const equipWeapon = useGameStore((state) => state.equipWeapon)
  const levelUpWeapon = useGameStore((state) => state.levelUpWeapon)
  const maxLevelUpWeapon = useGameStore((state) => state.maxLevelUpWeapon)
  const breakthroughWeapon = useGameStore((state) => state.breakthroughWeapon)
  const mergeWeapon = useGameStore((state) => state.mergeWeapon)

  const { type, grade, tier } = parseWeaponId(weaponId)
  const count = entry?.count ?? 0
  const level = entry?.level ?? 0
  const breakthroughCount = entry?.breakthroughCount ?? 0
  const owned = count > 0
  const isEquipped = equippedWeaponId === weaponId

  const maxLevel = weaponMaxLevel(breakthroughCount)
  const levelCost = weaponLevelUpCost(grade, level)
  const canLevelUp = owned && level < maxLevel && gold >= levelCost

  const nextStep = entry ? nextBreakthroughStep(entry) : undefined
  const canDoBreakthrough = owned && entry !== undefined && canBreakthrough(entry)

  const fusion = getWeaponFusionConfig()
  const mergeTargetId = nextWeaponIdForMerge(weaponId)
  const canDoMerge = owned && entry !== undefined && canMerge(weaponId, entry, isEquipped)
  const mergeAvailable = Math.max(0, count - (isEquipped ? 1 : 0))

  const primaryStat = masteryPrimaryStat(type)
  const isAtkSpecialty = primaryStat === 'atk'
  const baseAtkOwn = owned ? weaponBaseAtkOwnBonus(grade, tier, level, count) : 0
  const baseAtkEquip = owned ? weaponBaseAtkEquipBonus(grade, tier, level) : 0
  const specialtyOwn = owned ? weaponOwnBonus(type, grade, tier, level, count) : 0
  const specialtyEquip = owned ? weaponEquipBonus(type, grade, tier, level) : 0

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-6 animate-[backdrop-fade-in_180ms_ease-out]"
      onClick={onClose}
    >
      <div
        className="panel-frame w-full max-w-xs rounded-xl border border-surface-border bg-surface-card p-4 text-text-primary animate-[modal-pop-in_180ms_ease-out]"
        style={{ '--panel-accent-color': `var(--color-grade-${grade.toLowerCase()})` } as CSSProperties}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className={`text-sm font-semibold ${GRADE_TEXT_COLOR[grade]}`}>{weaponDisplayName(weaponId)}</h2>
            {isEquipped && <span className="text-[10px] text-success-strong">{getWeaponUiLabel('equipped')}</span>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg bg-surface-elevated px-2 py-1 text-[11px] text-text-secondary transition-colors hover:bg-surface-border hover:text-text-primary"
          >
            {getButtonLabel('close')}
          </button>
        </div>

        <dl className="mt-3 space-y-1 text-xs text-text-secondary">
          <div className="flex items-center justify-between">
            <dt>{getWeaponUiLabel('grade')}</dt>
            <dd>
              <GradeBadge grade={grade} />
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>Tier</dt>
            <dd className="text-text-primary">{tier}</dd>
          </div>
          <div className="flex justify-between">
            <dt>레벨</dt>
            <dd className="text-text-primary">
              {level} / {maxLevel}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>돌파</dt>
            <dd className="text-text-primary">
              {breakthroughCount} / {WEAPON_MAX_BREAKTHROUGH}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>{getWeaponUiLabel('ownedCount')}</dt>
            <dd className="text-text-primary">{count}</dd>
          </div>
        </dl>

        <div className="mt-1.5">
          <ProgressBar value={level} max={maxLevel} colorClassName="bg-teal-base" />
        </div>

        <div className="mt-3 space-y-1 border-t border-surface-border pt-2 text-xs">
          <div className="flex justify-between">
            <span className="text-text-secondary">{getWeaponUiLabel('ownBonus')}</span>
            <span className="text-text-primary">
              {getStatName('atk')} +{formatNumber(baseAtkOwn + (isAtkSpecialty ? specialtyOwn : 0))}
              {!isAtkSpecialty && (
                <>
                  {' '}
                  · {getStatName(primaryStat)} +{formatNumber(specialtyOwn)}
                </>
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">{getWeaponUiLabel('equipBonus')}</span>
            <span className="text-text-primary">
              {getStatName('atk')} +{formatNumber(baseAtkEquip + (isAtkSpecialty ? specialtyEquip : 0))}
              {!isAtkSpecialty && (
                <>
                  {' '}
                  · {getStatName(primaryStat)} +{formatNumber(specialtyEquip)}
                </>
              )}
            </span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            variant="teal"
            disabled={!owned || isEquipped}
            onClick={() => equipWeapon(weaponId)}
            className="text-xs"
          >
            {isEquipped ? getWeaponUiLabel('equipped') : getButtonLabel('equip')}
          </Button>

          <div className="flex flex-col gap-1">
            <Button variant="teal" disabled={!canLevelUp} onClick={() => levelUpWeapon(weaponId)} className="text-xs">
              <span className="flex flex-col items-center leading-tight">
                <span>{getButtonLabel('upgrade')}</span>
                {owned && level < maxLevel ? (
                  <CostLabel currency="gold" amount={levelCost} affordable={gold >= levelCost} />
                ) : (
                  <span className="text-[11px] opacity-70">-</span>
                )}
              </span>
            </Button>
            <Button
              variant="secondary"
              disabled={!canLevelUp}
              onClick={() => maxLevelUpWeapon(weaponId)}
              className="text-[10px]"
            >
              {getButtonLabel('maxAll')}
            </Button>
          </div>

          <Button variant="teal" disabled={!canDoBreakthrough} onClick={() => breakthroughWeapon(weaponId)} className="text-xs">
            <span className="flex flex-col items-center leading-tight">
              <span>{getButtonLabel('breakthrough')}</span>
              <span className="text-[10px] opacity-80">{nextStep ? `${nextStep.RequiredDuplicateCount}개 필요` : '최대'}</span>
            </span>
          </Button>

          <Button variant="teal" disabled={!canDoMerge} onClick={() => mergeWeapon(weaponId)} className="text-xs">
            <span className="flex flex-col items-center leading-tight">
              <span>{getButtonLabel('fuse')}</span>
              <span className="text-[10px] opacity-80">
                {mergeTargetId ? `${mergeAvailable}/${fusion.RequiredCount}개` : '합성 불가'}
              </span>
            </span>
          </Button>
        </div>

        <p className="mt-2 text-center text-[10px] text-text-disabled">
          합성: 장착 중 1개 제외 · 재료 {fusion.RequiredCount}개 필요
        </p>
      </div>
    </div>
  )
}
