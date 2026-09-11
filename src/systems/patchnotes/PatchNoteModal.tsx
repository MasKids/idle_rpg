import { BALANCE_TABLES, getString, type PatchNoteCategoryEnum, type PatchNoteTableRow } from '../../data/balance'
import { Button, Modal } from '../../components/ui'
import { getButtonLabel, getProfileUiLabel } from '../../data/uiStrings'

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
  // 최신 버전이 위로 — 출시일(ISO 문자열) 내림차순. 버전 문자열 비교보다 안전하다.
  return [...groups.values()].sort((a, b) => b.releaseDate.localeCompare(a.releaseDate))
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
