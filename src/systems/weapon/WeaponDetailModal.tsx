import { useState, type CSSProperties, type ReactNode } from 'react'
import { getWeaponFusionConfig } from '../../data/balance'
import { getBulkUiLabel, getButtonLabel, getCommonUiLabel, getStatName, getWeaponDetailUiLabel, getWeaponUiLabel } from '../../data/uiStrings'
import { useGameStore } from '../../store/gameStore'
import { formatNumber, formatPercent } from '../../utils/format'
import {
  canBreakthrough,
  canMerge,
  nextBreakthroughStep,
  nextWeaponIdForMerge,
  parseWeaponId,
  simulateBulkBreakthrough,
  simulateBulkFusion,
  weaponBaseAtkEquipBonus,
  weaponBaseAtkOwnPercent,
  weaponDisplayName,
  weaponEquipBonus,
  weaponLevelUpCost,
  weaponMaxLevel,
  weaponOwnPercent,
  WEAPON_MAX_BREAKTHROUGH,
  type BulkBreakthroughResult,
  type BulkFusionResult,
} from './weapon'
import { GRADE_TEXT_COLOR } from './weaponUi'
import { masteryPrimaryStat } from '../../data/mastery'
import { Button, CostLabel, GradeBadge, ProgressBar } from '../../components/ui'
import type { OwnedWeapons, WeaponInstance } from '../../types/game'

interface WeaponDetailModalProps {
  weaponId: string
  onClose: () => void
}

export function WeaponDetailModal({ weaponId, onClose }: WeaponDetailModalProps) {
  const entry = useGameStore((state) => state.ownedWeapons[weaponId])
  const ownedWeapons = useGameStore((state) => state.ownedWeapons)
  const equippedWeaponId = useGameStore((state) => state.equippedWeaponId)
  const gold = useGameStore((state) => state.currencies.gold)
  const equipWeapon = useGameStore((state) => state.equipWeapon)
  const levelUpWeapon = useGameStore((state) => state.levelUpWeapon)
  const maxLevelUpWeapon = useGameStore((state) => state.maxLevelUpWeapon)
  const breakthroughWeapon = useGameStore((state) => state.breakthroughWeapon)
  const bulkBreakthroughWeapon = useGameStore((state) => state.bulkBreakthroughWeapon)
  const mergeWeapon = useGameStore((state) => state.mergeWeapon)
  const bulkMergeWeapon = useGameStore((state) => state.bulkMergeWeapon)

  // 일괄 돌파/합성은 이 모달 안에서 "미리보기 → 확인 → 결과"로 화면을 바꿔가며
  // 처리한다(별도 모달을 새로 겹쳐 띄우지 않음 — 이 앱엔 모달 위에 모달을 띄우는
  // 패턴이 없다).
  const [bulkView, setBulkView] = useState<'breakthrough' | 'fusion' | null>(null)

  const { type, grade, tier } = parseWeaponId(weaponId)
  const count = entry?.count ?? 0
  const level = entry?.level ?? 0
  const breakthroughCount = entry?.breakthroughCount ?? 0
  const owned = count > 0
  const isEquipped = equippedWeaponId === weaponId

  const maxLevel = weaponMaxLevel(breakthroughCount)
  const levelCost = weaponLevelUpCost(type, grade, tier, level)
  const canLevelUp = owned && level < maxLevel && gold >= levelCost

  const nextStep = entry ? nextBreakthroughStep(entry) : undefined
  const canDoBreakthrough = owned && entry !== undefined && canBreakthrough(entry)

  const fusion = getWeaponFusionConfig()
  const mergeTargetId = nextWeaponIdForMerge(weaponId)
  const canDoMerge = owned && entry !== undefined && canMerge(weaponId, entry)
  // 장착 여부와 무관하게 모든 무기는 최소 1개가 남아야 한다 — canMerge/canBreakthrough와 동일 규칙.
  const mergeAvailable = Math.max(0, count - 1)
  const breakthroughAvailable = Math.max(0, count - 1)

  const primaryStat = masteryPrimaryStat(type)
  const isAtkSpecialty = primaryStat === 'atk'
  // 보유 효과(퍼센트, 레벨과 무관한 고정값)는 count만 넘긴다. 장착 효과(깡스탯)는
  // 현재 레벨과 다음 레벨(있으면) 값을 둘 다 보여줘야 해서 두 레벨로 각각 계산한다.
  const baseAtkOwnPercent = owned ? weaponBaseAtkOwnPercent(type, grade, tier, count) : 0
  const baseAtkEquip = owned ? weaponBaseAtkEquipBonus(type, grade, tier, level) : 0
  const specialtyOwnPercent = owned ? weaponOwnPercent(type, grade, tier, count) : 0
  const specialtyEquip = owned ? weaponEquipBonus(type, grade, tier, level) : 0
  const hasNextLevel = owned && level < maxLevel
  const baseAtkEquipNext = hasNextLevel ? weaponBaseAtkEquipBonus(type, grade, tier, level + 1) : 0
  const specialtyEquipNext = hasNextLevel ? weaponEquipBonus(type, grade, tier, level + 1) : 0

  if (bulkView === 'breakthrough' && entry) {
    return (
      <BulkBreakthroughOverlay
        weaponId={weaponId}
        grade={grade}
        entry={entry}
        onExecute={bulkBreakthroughWeapon}
        onClose={() => setBulkView(null)}
      />
    )
  }

  if (bulkView === 'fusion' && entry) {
    return (
      <BulkFusionOverlay
        weaponId={weaponId}
        grade={grade}
        ownedWeapons={ownedWeapons}
        onExecute={bulkMergeWeapon}
        onClose={() => setBulkView(null)}
      />
    )
  }

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
            <dt>{getWeaponDetailUiLabel('level')}</dt>
            <dd className="text-text-primary">
              {level} / {maxLevel}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>{getButtonLabel('breakthrough')}</dt>
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
            <span className="text-text-secondary">
              {getWeaponUiLabel('ownBonus')} <span className="text-text-disabled">{getWeaponDetailUiLabel('fixedValueSuffix')}</span>
            </span>
            <span className="text-text-primary">
              {getStatName('atk')} +{formatPercent(baseAtkOwnPercent + (isAtkSpecialty ? specialtyOwnPercent : 0))}
              {!isAtkSpecialty && (
                <>
                  {' '}
                  · {getStatName(primaryStat)} +{formatPercent(specialtyOwnPercent)}
                </>
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">
              {getWeaponUiLabel('equipBonus')} <span className="text-text-disabled">Lv.{level}</span>
            </span>
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
          {hasNextLevel && (
            <div className="flex justify-between">
              <span className="text-text-disabled">
                {getWeaponDetailUiLabel('nextLevel')} <span>Lv.{level + 1}</span>
              </span>
              <span className="text-text-disabled">
                {getStatName('atk')} +{formatNumber(baseAtkEquipNext + (isAtkSpecialty ? specialtyEquipNext : 0))}
                {!isAtkSpecialty && (
                  <>
                    {' '}
                    · {getStatName(primaryStat)} +{formatNumber(specialtyEquipNext)}
                  </>
                )}
              </span>
            </div>
          )}
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

          <div className="flex flex-col gap-1">
            <Button variant="teal" disabled={!canDoBreakthrough} onClick={() => breakthroughWeapon(weaponId)} className="text-xs">
              <span className="flex flex-col items-center leading-tight">
                <span>{getButtonLabel('breakthrough')}</span>
                <span className="text-[10px] opacity-80">
                  {nextStep
                    ? `${breakthroughAvailable}/${nextStep.RequiredDuplicateCount}${getWeaponDetailUiLabel('unitCount')}`
                    : getWeaponDetailUiLabel('maxReached')}
                </span>
              </span>
            </Button>
            <Button
              variant="secondary"
              disabled={!canDoBreakthrough}
              onClick={() => setBulkView('breakthrough')}
              className="text-[10px]"
            >
              {getBulkUiLabel('bulk')} {getButtonLabel('breakthrough')}
            </Button>
          </div>

          <div className="flex flex-col gap-1">
            <Button variant="teal" disabled={!canDoMerge} onClick={() => mergeWeapon(weaponId)} className="text-xs">
              <span className="flex flex-col items-center leading-tight">
                <span>{getButtonLabel('fuse')}</span>
                <span className="text-[10px] opacity-80">
                  {mergeTargetId
                    ? `${mergeAvailable}/${fusion.RequiredCount}${getWeaponDetailUiLabel('unitCount')}`
                    : getWeaponDetailUiLabel('fusionUnavailable')}
                </span>
              </span>
            </Button>
            <Button variant="secondary" disabled={!canDoMerge} onClick={() => setBulkView('fusion')} className="text-[10px]">
              {getBulkUiLabel('bulk')} {getButtonLabel('fuse')}
            </Button>
          </div>
        </div>

        <p className="mt-2 text-center text-[10px] text-text-disabled">
          {getWeaponDetailUiLabel('fusionNotePrefix')} {fusion.RequiredCount}
          {getWeaponDetailUiLabel('fusionNoteSuffix')}
        </p>
      </div>
    </div>
  )
}

// 일괄 돌파/합성 공용 바깥 틀 — WeaponDetailModal 본문과 같은 배경/패널 스타일을
// 그대로 써서(모달을 새로 띄우지 않고 내용만 바꿔치기) 톤이 어긋나지 않게 한다.
function BulkOverlayFrame({
  grade,
  title,
  onClose,
  children,
}: {
  grade: string
  title: string
  onClose: () => void
  children: ReactNode
}) {
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
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg bg-surface-elevated px-2 py-1 text-[11px] text-text-secondary transition-colors hover:bg-surface-border hover:text-text-primary"
          >
            {getButtonLabel('close')}
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

interface BulkBreakthroughOverlayProps {
  weaponId: string
  grade: string
  entry: WeaponInstance
  onExecute: (weaponId: string) => BulkBreakthroughResult | null
  onClose: () => void
}

// 실행 전(미리보기)과 실행 후(결과)가 같은 모양(돌파 N→M, 소모 개수)이라 굳이
// preview/result를 다른 컴포넌트로 안 쪼개고 phase로만 분기한다.
function BulkBreakthroughOverlay({ weaponId, grade, entry, onExecute, onClose }: BulkBreakthroughOverlayProps) {
  const [result, setResult] = useState<BulkBreakthroughResult | null>(null)
  const preview = result ?? simulateBulkBreakthrough(entry)
  const hasAnyStep = preview.toBreakthroughCount > preview.fromBreakthroughCount
  const isResultPhase = result !== null

  return (
    <BulkOverlayFrame grade={grade} title={`${getBulkUiLabel('bulk')} ${getButtonLabel('breakthrough')}`} onClose={onClose}>
      <p className="mt-2 text-[11px] font-medium text-text-secondary">
        {isResultPhase ? getBulkUiLabel('resultHeading') : getBulkUiLabel('previewHeading')}
      </p>

      {hasAnyStep ? (
        <dl className="mt-2 space-y-1 text-xs text-text-secondary">
          <div className="flex justify-between">
            <dt>{getButtonLabel('breakthrough')}</dt>
            <dd className="font-medium text-text-primary">
              {preview.fromBreakthroughCount} → {preview.toBreakthroughCount} / {WEAPON_MAX_BREAKTHROUGH}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt>{getCommonUiLabel('consume')}</dt>
            <dd className="text-text-primary">
              {formatNumber(preview.totalConsumed)}
              {getWeaponDetailUiLabel('unitCount')}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-2 text-xs text-text-disabled">{getBulkUiLabel('noneAvailable')}</p>
      )}

      <div className="mt-4 flex justify-end gap-2">
        {isResultPhase ? (
          <Button variant="teal" onClick={onClose} className="px-3 py-1.5 text-xs">
            {getButtonLabel('close')}
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} className="px-3 py-1.5 text-xs">
              {getButtonLabel('cancel')}
            </Button>
            <Button
              variant="teal"
              disabled={!hasAnyStep}
              onClick={() => setResult(onExecute(weaponId))}
              className="px-3 py-1.5 text-xs"
            >
              {getButtonLabel('execute')}
            </Button>
          </>
        )}
      </div>
    </BulkOverlayFrame>
  )
}

interface BulkFusionOverlayProps {
  weaponId: string
  grade: string
  ownedWeapons: OwnedWeapons
  onExecute: (weaponId: string, chain: boolean) => BulkFusionResult | null
  onClose: () => void
}

function BulkFusionOverlay({ weaponId, grade, ownedWeapons, onExecute, onClose }: BulkFusionOverlayProps) {
  const [chain, setChain] = useState(false)
  const [result, setResult] = useState<BulkFusionResult | null>(null)
  // 결과 화면에선 실행 시점에 실제로 적용된 steps를 그대로 보여준다 — chain 토글을
  // 만져도 이미 끝난 결과가 바뀌어 보이면 안 되므로 preview 재계산과 분리한다.
  const preview = result ?? simulateBulkFusion(ownedWeapons, weaponId, chain)
  const isResultPhase = result !== null

  return (
    <BulkOverlayFrame grade={grade} title={`${getBulkUiLabel('bulk')} ${getButtonLabel('fuse')}`} onClose={onClose}>
      <p className="mt-2 text-[11px] font-medium text-text-secondary">
        {isResultPhase ? getBulkUiLabel('resultHeading') : getBulkUiLabel('previewHeading')}
      </p>

      {!isResultPhase && (
        <button type="button" onClick={() => setChain((value) => !value)} className="mt-2 flex w-full items-center gap-1.5">
          <span className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${chain ? 'bg-blue-base' : 'bg-surface-card'}`}>
            <span
              className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                chain ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </span>
          <span className="text-left text-[11px]">
            <span className="font-medium text-text-primary">{getBulkUiLabel('chainFusion')}</span>
            <span className="block text-[10px] text-text-disabled">{getBulkUiLabel('chainFusionHint')}</span>
          </span>
        </button>
      )}

      {preview.steps.length > 0 ? (
        <ul className="mt-2 space-y-1.5 text-xs text-text-secondary">
          {preview.steps.map((step, index) => (
            <li key={`${step.fromId}-${index}`} className="rounded-lg bg-surface-elevated px-2 py-1.5">
              <div className="flex items-center justify-between text-text-primary">
                <span className="truncate">{weaponDisplayName(step.fromId)}</span>
                <span className="shrink-0 px-1 text-text-disabled">→</span>
                <span className="truncate text-right">{weaponDisplayName(step.toId)}</span>
              </div>
              <div className="mt-0.5 flex justify-between text-[10px] text-text-disabled">
                <span>
                  {getCommonUiLabel('consume')} {formatNumber(step.consumed)}
                  {getWeaponDetailUiLabel('unitCount')}
                </span>
                <span>
                  {getCommonUiLabel('expectedGain')} {formatNumber(step.produced)}
                  {getWeaponDetailUiLabel('unitCount')}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-text-disabled">{getBulkUiLabel('noneAvailable')}</p>
      )}

      <div className="mt-4 flex justify-end gap-2">
        {isResultPhase ? (
          <Button variant="teal" onClick={onClose} className="px-3 py-1.5 text-xs">
            {getButtonLabel('close')}
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} className="px-3 py-1.5 text-xs">
              {getButtonLabel('cancel')}
            </Button>
            <Button
              variant="teal"
              disabled={preview.steps.length === 0}
              onClick={() => setResult(onExecute(weaponId, chain))}
              className="px-3 py-1.5 text-xs"
            >
              {getButtonLabel('execute')}
            </Button>
          </>
        )}
      </div>
    </BulkOverlayFrame>
  )
}
