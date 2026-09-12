import { useId } from 'react'
import { MONSTER_SPRITE_DEFAULT_SIZE, type MonsterSpriteProps } from './types'

// 프랙처 코어 — 일반 몬스터. 육각 껍질 + 균열 + 코어.
//
// 균열 밑선 처리: 원안은 균열이 지나가는 자리에 배경색(#080B0F) 선을 깔아
// "껍질이 갈라져 안쪽이 비쳐 보이는" 효과를 내는 방식이었는데, 배경색을
// 스프라이트에 하드코딩하면 다른 배경(카드, 모달, 플래시 오버레이 등) 위에서
// 어색해진다. 그 대신 <mask>로 균열 자리의 육각 윤곽선을 실제로 투명하게
// 뚫어서, 스프라이트 뒤에 실제로 무엇이 있든(배경색이 뭐든) 자연스럽게
// 비쳐 보이게 했다 — 특정 색을 가정하지 않는 처리.
export function FractureCore({ size = MONSTER_SPRITE_DEFAULT_SIZE, color, className }: MonsterSpriteProps) {
  const maskId = useId()

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={['decor-motion', className].filter(Boolean).join(' ')}
      style={{ color: color ?? 'var(--color-monster-base)', animation: 'sprite-float 2.5s ease-in-out infinite' }}
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="120" height="120">
          <rect x="0" y="0" width="120" height="120" fill="white" />
          <path d="M40 32 L54 54 L42 62 L58 86" fill="none" stroke="black" strokeWidth="4" strokeLinecap="round" />
        </mask>
      </defs>
      <path
        d="M60 20 L94 40 L94 80 L60 100 L26 80 L26 40 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        mask={`url(#${maskId})`}
      />
      <path d="M40 32 L54 54 L42 62 L58 86" fill="none" stroke="var(--color-monster-accent)" strokeWidth="1.2" />
      <circle cx="70" cy="60" r="9" fill="none" stroke="var(--color-monster-accent)" strokeWidth="1.5" />
      <circle cx="70" cy="60" r="3.5" fill="var(--color-monster-accent)" />
    </svg>
  )
}
