import { useState } from 'react'
import { getString, getWeaponTypeConfig, type WeaponGradeEnum, type WeaponTypeEnum } from '../../data/balance'
import { masteryPrimaryStat } from '../../data/equipment'
import { getStatName, getWeaponUiLabel } from '../../data/uiStrings'
import { useGameStore } from '../../store/gameStore'
import type { WeaponInstance } from '../../types/game'
import { formatNumber } from '../../utils/format'
import { WeaponDetailModal } from './WeaponDetailModal'
import {
  buildWeaponId,
  computeWeaponBonusBreakdown,
  computeWeaponReadiness,
  weaponDisplayName,
  WEAPON_GRADES,
  WEAPON_TIERS,
  WEAPON_TYPES,
} from './weapon'
import { GRADE_BG_COLOR, GRADE_BORDER_COLOR, GRADE_TEXT_COLOR } from './weaponUi'

export function WeaponEquipmentTab() {
  const [selectedType, setSelectedType] = useState<WeaponTypeEnum>('Sword')
  const [selectedWeaponId, setSelectedWeaponId] = useState<string | null>(null)
  const ownedWeapons = useGameStore((state) => state.ownedWeapons)
  const equippedWeaponId = useGameStore((state) => state.equippedWeaponId)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <TypeSwitcher selectedType={selectedType} onSelect={setSelectedType} ownedWeapons={ownedWeapons} />

      <EquippedSummary equippedWeaponId={equippedWeaponId} ownedWeapons={ownedWeapons} />

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-5 gap-1.5">
          {WEAPON_GRADES.map((grade) =>
            WEAPON_TIERS.map((tier) => {
              const weaponId = buildWeaponId(selectedType, grade, tier)
              const entry = ownedWeapons[weaponId]
              const owned = (entry?.count ?? 0) > 0
              const isEquipped = equippedWeaponId === weaponId

              return (
                <button
                  key={weaponId}
                  type="button"
                  onClick={() => setSelectedWeaponId(weaponId)}
                  className={`relative flex aspect-square flex-col items-center justify-center rounded-lg border text-[9px] ${
                    owned ? `${GRADE_BORDER_COLOR[grade]} ${GRADE_BG_COLOR[grade]}` : 'border-white/10 bg-black/20 opacity-40'
                  }`}
                >
                  {isEquipped && (
                    <span className="absolute -top-1 -right-1 rounded-full bg-emerald-500 px-1 text-[8px] text-white">
                      E
                    </span>
                  )}
                  <span className={owned ? GRADE_TEXT_COLOR[grade] : 'text-white/30'}>T{tier}</span>
                  {owned ? (
                    <>
                      <span className="text-white">Lv.{entry.level}</span>
                      <CountReadinessBar weaponId={weaponId} entry={entry} isEquipped={isEquipped} />
                    </>
                  ) : (
                    <span className="text-white/20">0</span>
                  )}
                </button>
              )
            }),
          )}
        </div>
      </div>

      {selectedWeaponId && (
        <WeaponDetailModal weaponId={selectedWeaponId} onClose={() => setSelectedWeaponId(null)} />
      )}
    </div>
  )
}

// "보유 개수 / 돌파·합성 중 더 빨리 되는 쪽 필요 개수"를 막대로. 그 조건을 채우면(돌파나
// 합성 중 하나라도 가능해지면) 초록으로 바뀐다. 더 이상 돌파도 합성도 불가능한 완성
// 상태면 막대 없이 보유 개수만 보여준다.
function CountReadinessBar({
  weaponId,
  entry,
  isEquipped,
}: {
  weaponId: string
  entry: WeaponInstance
  isEquipped: boolean
}) {
  const readiness = computeWeaponReadiness(weaponId, entry, isEquipped)

  if (!readiness) {
    return <span className="text-white/50">×{entry.count}</span>
  }

  const { count, required, ready } = readiness
  const fillPercent = Math.min(100, (count / required) * 100)

  return (
    <div className="mt-0.5 flex w-full flex-col items-center gap-0.5 px-1.5">
      <span className={ready ? 'font-semibold text-emerald-400' : 'text-white/50'}>
        {count}/{required}
      </span>
      <div className="h-1 w-full overflow-hidden rounded-full bg-black/40">
        <div
          className={`h-full rounded-full ${ready ? 'bg-emerald-400' : 'bg-cyan-500/70'}`}
          style={{ width: `${fillPercent}%` }}
        />
      </div>
    </div>
  )
}

function TypeSwitcher({
  selectedType,
  onSelect,
  ownedWeapons,
}: {
  selectedType: WeaponTypeEnum
  onSelect: (type: WeaponTypeEnum) => void
  ownedWeapons: ReturnType<typeof useGameStore.getState>['ownedWeapons']
}) {
  return (
    <div className="flex shrink-0 gap-1.5 border-b border-white/10 p-3">
      {WEAPON_TYPES.map((type) => {
        const config = getWeaponTypeConfig(type)
        const ownedTypeCount = WEAPON_GRADES.reduce(
          (sum, grade) =>
            sum + WEAPON_TIERS.filter((tier) => (ownedWeapons[buildWeaponId(type, grade, tier)]?.count ?? 0) > 0).length,
          0,
        )
        const isSelected = type === selectedType

        return (
          <button
            key={type}
            type="button"
            onClick={() => onSelect(type)}
            className={`flex-1 rounded-lg px-2 py-2 text-center text-xs font-medium ${
              isSelected ? 'bg-cyan-600 text-white' : 'bg-white/10 text-cyan-100/60'
            }`}
          >
            <div>{getString(config.Name, 'KOR', type)}</div>
            <div className="text-[10px] opacity-80">{ownedTypeCount}/25</div>
          </button>
        )
      })}
    </div>
  )
}

function EquippedSummary({
  equippedWeaponId,
  ownedWeapons,
}: {
  equippedWeaponId: string | null
  ownedWeapons: ReturnType<typeof useGameStore.getState>['ownedWeapons']
}) {
  if (!equippedWeaponId) {
    return (
      <div className="shrink-0 border-b border-white/10 p-3 text-center text-xs text-white/40">
        {getWeaponUiLabel('noWeaponEquipped')}
      </div>
    )
  }

  const entry = ownedWeapons[equippedWeaponId]
  const grade = equippedWeaponId.split('_')[1] as WeaponGradeEnum
  const type = equippedWeaponId.split('_')[0] as WeaponTypeEnum
  const primaryStat = masteryPrimaryStat(type)
  const isAtkSpecialty = primaryStat === 'atk'
  const { baseAtkTotal, specialtyOwnTotal, specialtyEquipBonus } = computeWeaponBonusBreakdown(
    ownedWeapons,
    equippedWeaponId,
  )

  return (
    <div className="shrink-0 border-b border-white/10 p-3">
      <div className="flex items-baseline justify-between">
        <span className={`text-xs font-semibold ${GRADE_TEXT_COLOR[grade]}`}>{weaponDisplayName(equippedWeaponId)}</span>
        <span className="text-[10px] text-white/50">
          Lv.{entry?.level ?? 0} · 돌파 {entry?.breakthroughCount ?? 0}/5
        </span>
      </div>
      <div className="mt-1 flex flex-wrap justify-end gap-x-3 gap-y-0.5 text-[11px] text-white/70">
        <span>
          {getStatName('atk')} +{formatNumber(baseAtkTotal + (isAtkSpecialty ? specialtyOwnTotal + specialtyEquipBonus : 0))}
        </span>
        {!isAtkSpecialty && (
          <span>
            {getStatName(primaryStat)} +{formatNumber(specialtyOwnTotal + specialtyEquipBonus)}
          </span>
        )}
      </div>
    </div>
  )
}
