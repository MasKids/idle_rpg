import { getString, getWeaponGradeConfig, type WeaponGradeEnum } from '../../data/balance'
import { GRADE_GLOW_SHADOW } from '../../systems/weapon/weaponUi'

// 무기 5등급 + 유물 3등급(Normal/Rare/Epic, WeaponGradeEnum의 부분집합)을 함께 표현한다.
const GRADE_CLASS: Record<WeaponGradeEnum, string> = {
  Normal: 'border-grade-normal/40 bg-grade-normal/10 text-grade-normal',
  Rare: 'border-grade-rare/40 bg-grade-rare/10 text-grade-rare',
  Epic: 'border-grade-epic/40 bg-grade-epic/10 text-grade-epic',
  Unique: 'border-grade-unique/40 bg-grade-unique/10 text-grade-unique',
  Legendary: 'border-grade-legendary/40 bg-grade-legendary/10 text-grade-legendary',
}

interface GradeBadgeProps {
  grade: WeaponGradeEnum
  className?: string
}

// 항상 한글 등급명으로 표시한다(StringTable 경유) — 무기 상세/가챠 화면에 남아있던
// "Rare"/"Normal" 영문 노출과 같은 문제가 새 화면에서 재발하지 않도록.
export function GradeBadge({ grade, className = '' }: GradeBadgeProps) {
  const name = getString(getWeaponGradeConfig(grade).Name, 'KOR', grade)
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${GRADE_CLASS[grade]} ${GRADE_GLOW_SHADOW[grade]} ${className}`}
    >
      {name}
    </span>
  )
}
