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
} from './weapon'
import { GRADE_TEXT_COLOR } from './weaponUi'
import { masteryPrimaryStat } from '../../data/equipment'

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
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs rounded-xl border border-white/10 bg-slate-900 p-4 text-white"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className={`text-sm font-semibold ${GRADE_TEXT_COLOR[grade]}`}>{weaponDisplayName(weaponId)}</h2>
            {isEquipped && <span className="text-[10px] text-emerald-300">{getWeaponUiLabel('equipped')}</span>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg bg-white/10 px-2 py-1 text-[11px] text-white"
          >
            {getButtonLabel('close')}
          </button>
        </div>

        <dl className="mt-3 space-y-1 text-xs text-white/70">
          <div className="flex justify-between">
            <dt>{getWeaponUiLabel('grade')}</dt>
            <dd className={GRADE_TEXT_COLOR[grade]}>{grade}</dd>
          </div>
          <div className="flex justify-between">
            <dt>Tier</dt>
            <dd className="text-white">{tier}</dd>
          </div>
          <div className="flex justify-between">
            <dt>레벨</dt>
            <dd className="text-white">
              {level} / {maxLevel}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>돌파</dt>
            <dd className="text-white">{breakthroughCount} / 5</dd>
          </div>
          <div className="flex justify-between">
            <dt>{getWeaponUiLabel('ownedCount')}</dt>
            <dd className="text-white">{count}</dd>
          </div>
        </dl>

        <div className="mt-3 space-y-1 border-t border-white/10 pt-2 text-xs">
          <div className="flex justify-between">
            <span className="text-white/50">{getWeaponUiLabel('ownBonus')}</span>
            <span className="text-white">
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
            <span className="text-white/50">{getWeaponUiLabel('equipBonus')}</span>
            <span className="text-white">
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
          <button
            type="button"
            disabled={!owned || isEquipped}
            onClick={() => equipWeapon(weaponId)}
            className={`rounded-lg px-2 py-2 text-xs font-medium ${
              owned && !isEquipped ? 'bg-cyan-600 text-white' : 'cursor-not-allowed bg-white/10 text-white/30'
            }`}
          >
            {isEquipped ? getWeaponUiLabel('equipped') : getButtonLabel('equip')}
          </button>

          <div className="flex flex-col gap-1">
            <button
              type="button"
              disabled={!canLevelUp}
              onClick={() => levelUpWeapon(weaponId)}
              className={`rounded-lg px-2 py-1.5 text-xs font-medium ${
                canLevelUp ? 'bg-cyan-600 text-white' : 'cursor-not-allowed bg-white/10 text-white/30'
              }`}
            >
              {getButtonLabel('upgrade')}
              <div className="text-[10px] opacity-80">{owned && level < maxLevel ? formatNumber(levelCost) : '-'}</div>
            </button>
            <button
              type="button"
              disabled={!canLevelUp}
              onClick={() => maxLevelUpWeapon(weaponId)}
              className={`rounded-lg px-2 py-1 text-[10px] font-medium ${
                canLevelUp ? 'bg-cyan-700 text-white' : 'cursor-not-allowed bg-white/10 text-white/30'
              }`}
            >
              {getButtonLabel('maxAll')}
            </button>
          </div>

          <button
            type="button"
            disabled={!canDoBreakthrough}
            onClick={() => breakthroughWeapon(weaponId)}
            className={`rounded-lg px-2 py-2 text-xs font-medium ${
              canDoBreakthrough ? 'bg-cyan-600 text-white' : 'cursor-not-allowed bg-white/10 text-white/30'
            }`}
          >
            {getButtonLabel('breakthrough')}
            <div className="text-[10px] opacity-80">
              {nextStep ? `${nextStep.RequiredDuplicateCount}개 필요` : '최대'}
            </div>
          </button>

          <button
            type="button"
            disabled={!canDoMerge}
            onClick={() => mergeWeapon(weaponId)}
            className={`rounded-lg px-2 py-2 text-xs font-medium ${
              canDoMerge ? 'bg-cyan-600 text-white' : 'cursor-not-allowed bg-white/10 text-white/30'
            }`}
          >
            {getButtonLabel('fuse')}
            <div className="text-[10px] opacity-80">
              {mergeTargetId ? `${mergeAvailable}/${fusion.RequiredCount}개` : '합성 불가'}
            </div>
          </button>
        </div>

        <p className="mt-2 text-center text-[10px] text-white/40">
          합성: 장착 중 1개 제외 · 재료 {fusion.RequiredCount}개 필요
        </p>
      </div>
    </div>
  )
}
