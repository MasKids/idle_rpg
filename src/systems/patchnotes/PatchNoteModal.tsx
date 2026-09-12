import { BALANCE_TABLES, getString, type PatchNoteCategoryEnum, type PatchNoteTableRow } from '../../data/balance'
import { Button, Modal } from '../../components/ui'
import { getButtonLabel, getMetaUiLabel, getProfileUiLabel } from '../../data/uiStrings'

interface PatchNoteModalProps {
  isOpen: boolean
  onClose: () => void
}

// #EnumDefine의 PatchNoteCategory 한글 라벨은 balance.json에 실리지 않는 문서용
// 메타데이터라(#으로 시작하는 시트는 빌드 제외) 여기서 직접 대응시킨다 — 3개로
// 고정된 값이라 StringTable까지 갈 실익이 없다(WEAPON_TYPE_NAME_STRING_ID와 동일한 판단).
const CATEGORY_LABEL: Record<PatchNoteCategoryEnum, string> = {
  ADD: '추가',
  CHANGE: '변경',
  FIX: '수정',
}

const CATEGORY_BADGE_CLASS: Record<PatchNoteCategoryEnum, string> = {
  ADD: 'bg-blue-soft text-blue-strong',
  CHANGE: 'bg-gold-soft text-gold-strong',
  FIX: 'bg-danger-base/20 text-danger-strong',
}

interface PatchNoteVersionGroup {
  version: string
  releaseDate: string
  items: PatchNoteTableRow[]
}

// "v0.3.0" → [0, 3, 0]. 문자열째 비교("v0.10.0" < "v0.2.0")가 아니라 자리별 숫자
// 비교라 안전하다.
function parseVersion(version: string): number[] {
  return version.replace(/^v/, '').split('.').map((part) => Number(part) || 0)
}

function compareVersionDesc(a: string, b: string): number {
  const pa = parseVersion(a)
  const pb = parseVersion(b)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pb[i] ?? 0) - (pa[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

function groupByVersion(rows: readonly PatchNoteTableRow[]): PatchNoteVersionGroup[] {
  const groups = new Map<string, PatchNoteVersionGroup>()
  for (const row of rows) {
    const group = groups.get(row.Version) ?? { version: row.Version, releaseDate: row.ReleaseDate, items: [] }
    group.items.push(row)
    groups.set(row.Version, group)
  }
  for (const group of groups.values()) {
    group.items.sort((a, b) => a.SortOrder - b.SortOrder)
  }
  // 최신 버전이 위로 — 버전 번호 내림차순(자리별 숫자 비교). 출시일만으로 정렬하면
  // 같은 날 여러 버전이 나왔을 때(예: 출시 전 미리 기록해둔 다음 버전) 순서가
  // 뒤섞일 수 있어 버전 번호를 기준으로 삼는다.
  return [...groups.values()].sort((a, b) => compareVersionDesc(a.version, b.version))
}

export function PatchNoteModal({ isOpen, onClose }: PatchNoteModalProps) {
  const versionGroups = groupByVersion(BALANCE_TABLES.PatchNoteTable)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={getProfileUiLabel('patchNoteTitle')}
      footer={
        <Button variant="secondary" onClick={onClose} className="px-3 py-1.5 text-xs">
          {getButtonLabel('close')}
        </Button>
      }
    >
      {/* 버전 데이터 행이 아니라 고정 배너 — 매 릴리스마다 세이브가 초기화된다는
          정책은 예외 없이 항상 적용되므로, 버전별로 문구를 깜빡할 수 있는
          PatchNoteTable 행 대신 여기 코드에 한 번만 박아 항상 보이게 한다. */}
      <p className="mb-3 rounded-lg bg-surface-card px-2.5 py-2 text-[11px] text-text-secondary">
        {getMetaUiLabel('saveResetNotice')}
      </p>

      <div className="max-h-80 space-y-4 overflow-y-auto">
        {versionGroups.map((group) => (
          <div key={group.version}>
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-blue-strong">{group.version}</h3>
              <span className="text-[10px] text-text-disabled">{group.releaseDate}</span>
            </div>
            <ul className="mt-1.5 space-y-1">
              {group.items.map((item) => (
                <li key={item.Id} className="flex items-center gap-2">
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${CATEGORY_BADGE_CLASS[item.Category]}`}
                  >
                    {CATEGORY_LABEL[item.Category]}
                  </span>
                  <span className="text-xs text-text-primary">{getString(item.TextStringId, 'KOR')}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Modal>
  )
}
