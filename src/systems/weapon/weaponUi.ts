// 무기고 화면 전용 표시 상수 — 등급별 색상. docs/DESIGN_SYSTEM.md의 grade-* 토큰을
// 그대로 참조한다(밸런스 데이터가 아니라 순수 UI 톤이라 balance.xlsx가 아닌 여기 둔다).
import type { WeaponGradeEnum } from '../../data/balance'

export const GRADE_BORDER_COLOR: Record<WeaponGradeEnum, string> = {
  Normal: 'border-grade-normal',
  Rare: 'border-grade-rare',
  Epic: 'border-grade-epic',
  Unique: 'border-grade-unique',
  Legendary: 'border-grade-legendary',
}

export const GRADE_BG_COLOR: Record<WeaponGradeEnum, string> = {
  Normal: 'bg-grade-normal/15',
  Rare: 'bg-grade-rare/15',
  Epic: 'bg-grade-epic/15',
  Unique: 'bg-grade-unique/15',
  Legendary: 'bg-grade-legendary/15',
}

export const GRADE_TEXT_COLOR: Record<WeaponGradeEnum, string> = {
  Normal: 'text-grade-normal',
  Rare: 'text-grade-rare',
  Epic: 'text-grade-epic',
  Unique: 'text-grade-unique',
  Legendary: 'text-grade-legendary',
}

// 등급 표시에 얹는 은은한 발광 — box-shadow만 쓰고 색은 등급 토큰 그대로 재사용한다.
// 등급이 높을수록 반경/불투명도를 키워 강도 차이를 준다. Normal은 발광 없음.
export const GRADE_GLOW_SHADOW: Record<WeaponGradeEnum, string> = {
  Normal: '',
  Rare: 'shadow-[0_0_6px_var(--color-grade-rare)]',
  Epic: 'shadow-[0_0_9px_var(--color-grade-epic)]',
  Unique: 'shadow-[0_0_9px_var(--color-grade-unique),0_0_18px_var(--color-grade-unique)]',
  Legendary: 'shadow-[0_0_10px_var(--color-grade-legendary),0_0_22px_var(--color-grade-legendary)]',
}
