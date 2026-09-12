import { MONSTER_SPRITE_DEFAULT_SIZE, type MonsterSpriteProps } from './types'

// 데이터 레이스 — 일반 몬스터. 두건을 쓴 유령 실루엣 + 스캔라인 + 두 눈.
export function DataWraith({ size = MONSTER_SPRITE_DEFAULT_SIZE, color, className }: MonsterSpriteProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={['decor-motion', className].filter(Boolean).join(' ')}
      style={{ color: color ?? 'var(--color-monster-base)', animation: 'sprite-float 2.7s ease-in-out infinite' }}
    >
      <path d="M60 22 L90 52 L86 98 L34 98 L30 52 Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M37 66 H83 M36 76 H84 M35 86 H85" stroke="currentColor" strokeWidth="0.8" opacity="0.4" />
      <path
        d="M46 52 L58 52 L58 58 L46 58 Z M62 52 L74 52 L74 58 L62 58 Z"
        fill="var(--color-monster-accent)"
      />
      <path d="M30 52 L16 42 M90 52 L104 42" stroke="currentColor" strokeWidth="1.2" opacity="0.7" />
    </svg>
  )
}
