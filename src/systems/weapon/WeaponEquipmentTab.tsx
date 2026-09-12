import { useState } from 'react'
import { getString, WEAPON_TYPE_NAME_STRING_ID, type WeaponGradeEnum, type WeaponTypeEnum } from '../../data/balance'
import { masteryPrimaryStat } from '../../data/mastery'
import { getStatName, getTabName, getWeaponUiLabel } from '../../data/uiStrings'
import { useGameStore } from '../../store/gameStore'
import type { WeaponInstance } from '../../types/game'
import { formatNumber, formatPercent } from '../../utils/format'
import { WeaponDetailModal } from './WeaponDetailModal'
import {
  buildWeaponId,
  computeWeaponBonusBreakdown,
  computeWeaponReadiness,
  weaponDisplayName,
  WEAPON_GRADES,
  WEAPON_MAX_BREAKTHROUGH,
  WEAPON_TIERS,
  WEAPON_TYPES,
} from './weapon'
import { GRADE_BG_COLOR, GRADE_BORDER_COLOR, GRADE_GLOW_SHADOW, GRADE_TEXT_COLOR } from './weaponUi'
import { STATE_ICON, WEAPON_ICON } from '../../components/icons'
import { ProgressBar } from '../../components/ui'
import { IntroBanner } from '../onboarding/IntroBanner'
import { SYSTEM_INTRO_LINES } from '../onboarding/onboardingContent'

export function WeaponEquipmentTab() {
  const [selectedType, setSelectedType] = useState<WeaponTypeEnum>('Sword')
  const [selectedWeaponId, setSelectedWeaponId] = useState<string | null>(null)
  const ownedWeapons = useGameStore((state) => state.ownedWeapons)
  const equippedWeaponId = useGameStore((state) => state.equippedWeaponId)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <IntroBanner
        storageKey="intro-equipment"
        title={getTabName('equipment')}
        lines={SYSTEM_INTRO_LINES.equipment}
        accentColorVar="var(--color-teal-strong)"
        className="m-3"
      />

      <TypeSwitcher selectedType={selectedType} onSelect={setSelectedType} ownedWeapons={ownedWeapons} />

      <EquippedSummary equippedWeaponId={equippedWeaponId} ownedWeapons={ownedWeapons} />

      <div key={selectedType} className="min-h-0 flex-1 overflow-y-auto p-3 animate-[panel-fade-in_180ms_ease-out]">
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
                  className={`relative flex aspect-square flex-col items-center justify-center rounded-lg border text-[9px] transition-colors ${
                    owned
                      ? `${GRADE_BORDER_COLOR[grade]} ${GRADE_BG_COLOR[grade]} ${GRADE_GLOW_SHADOW[grade]} hover:brightness-125`
                      : 'border-surface-border bg-surface-card opacity-40 hover:opacity-60'
                  }`}
                >
                  {isEquipped && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-success-base text-white">
                      <STATE_ICON.equipped size={11} strokeWidth={2.5} />
                    </span>
                  )}
                  <span className={owned ? GRADE_TEXT_COLOR[grade] : 'text-text-disabled'}>T{tier}</span>
                  {owned ? (
                    <>
                      <span className="text-text-primary">Lv.{entry.level}</span>
                      <CountReadinessBar weaponId={weaponId} entry={entry} />
                    </>
                  ) : (
                    <span className="text-text-disabled">0</span>
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

// "보유 개수 / 돌파·합성 중 더 빨리 되는 쪽 필요 개수"를 막대로. 그 조건을 채우면
// 초록으로 바뀐다. 돌파 진행도는 청록, 합성 진행도는 금색으로 색을 달리해 지금
// 보이는 진행도가 둘 중 무엇인지 구분한다(돌파가 5단계까지 끝나면 자동으로 금색
// 합성 진행도로 넘어가 합성 쪽으로 안내된다). 더 이상 돌파도 합성도 불가능한
// 완성 상태면 막대 없이 보유 개수만 보여준다.
function CountReadinessBar({ weaponId, entry }: { weaponId: string; entry: WeaponInstance }) {
  const readiness = computeWeaponReadiness(weaponId, entry)

  if (!readiness) {
    return <span className="text-text-secondary">×{entry.count}</span>
  }

  const { kind, count, required, ready } = readiness
  const barColor = ready ? 'bg-success-strong' : kind === 'breakthrough' ? 'bg-teal-base' : 'bg-gold-base'

  return (
    <div className="mt-0.5 flex w-full flex-col items-center gap-0.5 px-1.5">
      <span className={ready ? 'font-semibold text-success-strong' : 'text-text-secondary'}>
        {count}/{required}
      </span>
      <ProgressBar value={count} max={required} colorClassName={barColor} />
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
    <div className="flex shrink-0 gap-1.5 border-b border-surface-border p-3">
      {WEAPON_TYPES.map((type) => {
        const ownedTypeCount = WEAPON_GRADES.reduce(
          (sum, grade) =>
            sum + WEAPON_TIERS.filter((tier) => (ownedWeapons[buildWeaponId(type, grade, tier)]?.count ?? 0) > 0).length,
          0,
        )
        const isSelected = type === selectedType
        const TypeIcon = WEAPON_ICON[type]

        return (
          <button
            key={type}
            type="button"
            onClick={() => onSelect(type)}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg px-1 py-2 text-center text-xs font-medium transition-colors ${
              isSelected ? 'bg-teal-base text-white' : 'bg-surface-card text-text-secondary hover:text-text-primary'
            }`}
          >
            <TypeIcon size={16} strokeWidth={2} />
            <div>{getString(WEAPON_TYPE_NAME_STRING_ID[type], 'KOR', type)}</div>
            <div className="text-[10px] opacity-80">
              {ownedTypeCount}/{WEAPON_GRADES.length * WEAPON_TIERS.length}
            </div>
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
      <div className="shrink-0 border-b border-surface-border p-3 text-center text-xs text-text-disabled">
        {getWeaponUiLabel('noWeaponEquipped')}
      </div>
    )
  }

  const entry = ownedWeapons[equippedWeaponId]
  const grade = equippedWeaponId.split('_')[1] as WeaponGradeEnum
  const type = equippedWeaponId.split('_')[0] as WeaponTypeEnum
  const primaryStat = masteryPrimaryStat(type)
  const isAtkSpecialty = primaryStat === 'atk'
  const { atkFlat, atkPercent, specialtyFlat, specialtyPercent } = computeWeaponBonusBreakdown(
    ownedWeapons,
    equippedWeaponId,
  )
  // 장착(깡스탯)은 "+N", 보유(퍼센트)는 "+N%"로 구분해서 보여준다 — 단위가 달라
  // 하나로 합칠 수 없다(v0.3.0 밸런스 개편, 보유=퍼센트/장착=깡스탯).
  const atkFlatTotal = atkFlat + (isAtkSpecialty ? specialtyFlat : 0)
  const atkPercentTotal = atkPercent + (isAtkSpecialty ? specialtyPercent : 0)

  return (
    <div className="shrink-0 border-b border-surface-border p-3">
      <div className="flex items-baseline justify-between">
        <span className={`text-xs font-semibold ${GRADE_TEXT_COLOR[grade]}`}>{weaponDisplayName(equippedWeaponId)}</span>
        <span className="text-[10px] text-text-secondary">
          Lv.{entry?.level ?? 0} · 돌파 {entry?.breakthroughCount ?? 0}/{WEAPON_MAX_BREAKTHROUGH}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap justify-end gap-x-3 gap-y-0.5 text-[11px] text-text-secondary">
        <span>
          {getStatName('atk')} +{formatNumber(atkFlatTotal)} ({formatPercent(atkPercentTotal)})
        </span>
        {!isAtkSpecialty && (
          <span>
            {getStatName(primaryStat)} +{formatNumber(specialtyFlat)} ({formatPercent(specialtyPercent)})
          </span>
        )}
      </div>
    </div>
  )
}
