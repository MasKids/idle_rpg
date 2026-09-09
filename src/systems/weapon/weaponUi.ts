// 무기고 화면 전용 표시 상수 — 등급별 색상. 밸런스 데이터가 아니라 순수 UI 톤이라
// balance.xlsx가 아닌 여기 코드에 둔다.
import type { WeaponGradeEnum } from '../../data/balance'

export const GRADE_BORDER_COLOR: Record<WeaponGradeEnum, string> = {
  Normal: 'border-slate-400',
  Rare: 'border-blue-400',
  Epic: 'border-purple-400',
  Unique: 'border-orange-400',
  Legendary: 'border-amber-300',
}

export const GRADE_BG_COLOR: Record<WeaponGradeEnum, string> = {
  Normal: 'bg-slate-700/60',
  Rare: 'bg-blue-900/60',
  Epic: 'bg-purple-900/60',
  Unique: 'bg-orange-900/60',
  Legendary: 'bg-amber-900/60',
}

export const GRADE_TEXT_COLOR: Record<WeaponGradeEnum, string> = {
  Normal: 'text-slate-300',
  Rare: 'text-blue-300',
  Epic: 'text-purple-300',
  Unique: 'text-orange-300',
  Legendary: 'text-amber-300',
}
